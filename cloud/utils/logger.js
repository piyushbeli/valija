'use strict';

// This is just a placeholder for the logger class. I believe Parse already supports winston logger so we
// can come back anytime and groom this class.

const LOGGER = {
    info: function (msg) {
        console.info(JSON.stringify(msg));
    },
    debug: function (msg) {
        console.info(JSON.stringify(msg));
    },
    error: function (msg) {
        console.info(JSON.stringify(msg));
    }
};

module.exports = LOGGER;