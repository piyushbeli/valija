'use strict';

// System includes
const Axios = require('axios');
const _ = require('lodash');
const qs = require('qs');

// Local includes
const Constants = require('./utils/constants');
const { toBase64 } = require('./utils/utils');
const logger = require('./utils/logger');

class Klaviyo {
    constructor () {
        this._client = Axios.create({
            baseURL: `https://a.klaviyo.com/api/`,
            headers: {
                'api-key': process.env.KLAVIYO_API_KEY,
                'content-type': 'application/json'
            }
        });
    }

    async init () {
        // Nothing to init
    }
    
    async identifyPerson (email) {
        try {
            const data = {
                token: process.env.KLAVIYO_API_KEY,
                properties: {
                    $email: email
                }
            };
            // This API needs base64 encoded string for the above search object
            const response = await this._client.get(`identify?data=${toBase64(data)}`);
            return response.data;
        } catch (e) {
            throw e;
        }
    }
    
    async findPersonInList (email) {
        try {
            const response = await this._client.get(`v2/list/${process.env.KLAVIYO_SPRINGBOARD_LIST_ID}/members`, {
                data: {
                    emails: [email]
                }
            });
            const people = response.data;
            if (people && people.length) {
                return people[0];
            }
        } catch (e) {
            throw e;
        }
    }
    
    async addPersonToList (data) {
        try {
            const response = await this._client.post(`v2/list/${process.env.KLAVIYO_SPRINGBOARD_LIST_ID}/members`, {
                profiles: this._mapSpringboardCustomerToKlaviyo(data)
            });
            return response.data;
        } catch (e) {
            throw e;
        }
    }
    
    async updatePerson (id, data) {
        try {
            // This API needs api_key in the data also even if you have given that in the headers. Insane !!
            const body = Object.assign({api_key: process.env.KLAVIYO_API_KEY}, this._mapSpringboardCustomerToKlaviyo(data));
            // Please note that this insane API requires strigified data and not an object
            await this._client.put(`v1/person/${id}`, qs.stringify(body));
        } catch (e) {
            throw e;
        }
    }
    
    _mapSpringboardCustomerToKlaviyo (data) {
        const person = {};
        _.forOwn(Constants.SPRING_BOARD_TO_KLAVIYO_MAPPING, (value, key) => {
            person[value] = _.get(data, key);
        });
        return person;
    }

}

module.exports = Klaviyo;


