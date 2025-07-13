// ===== FS-SERVICE/MODELS/FILE.JS =====
const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['file', 'folder'],
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  path: {
    type: String,
    required: true,
    index: true
  },
  owner: {
    type: String,
    required: true,
    index: true
  },
  permissions: {
    type: String,
    default: 'rwx'
  },
  size: {
    type: Number,
    default: 0
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null
  }
}, {
  timestamps: true
});

FileSchema.index({ path: 1, owner: 1 });
FileSchema.index({ parent: 1, owner: 1 });

FileSchema.methods.getFullPath = function() {
  return this.path === '/' ? `/${this.name}` : `${this.path}/${this.name}`;
};

FileSchema.statics.sanitizePath = function(inputPath) {
  // Handle undefined or empty paths
  if (!inputPath) return '/';
  
  // Prevent path traversal attacks and normalize slashes
  return inputPath
    .replace(/\.\./g, '')    // Remove parent directory references
    .replace(/\/+/g, '/')    // Replace multiple slashes with single slash
    .replace(/\/$/, '')      // Remove trailing slash
    .replace(/^([^/])/, '/$1'); // Ensure path starts with slash
};

module.exports = mongoose.model('File', FileSchema);
