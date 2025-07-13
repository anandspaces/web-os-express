// ===== FS-SERVICE/INDEX.JS =====
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../logger');
const redisClient = require('../redis-client');
const fsController = require('./fs');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(config.MONGODB_URI);

mongoose.connection.on('connected', () => {
  logger.info('FS Service connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

// Start the server
const PORT = config.SERVICES.FS_PORT;
app.listen(PORT, () => {
  logger.info(`FS Service running on port ${PORT}`);
});

// Routes
app.post('/api/fs/init', async (req, res) => {
  try {
    const { userId } = req.body;
    await fsController.initializeUserFS(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fs/list', async (req, res) => {
  try {
    const { userId, path } = req.query;
    const files = await fsController.listDirectory(userId, path);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/create', async (req, res) => {
  try {
    const { userId, path, name, type, content } = req.body;
    const file = await fsController.createFile(userId, path, name, type, content);
    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fs/read', async (req, res) => {
  try {
    const { userId, path, name } = req.query;
    const content = await fsController.readFile(userId, path, name);
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/fs/write', async (req, res) => {
  try {
    const { userId, path, name, content } = req.body;
    const file = await fsController.writeFile(userId, path, name, content);
    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fs/delete', async (req, res) => {
  try {
    const { userId, path, name } = req.query;
    await fsController.deleteFile(userId, path, name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fs/exists', async (req, res) => {
  try {
    const { userId, path } = req.query;
    const exists = await fsController.pathExists(userId, path);
    res.json({ exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});