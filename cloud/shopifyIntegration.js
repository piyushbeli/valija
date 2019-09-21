'use strict';

const Shopify = require('shopify-api-node');
const _ = require('lodash');

const Constants = require('./utils/constants');
const Utils = require('./utils/utils');

class ShopifyService {
    constructor(config) {
        this._config = config;
        this._shopifyConfig = {
            shopName: this._config['SHOPIFY_SHOP_NAME'],
            apiKey: this._config['SHOPIFY_API_KEY'],
            password: this._config['SHOPIFY_PASSWORD'],
            autoLimit: true
        };

        this._shopify = null;
    }

    init() {
        this._shopify = new Shopify(this._shopifyConfig);
    }

    searchProduct(criteria) {
        return this._shopify.product.list(criteria);
    }

    createProduct({payload, options, variants, tags}) {
        const data = Utils.getProductMappedData(payload);
        data.options = options;
        data.variants = variants;
        data.tags = tags;
        return this._shopify.product.create(data);
    }

    updateProduct(productId, payload, options) {
        const data = Utils.getProductMappedData(payload);
        if (options) {
            data.options = options;
        }
        return this._shopify.product.update(productId, data);
    }

    // this will be used when a new product is created
    updateProductImages (productId, images, variantId) {
        images = images.map((image) => {
            image.variant_ids = [variantId];
            return image;
        });
        const data = {
            images
        };
        return this._shopify.product.update(productId, data);
    }

    uploadProductImage (productId, image, variantId) {
        image.variant_ids = [variantId];
        return this._shopify.productImage.create(productId, image);
    }

    deleteProductImage (productId, imageId) {
        return this._shopify.productImage.delete(productId, imageId);
    }

    updateVariantImage (variantId, imageId) {
        return this._shopify.productVariant.create(variantId, {image_id: imageId});
    }

    createProductVariant(productId, payload, primaryImageId) {
        // We need to map the springboard item data into shopify product data.
        // this sequence is important because the same will be used to identify whether a product variant exist or not.
        // size->option1 and color->options2
        if (payload.custom.size || payload.custom.color) {
            const data = Utils.getProductVariantMappedData(payload);
            if (primaryImageId) {
                data.image_id = primaryImageId;
            }
            return this._shopify.productVariant.create(productId, data);
        }
    }

    updateProductVariant(id, payload, primaryImageId) {
        // We need to map the springboard item data into shopify product data.
        // this sequence is important because the same will be used to identify whether a product variant exist or not.
        // size->option1 and color->options2
        const data = Utils.getProductVariantMappedData(payload);
        if (primaryImageId) {
            data.image_id = primaryImageId;
        }
        return this._shopify.productVariant.update(id, data);
    }

    fetchImageMetafields(imageId) {
        return this._shopify.metafield.list({
            metafield: {owner_id: imageId, owner_resource: 'product_image'}
        });
    }
}

module.exports = ShopifyService;