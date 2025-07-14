// ===== REDIS-CLIENT.JS =====
const redis = require('redis');
const config = require('./config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      url: config.REDIS_URL
    });
    
    this.subscriber = null;
    this.isConnected = false;
    
    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });
    
    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });
    
    this.client.on('end', () => {
      logger.info('Redis Client Disconnected');
      this.isConnected = false;
    });
  }
  
  async connect() {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Redis connection error:', error);
      throw error;
    }
  }
  
  async disconnect() {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.isConnected) {
        await this.client.quit();
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }
  
  async publish(channel, message) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error('Redis publish error:', error);
      throw error;
    }
  }
  
  async subscribe(channel, callback) {
    try {
      // Create separate subscriber client for pub/sub
      if (!this.subscriber) {
        this.subscriber = redis.createClient({
          url: config.REDIS_URL
        });
        
        this.subscriber.on('error', (err) => {
          logger.error('Redis Subscriber Error:', err);
        });
        
        await this.subscriber.connect();
      }
      
      await this.subscriber.subscribe(channel, (message) => {
        try {
          callback(JSON.parse(message));
        } catch (parseError) {
          logger.error('Redis message parse error:', parseError);
          // Call callback with raw message if JSON parsing fails
          callback(message);
        }
      });
    } catch (error) {
      logger.error('Redis subscribe error:', error);
      throw error;
    }
  }
  
  async unsubscribe(channel) {
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(channel);
      }
    } catch (error) {
      logger.error('Redis unsubscribe error:', error);
      throw error;
    }
  }
  
  async get(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      throw error;
    }
  }
  
  async set(key, value, expiry = null) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const serializedValue = JSON.stringify(value);
      
      if (expiry) {
        return await this.client.setEx(key, expiry, serializedValue);
      }
      return await this.client.set(key, serializedValue);
    } catch (error) {
      logger.error('Redis set error:', error);
      throw error;
    }
  }
  
  async del(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
      throw error;
    }
  }
  
  // Additional utility methods
  async exists(key) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis exists error:', error);
      throw error;
    }
  }
  
  async expire(key, seconds) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis expire error:', error);
      throw error;
    }
  }
  
  // Health check
  async ping() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis ping error:', error);
      throw error;
    }
  }
}

module.exports = new RedisClient();