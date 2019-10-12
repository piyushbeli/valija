'use strict';

const Express = require('express');
const Axios = require('axios');
const BodyParser = require('body-parser');
const _ = require('lodash');

const Constants = require('./utils/constants');
const Utils = require('./utils/utils');
const logger = require('./utils/logger');
const Style1Counter = require('./models/style1Counter');

const ShopifyService = require('./shopifyIntegration');
const Klaviyo  = require('./klaviyo');
const Cache = require('./utils/cache');

class SpringBoardWebHooksHandler {
    constructor(config) {
        this._config = config;
        this._apiKey = config.SPRING_BOARD_API_KEY;
        this._router = Express.Router();
        this._client = Axios.create({
            baseURL: config['SPRING_BOARD_HOST'],
            timeout: 15000,
            headers: {
                'Authorization': 'Bearer ' + this._apiKey,
                'Content-Type': 'application/json'
            }
        });

        this._shopify = new ShopifyService(config);
        this._klaviyo = new Klaviyo();

        // Define the routes for the webhooks
        this._router.use(BodyParser.json());
        this._router.post('/', this._validateAuthenticity.bind(this), this._handleWebhookEvent.bind(this));
    }

    getRouter() {
        return this._router;
    }

    async init() {
        try {
            await Promise.all([this._initializeWebHooks(), this._shopify.init()]);
        } catch (e) {
            logger.error({
                msg: 'SpringBoardWebHooksHandler:init():: Error occurred',
                err: e.toString(),
                stack: e.stack
            });
            throw e;
        }
    }

    _validateAuthenticity(req, res, next) {
        // Lets send something secret in the query parameter to validate the authenticity
        const secret = req.query['secret'];
        if (secret === this._config['WEB_HOOK_SECRET']) {
            next();
        } else {
            next('Unauthorized access');
        }

    }

    _isSpringBoardItemProcessing(payload) {
        return Cache.get(Utils.getSpringBoardItemKey(payload));
    }

    _setSpringBoardItemProcessing(payload) {
        Cache.set(Utils.getSpringBoardItemKey(payload), 1);
    }

    _springBoardItemProcessed(payload) {
        Cache.delete(Utils.getSpringBoardItemKey(payload));
    }

    async _initializeWebHooks() {
        // First search all the webhooks exist in the system and create those which are missing
        const promises = [];
        try {
            const webhooks = await this._getExistingWebhooks();
            // First delete all the existing webhooks
            for (let webhook of webhooks) {
                promises.push(this._deleteWebHook(webhook.id));
            }

            // Now register a new webhook based on current settings/config
            promises.push(this._registerWebHook());
            return Promise.all(promises);
        } catch (e) {
            throw e;
        }
    }

    async _getExistingWebhooks() {
        try {
            const response = await this._client.get('webhooks?per_page=10');
            return response.data.results;
        } catch (e) {
            throw e;
        }
    }

    async _deleteWebHook(id) {
        return this._client.delete('webhooks/' + id);
    }

    async _registerWebHook() {
        const payload = {
            url: this._config['HOST_URL'] + '/webhook/springboard?secret=' + this._config['WEB_HOOK_SECRET'],
            events: Utils.getInterestedSpringboardEvents()
        };
        if (payload.events.length) {
            return this._client.post('webhooks', payload);
        } else {
            logger.info(`######Server configuration has not enabled any webhook event#######`);
        }
    }
    
    async _handleWebhookEvent (req, res) {
        const data = req.body;
        logger.info({
            msg: 'SpringBoardWebHooksHandler:_handleWebhookEvent::Webhook received',
            data
        });
        // Immediately return the success. If we wait for the operations then it is possible that Springboard will retry the same webhook
        res.send('success');
    
        // Lets set the status in the cache if the item is already processing so that same springboard item is not processed multiple times.
        if (this._isSpringBoardItemProcessing(data)) {
            return;
        } else {
            this._setSpringBoardItemProcessing(data);
        }
        
        switch (Utils.identifyWebhookEvent(data)) {
            case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.CUSTOMER_UPDATED:
                await this._handleCustomerUpdated(data);
                break;
            case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_COMPLETED:
                await this._handleSalesTransactionCompleted(data);
                break;
            case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.ITEM_UPDATED:
                await this._handleItemCreated(data);
                break;
            default:
                logger.error(`Webhook event is not suppored for the above data`);
        }
    }

