
// ===== FS-SERVICE/CONTROLLERS/FS.JS =====
const File = require('../models/file');
const logger = require('../../logger');

class FileSystemController {
  async initializeUserFS(userId) {
    try {
      // Create home directory if it doesn't exist
      const homeExists = await File.findOne({
        name: 'home',
        type: 'folder',
        path: '/',
        owner: userId
      });

      if (!homeExists) {
        // Create root directory
        await File.create({
          name: 'root',
          type: 'folder',
          path: '/',
          owner: userId
        });

        // Create home directory
        const homeDir = await File.create({
          name: 'home',
          type: 'folder',
          path: '/',
          owner: userId
        });

        // Create user directory
        await File.create({
          name: 'user',
          type: 'folder',
          path: '/home',
          owner: userId,
          parent: homeDir._id
        });

        logger.info(`Initialized file system for user: ${userId}`);
      }
    } catch (error) {
      logger.error('Error initializing user FS:', error);
      throw error;
    }
  }

  async listDirectory(userId, path = '/home/user') {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const files = await File.find({
        path: sanitizedPath,
        owner: userId
      }).sort({ type: -1, name: 1 });

      return files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        permissions: file.permissions,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt
      }));
    } catch (error) {
      logger.error('Error listing directory:', error);
      throw error;
    }
  }

  async createFile(userId, path, name, type = 'file', content = '') {
    try {
      const sanitizedPath = File.sanitizePath(path);
      
      // Check if file already exists
      const existing = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId
      });

      if (existing) {
        throw new Error(`${type} '${name}' already exists`);
      }

      const file = await File.create({
        name,
        type,
        content,
        path: sanitizedPath,
        owner: userId,
        size: content.length
      });

      logger.info(`Created ${type}: ${sanitizedPath}/${name} for user: ${userId}`);
      return file;
    } catch (error) {
      logger.error('Error creating file:', error);
      throw error;
    }
  }

  async readFile(userId, path, name) {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const file = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId,
        type: 'file'
      });

      if (!file) {
        throw new Error(`File '${name}' not found`);
      }

      return file.content;
    } catch (error) {
      logger.error('Error reading file:', error);
      throw error;
    }
  }

  async writeFile(userId, path, name, content) {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const file = await File.findOneAndUpdate(
        {
          name,
          path: sanitizedPath,
          owner: userId,
          type: 'file'
        },
        {
          content,
          size: content.length,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!file) {
        throw new Error(`File '${name}' not found`);
      }

      return file;
    } catch (error) {
      logger.error('Error writing file:', error);
      throw error;
    }
  }

  async deleteFile(userId, path, name) {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const file = await File.findOneAndDelete({
        name,
        path: sanitizedPath,
        owner: userId
      });

      if (!file) {
        throw new Error(`File or folder '${name}' not found`);
      }

      // If it's a folder, recursively delete contents
      if (file.type === 'folder') {
        const fullPath = file.getFullPath();
        await File.deleteMany({
          path: new RegExp(`^${fullPath}`),
          owner: userId
        });
      }

      logger.info(`Deleted ${file.type}: ${sanitizedPath}/${name} for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  async pathExists(userId, path) {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const pathParts = sanitizedPath.split('/').filter(part => part);
      
      if (pathParts.length === 0) return true; // Root path
      
      let currentPath = '/';
      for (const part of pathParts) {
        const exists = await File.findOne({
          name: part,
          path: currentPath,
          owner: userId,
          type: 'folder'
        });
        
        if (!exists) return false;
        currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
      }
      
      return true;
    } catch (error) {
      logger.error('Error checking path existence:', error);
      return false;
    }
  }
}

module.exports = new FileSystemController();
