'use strict';

// System includes
const express = require('express');
const app = express();
const BodyParser = require('body-parser');

// Local includes
const Utils = require('./utils/utils');
const logger = require('./utils/logger');

// Webhook handlers
const SpringBoardWebHooksHandler = require('./springBoardWebHooksHandler');

// Shopify request builder
const ShopifyRequestBuilder = require('./shopifyRequestBuilder');


async function initialize() {
    const config = Utils.getConfig();
    logger.info('Config used');
    logger.info(config);

    // Initialize all the webhook handlers in the system
    await Promise.all([initializeSpringBoardWebHooks(config)]);

    // Initialize the shopify request builder
    await initializeShopifyRequestBuilder(config);
}

async function initializeSpringBoardWebHooks(config) {
    const springBoardWebHook = new SpringBoardWebHooksHandler(config);
    // Register the handler
    app.use('/webhook/springboard', springBoardWebHook.getRouter());
    await springBoardWebHook.init();
}

async function initializeShopifyRequestBuilder(config) {
    const shopifyRequestBuilder = new ShopifyRequestBuilder(config);
    await shopifyRequestBuilder.init();

    // Also expose the shopify request builder as an API
    app.post('/shopifyRequest', BodyParser.json(), shopifyRequestBuilder.handleShopifyRequest.bind(shopifyRequestBuilder));
}

initialize();


module.exports = app;