    // Same method also handles the item_updated
    async _handleItemCreated(data) {
        // We need to massage the custom fields
        const custom = data.custom;
        const id = data.id;
        const upc = this._generateUPCCode(data, id);
        const promises = [];

        if (upc === custom.upc && upc === data.public_id) {
            // Nothing to update
            logger.info({
                msg: 'SpringBoardWebHooksHandler:_handleItemCreated:: upc code did not change. Nothing to update on springboard'
            });
        } else {
            // Lets update the item now.
            custom.upc = upc;
            logger.info({
                msg: 'SpringBoardWebHooksHandler:_handleItemCreated:: need to update the upc code abd public_id',
                upc
            });
            promises.push(this._updateItem(data.id, {public_id: upc, custom}));
        }

        promises.push(this._handleShopifyChanges(data));

        try {
            await Promise.all(promises);
            // After processing the webhook lets remove the processing status from cache
        } catch (e) {
            logger.error({
                msg: 'SpringBoardWebHooksHandler:_handleItemCreated:: Error occurred',
                err: e.toString(),
                shopifyError: _.get(e, 'response.body.errors'),
                springBoardError: _.get(e, 'response.data.details')
                // stack: e.stack
            });
            // After processing the webhook lets remove the processing status from cache
        } finally {
            this._springBoardItemProcessed(data);
    
        }
    }
    
    async _handleCustomerUpdated (data) {
    	if (!data.email) {
    		logger.info(`Email does not exist for the customer ${data.id}. We cannot sync to klaviyo`);
	    }
	    try {
            let person = await this._klaviyo.findPersonInList(data.email);
            if (!person) {
                logger.info(`Person does not exists in klaviyo - springboard imported list with email ${data.email}. Lets add it`);
                person = await this._klaviyo.addPersonToList(data);
                logger.info(`Added a new person in klaviyo for email ${data.email} with id ${person.id}`);
            } else {
                logger.info(`Person with email ${data.email} already exists in klaviyo with person id ${person.id}. Lets update it`);
                await this._klaviyo.updatePerson(person.id, data);
            }
        
        } catch (e) {
	        logger.error({
                msg: 'SpringBoardWebHooksHandler:_handleCustomerUpdated:: Error occurred',
                err: e.toString(),
                // stack: e.stack
            });
        } finally {
            this._springBoardItemProcessed(data);
        }
    }
    
    async _handleSalesTransactionCompleted (data) {
        try {
            // First we need to fetch the Springboard customer because we need customer email to uniquely identify the person in Klaviyo
            const customer = await this._fetchSpringBoardCustomer(data.customer_id);
            const { total_paid: amount, completed_at: timestamp} = data;
            if (customer.email) {
                await this._klaviyo.trackSalesTransactionCompletedEvent(customer.email, data.public_id, amount, data, timestamp);
            } else {
                logger.info({
                    msg: 'SpringBoardWebHooksHandler:_handleSalesTransactionCompleted:: Customer email is not present. ' +
                        'Cannot add the event to Klaviyo',
                    customerId: data.customer_id
                });
            }
        } catch (e) {
            logger.error({
                msg: 'SpringBoardWebHooksHandler:_handleSalesTransactionCompleted:: Error occurred',
                err: e.toString(),
                // stack: e.stack
            });
        } finally {
            this._springBoardItemProcessed(data);
        }
    }

    // style1 is generated by a 2 digit code for the department + 2 digit code for the supplier + incremental digit
    // @DEPRECATED
    async _generateStyle1(item) {
        const style1 = item.custom.style1;
        const departmentName = item.custom.department;
        const supplierId = '' + item.primary_vendor_id;
        let counter;
        if (style1) {
            return style1;
        } else {
            counter = await Style1Counter.getNext();
        }
        const departmentCode = Constants.DEPARTMENT_NAME_TO_CODE[departmentName] || '';
        const newStyle1 = departmentCode.slice(0, 2) + supplierId.slice(0, 2) + counter;
        return newStyle1;
    }

    _generateUPCCode(item, field) {
        if (item.custom.upc) {
            return item.custom.upc;
        }
        let upc = this._config.COMPANY_GS1_CODE + (''+field);
        const checkDigit= Utils.calculateCheckDigit(upc);
        upc = upc.slice(0, 11) + checkDigit;
        return upc;
    }

    _updateItem(id, data) {
        return this._client.put('/items/' + id, data);
    }

