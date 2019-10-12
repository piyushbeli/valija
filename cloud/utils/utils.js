'use strict';

const Constants = require('./constants');
const _ = require('lodash');
const logger = require('./logger');

class Utils {
    static getConfig() {
        return process.env;
    }

    static getParseObjectByClassName(className) {
        return Parse.Object.extend(className);
    };

    static getParseQueryByClassName(className) {
        const ParseObj = Utils.getParseObjectByClassName(className);
        return new Parse.Query(ParseObj);
    };
    
    static getInterestedSpringboardEvents () {
        const events = [];
        if (process.env.ENABLE_KLAVIYA_SYNC === 'true') {
            events.push(Constants.SPRING_BOARD_WEB_HOOK_EVENTS.CUSTOMER_CREATED);
            events.push(Constants.SPRING_BOARD_WEB_HOOK_EVENTS.CUSTOMER_UPDATED);
            events.push(Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_COMPLETED);
        }
        if (process.env.ENABLE_SHOPIFY_SYNC === 'true') {
            events.push(Constants.SPRING_BOARD_WEB_HOOK_EVENTS.ITEM_UPDATED);
            events.push(Constants.SPRING_BOARD_WEB_HOOK_EVENTS.ITEM_CREATED);
        }
        
        return events;
    }

    // Source: https://github.com/abadri/GTINGenerator/blob/master/index.js
    static calculateCheckDigit(gtin) {
        let data, sum = 0, checkdigit;
        gtin = Number(gtin);
        if (isNaN(gtin)) {
            return new Error("Argument" + gtin + "is not valid type number");
        }
        data = ('' + gtin).split('').reverse();
        for (let i = 0; i < data.length; i++) {
            let num = parseInt(data[i]);
            if (i % 2) {
                sum += num;
            } else {
                sum += num * 3;
            }
        }
        checkdigit = (Math.ceil(sum / 10) * 10 - sum);
        return checkdigit;
    };

    static buildShopifyImageData(springBoardImage) {
        return {
            src: springBoardImage.url,
            position: springBoardImage.primary ? 1: null,
            metafields: [{
                key: 'springBoardImageId',
                value: springBoardImage.item_id + '_' + springBoardImage.id,
                value_type: 'string',
                namespace: 'global'
            }]
        };
    }

    static getProductMappedData(payload) {
        const data = {};
        const productMapping = Constants.PRODUCT_MAPPING;
        _.forOwn(productMapping, (value, key) => {
            data[value] = _.get(payload, key);
        });
        Object.assign(data, Constants.DEFAULT_PRODUCT_DATA);
        return data;
    }

    static getProductVariantMappedData(payload, primaryImage) {
        const data = {};
        const productVariantMapping = Constants.PRODUCT_VARIANT_MAPPING;
        _.forOwn(productVariantMapping, (value, key) => {
            data[value] = _.get(payload, key);
        });

        if (primaryImage) {
          data.image_id = primaryImage.id;
        }
        Object.assign(data, Constants.DEFAULT_VARIANT_DATA);
        return data;
    }

    static getSpringBoardItemKey(payload) {
        return payload.id;
    }
    
    // For us, it does not matter if it's a create or update event
    static identifyWebhookEvent (payload) {
        if ('first_name' in payload && 'email' in payload) {
            return Constants.SPRING_BOARD_WEB_HOOK_EVENTS.CUSTOMER_UPDATED;
        } else if ('type' in payload && payload.type === 'Ticket') {
            return Constants.SPRING_BOARD_WEB_HOOK_EVENTS.SALES_TRANSACTION_COMPLETED;
        } else {
            return Constants.SPRING_BOARD_WEB_HOOK_EVENTS.ITEM_UPDATED;
        }
    }
    
    static toBase64 (arg) {
        if (typeof arg === 'object') {
            return Buffer.from(JSON.stringify(arg)).toString('base64');
        } else {
            return Buffer.from(arg).toString('base64');
        }
    }
}

module.exports = Utils;
