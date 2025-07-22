const NodeCache = require('node-cache');
const configManager = require('./configManager');

/**
 * Advanced caching system with multiple cache tiers and TTL management
 */
class CacheManager {
    constructor() {
        this.caches = {};
        this.initializeCaches();
        
        // Listen for config changes
        configManager.on('configReloaded', () => {
            this.reinitializeCaches();
        });
    }

    /**
     * Initialize cache instances with different TTL values
     */
    initializeCaches() {
        const cacheConfig = configManager.getValue('cache') || {};
        
        // Video metadata cache - stores processed video information
        this.caches.videoMetadata = new NodeCache({
            stdTTL: cacheConfig.videoMetadata || 300,
            checkperiod: 60,
            useClones: false,
            maxKeys: 1000
        });

        // Thumbnail cache - stores thumbnail URLs and metadata
        this.caches.thumbnails = new NodeCache({
            stdTTL: cacheConfig.thumbnails || 3600,
            checkperiod: 120,
            useClones: false,
            maxKeys: 500
        });

        // Sprite cache - stores sprite sheet information
        this.caches.sprites = new NodeCache({
            stdTTL: cacheConfig.sprites || 7200,
            checkperiod: 300,
            useClones: false,
            maxKeys: 200
        });

        // File system cache - stores file stats and directory listings
        this.caches.fileSystem = new NodeCache({
            stdTTL: 120, // 2 minutes
            checkperiod: 30,
            useClones: false,
            maxKeys: 100
        });

        // Setup event listeners for cache statistics
        this.setupCacheEvents();
    }

    /**
     * Reinitialize caches when configuration changes
     */
    reinitializeCaches() {
        console.log('Reinitializing caches due to configuration change...');
        this.clearAll();
        this.initializeCaches();
    }

    /**
     * Setup cache event listeners for monitoring
     */
    setupCacheEvents() {
        Object.entries(this.caches).forEach(([name, cache]) => {
            cache.on('set', (key, value) => {
                console.debug(`Cache SET [${name}]: ${key}`);
            });

            cache.on('del', (key, value) => {
                console.debug(`Cache DEL [${name}]: ${key}`);
            });

            cache.on('expired', (key, value) => {
                console.debug(`Cache EXPIRED [${name}]: ${key}`);
            });
        });
    }

    /**
     * Get value from specific cache
     */
    get(cacheType, key) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return undefined;
        }
        return cache.get(key);
    }

    /**
     * Set value in specific cache
     */
    set(cacheType, key, value, ttl) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return false;
        }
        return cache.set(key, value, ttl);
    }

    /**
     * Delete value from specific cache
     */
    del(cacheType, key) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return 0;
        }
        return cache.del(key);
    }

    /**
     * Get multiple values from cache
     */
    mget(cacheType, keys) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return {};
        }
        return cache.mget(keys);
    }

    /**
     * Set multiple values in cache
     */
    mset(cacheType, keyValuePairs, ttl) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return false;
        }
        return cache.mset(keyValuePairs, ttl);
    }

    /**
     * Check if key exists in cache
     */
    has(cacheType, key) {
        const cache = this.caches[cacheType];
        if (!cache) {
            return false;
        }
        return cache.has(key);
    }

    /**
     * Clear specific cache
     */
    clear(cacheType) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return;
        }
        cache.flushAll();
        console.log(`Cache '${cacheType}' cleared`);
    }

    /**
     * Clear all caches
     */
    clearAll() {
        Object.entries(this.caches).forEach(([name, cache]) => {
            cache.flushAll();
        });
        console.log('All caches cleared');
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const stats = {};
        Object.entries(this.caches).forEach(([name, cache]) => {
            stats[name] = cache.getStats();
        });
        return stats;
    }

    /**
     * Get cache information including keys and values
     */
    getInfo() {
        const info = {};
        Object.entries(this.caches).forEach(([name, cache]) => {
            info[name] = {
                stats: cache.getStats(),
                keys: cache.keys(),
                options: cache.options
            };
        });
        return info;
    }

    /**
     * Invalidate cache entries based on pattern
     */
    invalidatePattern(cacheType, pattern) {
        const cache = this.caches[cacheType];
        if (!cache) {
            console.warn(`Cache type '${cacheType}' not found`);
            return;
        }

        const regex = new RegExp(pattern);
        const keys = cache.keys();
        const keysToDelete = keys.filter(key => regex.test(key));
        
        keysToDelete.forEach(key => cache.del(key));
        console.log(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
    }

    /**
     * Get or set with callback (useful for cache-aside pattern)
     */
    async getOrSet(cacheType, key, callback, ttl) {
        let value = this.get(cacheType, key);
        
        if (value === undefined) {
            try {
                value = await callback();
                if (value !== undefined) {
                    this.set(cacheType, key, value, ttl);
                }
            } catch (error) {
                console.error(`Error in cache callback for ${cacheType}:${key}:`, error);
                throw error;
            }
        }
        
        return value;
    }
}

// Export singleton instance
module.exports = new CacheManager();