    async _fetchItemImages (itemNo) {
        const response = await this._client.get(`/items/${itemNo}/images?per_page=all`);
        return response.data.results;
    }

    async _fetchItemInventory(itemNo) {
        const filter = {
            item_id: itemNo
        };
        const response = await this._client.get(`/inventory/values?_filter=${encodeURIComponent(JSON.stringify(filter))}&per_page=1`);
        return response.data.results;
    }

    async _handleShopifyChanges(payload) {
        const title = payload.custom.style_name;
        const style1 = payload.custom.style1;
        let product;
        const promises = [];
        try {
            if (title) {
                // First see if a product exist with the title. If not then create it. If exist then see which variant got changed.
                const products = await this._shopify.searchProduct({title, vendor: style1});
                if (!products.length) {
                    // Need to create the product
                    // Lets add the options too for the new product
                    logger.info({
                        msg: `SpringBoardWebHooksHandler:_handleShopifyChanges: Product does not exist with title: ${title}. Create new product `
                    });

                    // Check if required parameters exist in the springboard item

                    const options = [];
                    const tags = _.clone(Constants.DEFAULT_TAGS);
                    this._updateOptions(null, payload, options);
                    // Add the variant also
                    const variants = [Utils.getProductVariantMappedData(payload, null)];
                    let images = await this._fetchSpringBoardItemImages(payload);
                    const inventory = await this._fetchItemInventory(payload.id);

                    if (!this._hasAllRequiredParameter(payload, images, inventory)) {
                        throw 'Springboard items does not have all the required data to create the product in shopify';
                    }

                    if (payload.custom.season) {
                        tags.push(payload.custom.season);
                    }
                    if (payload.custom.collection) {
                        tags.push(payload.custom.collection);
                    }

                    // Create the product if all the required data is available in springboard item
                    product = await this._shopify.createProduct({payload, options, variants, tags});

                    // Add images to the product with metafields and also set the image for the variant
                    const variantId = product.variants.length && product.variants[0].id;
                    promises.push(this._shopify.updateProductImages(product.id, images, variantId));
                    logger.info({
                        msg: `SpringBoardWebHooksHandler:_handleShopifyChanges: Successfully created new product with id: ${product.id} `
                    });
                } else {
                    product = products[0];
                    logger.info({
                        msg: 'SpringBoardWebHooksHandler:_handleShopifyChanges: Product already exist with title: ' + title,
                        productId: product.id
                    });
                    // As we don't want to update the description in the shopify lets check if body_html already exist then lets not update it.
                    const existingShopifyProductDescription = product.body_html;
                    if (existingShopifyProductDescription) {
                        payload.long_description = existingShopifyProductDescription;
                    }
                    // Handle the options to the existing product
                    const shouldUpdate = this._updateOptions(product.id, payload, product.options);
                    logger.info({
                        msg: 'SpringBoardWebHooksHandler:_handleShopifyChanges: updating the product with title: ' + title,
                        productId: product.id
                    });
                    // shouldUpdate will be true if options are needed to update. Lets do it synchronously because variant will be dependent on the options
                    if (shouldUpdate) {
                        await this._shopify.updateProduct(product.id, payload, product.options);
                    } else {
                        promises.push(this._shopify.updateProduct(product.id, payload, product.options));
                    }

                    // Fetch springboard images
                    const springBoardImages = await this._fetchItemImages(payload.id);
                    const springBoardImageIds = springBoardImages.map(image => image.id);
                    const currentProductImages = product.images;
                    // Check if any new image is added or some image is deleted
                    const existingSpringBoardImagesOnShopify = [];
                    const existingSpringBoardImageIdsOnShopify = [];
                    const newImages = [];
                    const deletedImages = [];
                    let primaryImageId = null;

                    for (let productImage of currentProductImages) {
                        const imageMetadata = await this._shopify.fetchImageMetafields(productImage.id);
                        const metaFieldValue = imageMetadata.length && imageMetadata[0].value;
                        if (metaFieldValue) {
                            const split = metaFieldValue.split('_');
                            if (split[0] == payload.id) {
                                existingSpringBoardImagesOnShopify.push({springBoardId: split[1], shopifyImageId: productImage.id});
                                existingSpringBoardImageIdsOnShopify.push(split[1]); // this id is the springboard image id stored in image metafield
                            }
                        }
                    }

                    // See if some new image is added
                    for (let springBoardImage of springBoardImages) {
                        if (_.indexOf(existingSpringBoardImageIdsOnShopify, String(springBoardImage.id)) === -1) {
                            newImages.push(Utils.buildShopifyImageData(springBoardImage));
                            if (springBoardImage.primary) {
                                primaryImageId = springBoardImage.id;
                            }
                        }
                    }

                    for (let shopifyImage of existingSpringBoardImagesOnShopify) {
                        if (_.indexOf(springBoardImageIds, Number(shopifyImage.springBoardId)) === -1) {
                            deletedImages.push(shopifyImage.shopifyImageId);
                        }
                    }

                    // Now lets create the new images and delete the deleted images.
                    for (let image of newImages) {
                        promises.push(this._shopify.uploadProductImage(product.id, image));
                    }

                    for (let image of deletedImages) {
                        promises.push(this._shopify.deleteProductImage(product.id, image));
                    }

                    // Add/Update the variant
                    const variants = product.variants;
                    let variantId = this._getExistingVariantId(payload, variants);
                    if (variantId) {
                        // Update the variant
                        logger.info({
                            msg: `SpringBoardWebHooksHandler:_handleShopifyChanges: Variant already exist in shopify for this springboard item with variantId: ${variantId}`
                        });
                        promises.push(this._shopify.updateProductVariant(variantId, payload, primaryImageId));
                    } else {
                        logger.info({
                            msg: `SpringBoardWebHooksHandler:_handleShopifyChanges: Variant does not exist in shopify for this springboard item. Creating a new one`
                        });
                        promises.push(this._shopify.createProductVariant(product.id, payload, primaryImageId));
                    }
                }

                await Promise.all(promises);

                logger.info({
                    msg: '_handleShopifyChanges: successfully executed all the operations'
                });
            } else {
                logger.error({
                    msg: '_handleShopifyChanges: style_name is missing in the springboard item. Product will not be created in the Shopify',
                    itemId: payload.id
                });
            }
        } catch (e) {
            throw e;
        }
    }

