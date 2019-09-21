'use strict';

const Utils = require('../utils/utils');
const Constants = require('../utils/constants');

class Style1Counter {

}

Style1Counter.getNext = async function () {
    // Fetch the current one
    const query = Utils.getParseQueryByClassName(Constants.CLASS_NAME.Style1Counter);
    const current = await query.first();
    let counter = 1;
    if (current) {
        counter = current.get('counter');
        // Lets save the next counter
        current.set('counter', counter+1);
        await current.save(null);
    } else {
        const Style1Counter = Utils.getParseObjectByClassName(Constants.CLASS_NAME.Style1Counter);
        const obj = new Style1Counter({counter: counter + 1});
        await obj.save();
    }

    return counter;
};

module.exports = Style1Counter;
