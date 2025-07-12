
// ===== CLI-SERVICE/INDEX.JS =====
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../logger');
const redisClient = require('../redis-client');
const CommandRouter = require('./command-router');

const app = express();
const commandRouter = new CommandRouter();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Session storage
const sessions = new Map();

// Routes
app.post('/api/cli/execute', async (req, res) => {
  try {
    const { command, sessionId, userId, username } = req.body;
    
    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        userId,
        username,
        currentPath: '/home/user',
        environment: {},
        history: []
      };
      sessions.set(sessionId, session);
    }
    
    // Add command to history
    session.history.push(command);
    
    // Execute command
    const result = await commandRouter.executeCommand(command, [], session);
    
    res.json(result);
  } catch (error) {
    logger.error('CLI execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cli/session/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

app.post('/api/cli/session/:sessionId/path', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  session.currentPath = req.body.path;
  res.json({ success: true });
});

// Redis message handling
redisClient.connect().then(() => {
  redisClient.subscribe('cli-commands', async (message) => {
    const { command, sessionId, userId, username } = message;
    
    try {
      // Get or create session
      let session = sessions.get(sessionId);
      if (!session) {
        session = {
          sessionId,
          userId,
          username,
          currentPath: '/home/user',
          environment: {},
          history: []
        };
        sessions.set(sessionId, session);
      }
      
      // Execute command
      const result = await commandRouter.executeCommand(command, [], session);
      
      // Publish result
      await redisClient.publish('cli-responses', {
        sessionId,
        result
      });
    } catch (error) {
      logger.error('Redis CLI command error:', error);
      await redisClient.publish('cli-responses', {
        sessionId,
        result: { output: '', error: error.message }
      });
    }
  });
});

const PORT = config.SERVICES.CLI_PORT;
app.listen(PORT, () => {
  logger.info(`CLI Service running on port ${PORT}`);
});