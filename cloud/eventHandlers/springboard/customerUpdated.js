const Klaviyo  = require('../../services/klaviyo');

class SpringboardCustomerUpdated {
	constructor() {
		this._klaviyo = new Klaviyo();
	}
	
	async handleCustomerUpdated (data) {
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
		}
	}
}

const instance = new SpringboardCustomerUpdated();
module.exports = instance.handleCustomerUpdated;
