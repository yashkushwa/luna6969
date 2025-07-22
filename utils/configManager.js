const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * Centralized configuration management with hot reload and validation
 * Singleton pattern ensures consistent config across the application
 */
class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.config = null;
        this.configPath = path.join(__dirname, '../config.json');
        this.watcher = null;
        this.loadConfig();
        this.setupHotReload();
    }

    /**
     * Load and validate configuration from file
     */
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            const rawConfig = JSON.parse(configData);
            this.config = this.validateAndMergeDefaults(rawConfig);
            
            // Resolve relative paths to absolute paths
            this.config.directories = {
                videos: path.resolve(this.config.directories.videos),
                thumbnails: path.resolve(this.config.directories.thumbnails),
                processed: path.resolve(this.config.directories.processed)
            };

            console.log('Configuration loaded successfully');
            this.emit('configLoaded', this.config);
        } catch (error) {
            console.warn(`Warning: Could not load config.json (${error.message})`);
            console.log('Using default configuration...');
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * Get default configuration with sensible defaults
     */
    getDefaultConfig() {
        return {
            directories: {
                videos: path.resolve('./videos'),
                thumbnails: path.resolve('./thumbnails'),
                processed: path.resolve('./processed')
            },
            server: {
                port: process.env.PORT || 3000,
                host: process.env.HOST || '0.0.0.0'
            },
            thumbnails: {
                defaultThumbnailTime: '00:00:01',
                quality: 2,
                width: 320,
                height: 180,
                generateOnStartup: true
            },
            sprites: {
                spriteInterval: 5,
                spriteWidth: 320,
                spriteHeight: 180,
                spriteTimeout: 50,
                spriteWorkers: require('os').cpus().length || 4
            },
            cache: {
                videoMetadata: 300, // 5 minutes
                thumbnails: 3600,   // 1 hour
                sprites: 7200       // 2 hours
            },
            security: {
                rateLimit: {
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    max: 100 // limit each IP to 100 requests per windowMs
                },
                cors: {
                    origin: true,
                    credentials: true
                }
            },
            api: {
                pagination: {
                    defaultLimit: 20,
                    maxLimit: 100
                },
                search: {
                    enabled: true,
                    minQueryLength: 2
                }
            }
        };
    }

    /**
     * Validate configuration and merge with defaults
     */
    validateAndMergeDefaults(userConfig) {
        const defaults = this.getDefaultConfig();
        
        // Deep merge function
        const deepMerge = (target, source) => {
            const result = { ...target };
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
            return result;
        };

        const config = deepMerge(defaults, userConfig);
        
        // Validate required paths exist or can be created
        this.validateDirectories(config.directories);
        
        return config;
    }

    /**
     * Validate that directories exist or can be created
     */
    validateDirectories(directories) {
        for (const [key, dir] of Object.entries(directories)) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                }
            } catch (error) {
                console.error(`Failed to create directory ${dir}:`, error.message);
                throw new Error(`Invalid directory configuration for ${key}: ${dir}`);
            }
        }
    }

    /**
     * Setup hot reload for configuration changes
     */
    setupHotReload() {
        if (fs.existsSync(this.configPath)) {
            this.watcher = fs.watchFile(this.configPath, { interval: 1000 }, () => {
                console.log('Configuration file changed, reloading...');
                this.loadConfig();
                this.emit('configReloaded', this.config);
            });
        }
    }

    /**
     * Get the current configuration
     */
    get() {
        return this.config;
    }

    /**
     * Get a specific configuration value by dot notation path
     */
    getValue(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }

    /**
     * Stop watching configuration file
     */
    destroy() {
        if (this.watcher) {
            fs.unwatchFile(this.configPath);
            this.watcher = null;
        }
    }
}

// Export singleton instance
module.exports = new ConfigManager();
