'use strict';

// System includes
const Axios = require('axios');
const _ = require('lodash');

// Local includes
const Constants = require('./utils/constants');
const logger = require('./utils/logger');

class ShopifyRequestBuilder {
    constructor (config) {
        this._config = config;
        this._client = Axios.create({
            baseURL: `https://${this._config.SHOPIFY_API_KEY}:${this._config.SHOPIFY_PASSWORD}@${this._config.SHOPIFY_SHOP_NAME}.myshopify.com/admin/`,
        });
    }

    async init () {
        this._defineCloudCode();
    }

    _defineCloudCode () {
        Parse.Cloud.define('shopifyRequest', this.buildShopifyRequest.bind(this));
    }

    async buildShopifyRequest(req, res) {
        try {
            const response = await this._buildShopifyRequest(req.params);
            res.success(response.data);
        } catch (e) {
            logger.error({
                msg: 'ShopifyRequestBuilder:_buildShopifyRequest:: Error occurred',
                err: e.toString(),
                stack: e.stack
            });

            res.error(e.toString());
        }
    }

    async handleShopifyRequest (req, res, next) {
        try {
            const response = await this._buildShopifyRequest(req.body);
            res.json(response.data);
        } catch (e) {
            const errMsg = (_.get(e, 'response.data.errors')) || e.toString();
            logger.error({
                msg: 'ShopifyRequestBuilder:handleShopifyRequest:: Error occurred',
                err: e.toString(),
                stack: e.stack
            });
            res.status(500).send({error: errMsg});
        }
    }

    async _buildShopifyRequest (reqBody) {
        const { endpoint, verb, payload } = reqBody;
        if (!endpoint || !verb) {
            throw '\'endpoint\' and \'verb\' both are required';
        }

        if (Constants.VALID_HTTP_VERBS[verb.toUpperCase()] !== 1) {
            throw `Invalid verb. Valid verbs are: ${_.values(Constants.VALID_HTTP_VERBS)}`
        }

        if (verb === 'POST' && !payload) {
            throw '\'payload\' is required with the \'POST\' and \'PUT\' requests';
        }

        return await  this._client[verb.toLowerCase()](endpoint, payload);
    }
}

module.exports = ShopifyRequestBuilder;