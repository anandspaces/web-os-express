// ===== FS-SERVICE/CONTROLLERS/FS.JS =====
const File = require('../../models/file');
const logger = require('../../logger');
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

      // Create user directory if it doesn't exist
      const userUploadDir = path.join(this.uploadsDir, userId.toString());
      await fs.mkdir(userUploadDir, { recursive: true });

      const file = await File.create({
        name,
        type,
        path: sanitizedPath,
        owner: userId,
        size: content.length
      });

      // If it's a file, save content to disk
      if (type === 'file' && content) {
        const filePath = path.join(userUploadDir, file._id.toString());
        await fs.writeFile(filePath, content);
      }

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

      // Read file from disk
      const filePath = path.join(this.uploadsDir, userId.toString(), file._id.toString());
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
      } catch (error) {
        logger.warn(`File not found on disk: ${error.message}`);
        return ''; // Return empty string if file doesn't exist on disk
      }
    } catch (error) {
      logger.error('Error reading file:', error);
      throw error;
    }
  }

  async writeFile(userId, path, name, content) {
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

      // Write to disk
      const filePath = path.join(this.uploadsDir, userId.toString(), file._id.toString());
      await fs.writeFile(filePath, content);

      // Update metadata
      file.size = content.length;
      file.updatedAt = new Date();
      await file.save();

      return file;
    } catch (error) {
      logger.error('Error writing file:', error);
      throw error;
    }
  }

  async deleteFile(userId, path, name) {
    try {
      const sanitizedPath = File.sanitizePath(path);
      const file = await File.findOne({
        name,
        path: sanitizedPath,
        owner: userId
      });

      if (!file) {
        throw new Error(`File or folder '${name}' not found`);
      }

      // Delete physical file if it's a file
      if (file.type === 'file') {
        const filePath = path.join(this.uploadsDir, userId.toString(), file._id.toString());
        try {
          await fs.unlink(filePath);
        } catch (error) {
          logger.warn(`Could not delete physical file: ${error.message}`);
        }
      }

      // Delete from database
      await file.deleteOne();

      // If it's a folder, recursively delete contents
      if (file.type === 'folder') {
        const fullPath = `${sanitizedPath}/${name}`.replace(/\/+/g, '/');
        
        // Find all files in this folder
        const children = await File.find({
          owner: userId,
          path: new RegExp(`^${fullPath}/`)
        });

        // Delete physical files
        for (const child of children) {
          if (child.type === 'file') {
            const childPath = path.join(this.uploadsDir, userId.toString(), child._id.toString());
            try {
              await fs.unlink(childPath);
            } catch (error) {
              logger.warn(`Could not delete physical file: ${error.message}`);
            }
          }
        }

        // Delete from database
        await File.deleteMany({
          owner: userId,
          path: new RegExp(`^${fullPath}/`)
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
