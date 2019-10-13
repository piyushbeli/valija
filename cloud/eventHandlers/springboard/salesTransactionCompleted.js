const Klaviyo  = require('../../services/klaviyo');

class SpringboardSalesTransactionCompleted {
	constructor() {
		this._klaviyo = new Klaviyo();
	}
	
	async handleSalesTransactionCompleted (data) {
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
		}
	}
}

const instance = new SpringboardSalesTransactionCompleted();
module.exports = instance.handleSalesTransactionCompleted;