    _getExistingVariantId(payload, variants) {
        const { size, color }= payload.custom;
        const upc = payload.custom.upc;
        let variantId = null;
        for (let variant of variants) {
            /*if (variant.option2 == size && variant.option1 == color) {
                variantId = variant.id;
                break;
            }*/
            if (variant.barcode == upc && variant.title != 'Default Title') {
                variantId = variant.id;
                break;
            }
        }
        return variantId;
    }

    _updateOptions (productId, payload, options) {
        let shouldUpdate = true;

        const { size, color } = payload.custom;

        if (!size && !color) {
            return false;
        }

        // If color is available then update color option
        if (color) {
            const colorIndex = _.findIndex(options, o => o.name === 'color');
            if (colorIndex > -1) {
                const colorOption = options[colorIndex];
                const colorValues = colorOption.values;
                const exist = colorValues.some(c => c == color);
                if (!exist) {
                    colorOption.values.push(color);
                } else {
                    shouldUpdate = false;
                }
            } else {
                options.push({
                    name: 'color',
                    values: [color],
                    product_id: productId,
                    position: 1 // Position is very important
                });
            }
        }

        // If size is available then update size option
        if (size) {
            const sizeIndex = _.findIndex(options, o => o.name === 'size');
            if (sizeIndex > -1) {
                const sizeOption = options[sizeIndex];
                const sizeValues = sizeOption.values;
                const exist = sizeValues.some(s => s == size);
                if (!exist) {
                    sizeOption.values.push(size);
                } else {
                    shouldUpdate = false;
                }
            } else {
                options.push({
                    name: 'size',
                    values: [size],
                    product_id: productId,
                    position: 2 // Position is very important
                });
            }
        }

        return shouldUpdate;
    }

    async _fetchSpringBoardItemImages(payload) {
        const images = [];
        const itemImages = await this._fetchItemImages(payload.id);
        for (let image of itemImages) {
            image = Utils.buildShopifyImageData(image);
            images.push(image);
        }

        return images;
    }
    
    async _fetchSpringBoardCustomer (customerId) {
        const response = await this._client.get(`/customers/${customerId}`);
        return response.data;
    }

    _hasAllRequiredParameter (payload, images, inventory) {
        return payload.custom.style_name && payload.long_description && images.length && (inventory && inventory.length && inventory[0].qty > 0);
    }

}

module.exports = SpringBoardWebHooksHandler;
