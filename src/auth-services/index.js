
// ===== AUTH-SERVICE/INDEX.JS =====
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../logger');
const redisClient = require('../redis-client');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(config.MONGODB_URI);

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const sessionId = uuidv4();
    
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      sessionId
    });
    
    const token = jwt.sign(
      { userId: user._id, sessionId },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    
    // Initialize user file system
    await fetch(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id.toString() })
    });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        sessionId: user.sessionId
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, sessionId: user.sessionId },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        sessionId: user.sessionId
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/anonymous', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const username = `anonymous_${Date.now()}`;
    
    const user = await User.create({
      username,
      email: `${username}@anonymous.com`,
      password: await bcrypt.hash('anonymous', 10),
      isAnonymous: true,
      sessionId
    });
    
    const token = jwt.sign(
      { userId: user._id, sessionId },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    
    // Initialize user file system
    await fetch(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id.toString() })
    });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        isAnonymous: true,
        sessionId: user.sessionId
      }
    });
  } catch (error) {
    logger.error('Anonymous login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        sessionId: user.sessionId,
        isAnonymous: user.isAnonymous
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = config.SERVICES.AUTH_PORT;
app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});