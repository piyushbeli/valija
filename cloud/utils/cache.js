const localCache = {};

class Cache {
    static set(key, val) {
        localCache[key] = val;
    }

    static get(key) {
        return localCache[key];
    }

    static delete(key) {
        delete localCache[key];
    }
}

module.exports = Cache;