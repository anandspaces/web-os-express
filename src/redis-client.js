
// ===== SHARED/REDIS-CLIENT.JS =====
const redis = require('redis');
const config = require('./config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      url: config.REDIS_URL
    });
    
    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
    });
  }

  async connect() {
    await this.client.connect();
  }

  async publish(channel, message) {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel, callback) {
    await this.client.subscribe(channel, (message) => {
      callback(JSON.parse(message));
    });
  }

  async get(key) {
    return await this.client.get(key);
  }

  async set(key, value, expiry = null) {
    if (expiry) {
      return await this.client.setEx(key, expiry, JSON.stringify(value));
    }
    return await this.client.set(key, JSON.stringify(value));
  }

  async del(key) {
    return await this.client.del(key);
  }
}

module.exports = new RedisClient();
