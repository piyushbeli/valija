'use strict';

const Express = require('express');
const BodyParser = require('body-parser');
const _ = require('lodash');

const Constants = require('../utils/constants');
const Utils = require('../utils/utils');
const logger = require('../utils/logger');

const Springboard = require('../services/springboard');
const Cache = require('../utils/cache');

const handleItemCreated = require('../eventHandlers/springboard/itemCreated');
const handleCustomerUpdated = require('../eventHandlers/springboard/customerUpdated');
const handleSalesTransactionCompleted = require('../eventHandlers/springboard/salesTransactionCompleted');

class SpringBoardWebHooksHandler {
    constructor() {
        this._router = Express.Router();
        this._springboard = new Springboard();

        // Define the routes for the webhooks
        this._router.use(BodyParser.json());
        this._router.post('/', this._validateAuthenticity.bind(this), this._handleWebhookEvent.bind(this));
    }

    getRouter() {
        return this._router;
    }

    async init() {
        try {
            await Promise.all([this._initializeWebHooks()]);
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
        if (secret === process.env.WEB_HOOK_SECRET) {
            next();
        } else {
            next('Unauthorized access');
        }
    }

    static isSpringBoardItemProcessing(payload) {
        return Cache.get(Utils.getSpringBoardItemKey(payload));
    }

    static setSpringBoardItemProcessing(payload) {
        Cache.set(Utils.getSpringBoardItemKey(payload), 1);
    }

    static springBoardItemProcessed(payload) {
        Cache.delete(Utils.getSpringBoardItemKey(payload));
    }

    async _initializeWebHooks() {
        // First search all the webhooks exist in the system and create those which are missing
        const promises = [];
        try {
            const webhooks = await this._springboard.getExistingWebhooks();
            // First delete all the existing webhooks
            for (let webhook of webhooks) {
                promises.push(this._springboard.deleteWebHook(webhook.id));
            }
            // Now register a new webhook based on current settings/config
            promises.push(this._springboard.registerWebHook());
            return Promise.all(promises);
        } catch (e) {
            throw e;
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
        if (SpringBoardWebHooksHandler.isSpringBoardItemProcessing(data)) {
            return;
        } else {
            SpringBoardWebHooksHandler.setSpringBoardItemProcessing(data);
        }
        try {
            switch (Utils.identifyWebhookEvent(data)) {
                case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.CUSTOMER_UPDATED:
                    await handleCustomerUpdated(data);
                    break;
                case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_COMPLETED:
                case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_RETURNED:
                    await handleSalesTransactionCompleted(data);
                    break;
                case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_UPDATED:
                    // Don't take any action but also do not print the error in default case.
                    break;
                case Constants.SPRING_BOARD_WEB_HOOK_EVENTS.ITEM_UPDATED:
                    await handleItemCreated(data);
                    break;
                default:
                    logger.error(`Webhook event is not suppored for the above data`);
            }
        } finally {
            // After processing the webhook lets remove the processing status from cache
            SpringBoardWebHooksHandler.springBoardItemProcessed(data);
        }
    }
}

module.exports = SpringBoardWebHooksHandler;
