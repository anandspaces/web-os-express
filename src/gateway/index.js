// ===== GATEWAY/INDEX.JS =====
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const config = require('../config');
const logger = require('../logger');
const redisClient = require('../redis-client');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Rate limiter for WebSocket connections
const wsRateLimiter = new RateLimiterMemory({
  points: config.RATE_LIMIT.WEBSOCKET_POINTS,
  duration: config.RATE_LIMIT.WEBSOCKET_DURATION
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(cors({
  origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
  credentials: true
}));
app.use(express.json());

// Connected clients
const connectedClients = new Map();

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Verify user exists
    const response = await fetch(`http://localhost:${config.SERVICES.AUTH_PORT}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return next(new Error('Authentication failed'));
    }

    const userData = await response.json();
    socket.user = userData.user;
    socket.sessionId = userData.user.sessionId;

    next();
  } catch (error) {
    logger.error('WebSocket auth error:', error);
    next(new Error('Authentication error'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  const { user, sessionId } = socket;

  logger.info(`User connected: ${user.username} (${sessionId})`);

  // Store client connection
  connectedClients.set(sessionId, {
    socket,
    user,
    connectedAt: new Date()
  });

  // Send welcome message
  socket.emit('output', {
    output: `Welcome to WebOS, ${user.username}!\nType 'help' for available commands.\n`,
    error: null
  });

  // Handle command execution
  socket.on('command', async (data) => {
    try {
      // Rate limiting
      await wsRateLimiter.consume(sessionId);

      const { command } = data;

      if (!command || typeof command !== 'string') {
        socket.emit('output', { output: '', error: 'Invalid command format' });
        return;
      }

      // Log command
      logger.info(`Command from ${user.username}: ${command}`);

      // Execute command via CLI service
      const response = await fetch(`http://localhost:${config.SERVICES.CLI_PORT}/api/cli/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.trim(),
          sessionId,
          userId: user.id,
          username: user.username
        })
      });

      const result = await response.json();

      // Send result back to client
      socket.emit('output', result);

      // Handle special commands
      if (command.trim() === 'clear') {
        socket.emit('clear');
      }

    } catch (error) {
      if (error.remainingPoints !== undefined) {
        socket.emit('output', {
          output: '',
          error: 'Rate limit exceeded. Please slow down.'
        });
      } else {
        logger.error('Command execution error:', error);
        socket.emit('output', {
          output: '',
          error: 'Internal server error'
        });
      }
    }
  });

  // Handle ping
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${user.username} (${sessionId})`);
    connectedClients.delete(sessionId);
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedClients: connectedClients.size
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    connectedClients: connectedClients.size,
    clients: Array.from(connectedClients.values()).map(client => ({
      username: client.user.username,
      connectedAt: client.connectedAt,
      isAnonymous: client.user.isAnonymous
    }))
  };
  res.json(stats);
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Redis connection and message handling
redisClient.connect().then(() => {
  logger.info('Gateway connected to Redis');

  // Subscribe to CLI responses
  redisClient.subscribe('cli-responses', (message) => {
    const { sessionId, result } = message;
    const client = connectedClients.get(sessionId);

    if (client) {
      client.socket.emit('output', result);
    }
  });

  // Subscribe to FS responses
  redisClient.subscribe('fs-responses', (message) => {
    const { sessionId, success, result, error } = message;
    const client = connectedClients.get(sessionId);

    if (client) {
      if (success) {
        client.socket.emit('fs-result', { result });
      } else {
        client.socket.emit('output', { output: '', error });
      }
    }
  });
});

const PORT = config.SERVICES.GATEWAY_PORT;
server.listen(PORT, () => {
  logger.info(`Gateway Service running on port ${PORT}`);
});
