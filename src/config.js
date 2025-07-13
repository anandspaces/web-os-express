// ===== CONFIG.JS =====
const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/web-os',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  SERVICES: {
    AUTH_PORT: process.env.AUTH_PORT || 3001,
    FS_PORT: process.env.FS_PORT || 3002,
    CLI_PORT: process.env.CLI_PORT || 3003,
    GATEWAY_PORT: process.env.GATEWAY_PORT || 3000
  },
  RATE_LIMIT: {
    WEBSOCKET_POINTS: 100,
    WEBSOCKET_DURATION: 60
  }
};
