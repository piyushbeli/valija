const Axios = require('axios');

const Utils = require('../utils/utils');

class SpringBoard {
	constructor() {
		this._client = Axios.create({
			baseURL: process.env.SPRING_BOARD_HOST,
			timeout: 15000,
			headers: {
				'Authorization': 'Bearer ' + process.env.SPRING_BOARD_API_KEY,
				'Content-Type': 'application/json'
			}
		});
	}
	
	async getExistingWebhooks() {
		try {
			const response = await this._client.get('webhooks?per_page=10');
			return response.data.results;
		} catch (e) {
			throw e;
		}
	}
	
	async deleteWebHook(id) {
		return this._client.delete('webhooks/' + id);
	}
	
	async registerWebHook() {
		const payload = {
			url: process.env.HOST_URL + '/webhook/springboard?secret=' + process.env.WEB_HOOK_SECRET,
			events: Utils.getInterestedSpringboardEvents()
		};
		if (payload.events.length) {
			return this._client.post('webhooks', payload);
		} else {
			logger.info(`######Server configuration has not enabled any webhook event#######`);
		}
	}
	
	async updateItem(id, data) {
		return this._client.put('/items/' + id, data);
	}
	
	async fetchItemImages (itemNo) {
		const response = await this._client.get(`/items/${itemNo}/images?per_page=all`);
		return response.data.results;
	}
	
	async fetchItemInventory(itemNo) {
		const filter = {
			item_id: itemNo
		};
		const response = await this._client.get(`/inventory/values?_filter=${encodeURIComponent(JSON.stringify(filter))}&per_page=1`);
		return response.data.results;
	}
	
	async _fetchSpringBoardCustomer (customerId) {
		const response = await this._client.get(`/customers/${customerId}`);
		return response.data;
	}
}

module.exports = SpringBoard;
