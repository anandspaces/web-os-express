// ===== FS-SERVICE/FS.JS =====
const File = require('../models/file');
const logger = require('../logger');
const path = require('path');
const fs = require('fs').promises;

class FileSystemController {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadsDir();
  }

  async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      logger.info(`Created uploads directory at ${this.uploadsDir}`);
    }
  }

  async ensureUserDir(userId) {
    const userDir = path.join(this.uploadsDir, userId.toString());
    try {
      await fs.access(userDir);
    } catch {
      await fs.mkdir(userDir, { recursive: true });
      logger.info(`Created user directory at ${userDir}`);
    }
    return userDir;
  }

  async initializeUserFS(userId) {
    try {
      // Ensure user uploads directory exists
      await this.ensureUserDir(userId);

      // Create home directory if it doesn't exist
      const homeExists = await File.findOne({
        name: 'home',
        type: 'folder',
        path: '/',
        owner: userId
      });

      if (!homeExists) {
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

  async listDirectory(userId, dirPath = '/home/user') {
    try {
      const sanitizedPath = File.sanitizePath(dirPath);
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

  async createFile(userId, dirPath, name, type = 'file', content = '') {
    try {
      const sanitizedPath = File.sanitizePath(dirPath);
      
      // Check if file already exists
      const existing = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId
      });

      if (existing) {
        throw new Error(`${type} '${name}' already exists`);
      }

      // Ensure user directory exists
      const userUploadDir = await this.ensureUserDir(userId);

      const file = await File.create({
        name,
        type,
        path: sanitizedPath,
        owner: userId,
        size: content ? content.length : 0
      });

      // If it's a file, save content to disk
      if (type === 'file') {
        const physicalPath = path.join(userUploadDir, file._id.toString());
        await fs.writeFile(physicalPath, content || '', 'utf8');
        logger.info(`Created physical file: ${physicalPath}`);
      }

      logger.info(`Created ${type}: ${sanitizedPath}/${name} for user: ${userId}`);
      return file;
    } catch (error) {
      logger.error('Error creating file:', error);
      throw error;
    }
  }

  async readFile(userId, dirPath, name) {
    try {
      const sanitizedPath = File.sanitizePath(dirPath);
      const file = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId,
        type: 'file'
      });

      if (!file) {
        throw new Error(`File '${name}' not found`);
      }

      // Read file from disk
      const userUploadDir = await this.ensureUserDir(userId);
      const physicalPath = path.join(userUploadDir, file._id.toString());
      
      try {
        const content = await fs.readFile(physicalPath, 'utf8');
        return content;
      } catch (error) {
        logger.warn(`File not found on disk: ${error.message}`);
        // Try to recreate the file with empty content
        await fs.writeFile(physicalPath, '', 'utf8');
        return '';
      }
    } catch (error) {
      logger.error('Error reading file:', error);
      throw error;
    }
  }

  async writeFile(userId, dirPath, name, content) {
    try {
      const sanitizedPath = File.sanitizePath(dirPath);
      let file = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId,
        type: 'file'
      });

      // If file doesn't exist, create it
      if (!file) {
        return await this.createFile(userId, dirPath, name, 'file', content);
      }

      // Ensure user directory exists
      const userUploadDir = await this.ensureUserDir(userId);

      // Write to disk
      const physicalPath = path.join(userUploadDir, file._id.toString());
      await fs.writeFile(physicalPath, content || '', 'utf8');

      // Update metadata
      file.size = content ? content.length : 0;
      file.updatedAt = new Date();
      await file.save();

      logger.info(`Updated file: ${sanitizedPath}/${name} for user: ${userId}`);
      return file;
    } catch (error) {
      logger.error('Error writing file:', error);
      throw error;
    }
  }

  async deleteFile(userId, dirPath, name, type = null) {
    try {
      if (!name) {
        throw new Error('Name is required');
      }

      const sanitizedPath = File.sanitizePath(dirPath);
      const query = {
        name,
        path: sanitizedPath,
        owner: userId
      };

      if (type) {
        query.type = type;
      }

      const file = await File.findOne(query);

      if (!file) {
        throw new Error(`File or folder '${name}' not found`);
      }

      // Ensure user directory exists
      const userUploadDir = await this.ensureUserDir(userId);

      // Delete physical file if it's a file
      if (file.type === 'file') {
        const filePath = path.join(userUploadDir, file._id.toString());
        try {
          await fs.unlink(filePath);
          logger.info(`Deleted physical file: ${filePath}`);
        } catch (error) {
          logger.warn(`Could not delete physical file: ${error.message}`);
        }
      }

      // Delete from database
      await file.deleteOne();

      // If it's a folder, recursively delete contents
      if (file.type === 'folder') {
        const fullPath = `${sanitizedPath}/${name}`.replace(/\/+/g, '/');
        
        // Find all files in this folder and subdirectories
        const children = await File.find({
          owner: userId,
          path: new RegExp(`^${fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/.*)?$`)
        });

        // Delete physical files
        for (const child of children) {
          if (child.type === 'file') {
            const childPath = path.join(userUploadDir, child._id.toString());
            try {
              await fs.unlink(childPath);
              logger.info(`Deleted physical child file: ${childPath}`);
            } catch (error) {
              logger.warn(`Could not delete physical child file: ${error.message}`);
            }
          }
        }

        // Delete from database
        await File.deleteMany({
          owner: userId,
          path: new RegExp(`^${fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/.*)?$`)
        });
      }

      logger.info(`Deleted ${file.type}: ${sanitizedPath}/${name} for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  async pathExists(userId, inputPath) {
    try {
      const sanitizedPath = File.sanitizePath(inputPath);
      
      // Root path always exists
      if (sanitizedPath === '/' || sanitizedPath === '') return true;
      
      const pathParts = sanitizedPath.split('/').filter(part => part);
      
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

  async getFileInfo(userId, dirPath, name) {
    try {
      const sanitizedPath = File.sanitizePath(dirPath);
      const file = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId
      });

      if (!file) {
        throw new Error(`File '${name}' not found`);
      }

      return {
        name: file.name,
        type: file.type,
        size: file.size,
        permissions: file.permissions,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        path: file.path
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      throw error;
    }
  }
}

module.exports = new FileSystemController();