// ===== CLI-SERVICE/COMMAND.JS (FIXED) =====
const axios = require('axios');
const path = require('path');
const config = require('../config');
const logger = require('../logger');

class CommandRouter {
  constructor() {
    this.commands = {
      'ls': this.listDirectory.bind(this),
      'mkdir': this.makeDirectory.bind(this),
      'cd': this.changeDirectory.bind(this),
      'touch': this.createFile.bind(this),
      'cat': this.readFile.bind(this),
      'echo': this.echo.bind(this),
      'clear': this.clear.bind(this),
      'rm': this.removeFile.bind(this),
      'rmdir': this.removeDirectory.bind(this),
      'pwd': this.printWorkingDirectory.bind(this),
      'whoami': this.whoami.bind(this),
      'help': this.help.bind(this),
      'ping': this.ping.bind(this),
      'date': this.date.bind(this),
      'uptime': this.uptime.bind(this),
      'write': this.writeFile.bind(this)
    };
  }

  async executeCommand(command, args, session) {
    try {
      // Handle echo with redirection first
      if (command.includes(' > ') || command.includes(' >> ')) {
        return await this.handleRedirection(command, session);
      }

      const [cmd, ...cmdArgs] = command.trim().split(' ');
      
      if (!cmd) {
        return { output: '', error: null };
      }
      
      if (this.commands[cmd]) {
        return await this.commands[cmd](cmdArgs, session);
      } else {
        return { 
          output: '', 
          error: `Command not found: ${cmd}. Type 'help' for available commands.` 
        };
      }
    } catch (error) {
      logger.error('Command execution error:', error);
      return { 
        output: '', 
        error: `Error executing command: ${error.message}` 
      };
    }
  }

  async handleRedirection(command, session) {
    try {
      // Parse redirection commands like: echo "text" > file.txt
      const redirectMatch = command.match(/(.+?)\s+(>>?)\s+(.+)/);
      if (!redirectMatch) {
        return { output: '', error: 'Invalid redirection syntax' };
      }

      const [, leftSide, operator, filename] = redirectMatch;
      const append = operator === '>>';
      
      // Execute the left side command
      const result = await this.executeCommand(leftSide.trim(), [], session);
      
      if (result.error) {
        return result;
      }

      // Write content to file
      const content = result.output || '';
      const fileName = filename.trim().replace(/['"]/g, ''); // Remove quotes
      
      return await this.writeToFile(session, fileName, content, append);
    } catch (error) {
      logger.error('Redirection error:', error);
      return { output: '', error: error.message };
    }
  }

  async writeToFile(session, fileName, content, append = false) {
    try {
      // Check if file exists
      const existingContent = await this.getFileContent(session, fileName);
      
      if (existingContent === null) {
        // File doesn't exist, create it
        await this.createFileWithContent(session, fileName, content);
      } else {
        // File exists, write/append content
        const newContent = append ? existingContent + content : content;
        await this.updateFileContent(session, fileName, newContent);
      }
      
      return { output: '', error: null };
    } catch (error) {
      logger.error('Write to file error:', error);
      return { output: '', error: error.message };
    }
  }

  async getFileContent(session, fileName) {
    try {
      const response = await axios.get(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/read`, {
        params: { 
          userId: session.userId, 
          path: session.currentPath, 
          name: fileName 
        }
      });
      return response.data.content;
    } catch (error) {
      return null; // File doesn't exist
    }
  }

  async createFileWithContent(session, fileName, content) {
    await axios.post(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/create`, {
      userId: session.userId,
      path: session.currentPath,
      name: fileName,
      type: 'file',
      content: content
    });
  }

  async updateFileContent(session, fileName, content) {
    await axios.put(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/write`, {
      userId: session.userId,
      path: session.currentPath,
      name: fileName,
      content: content
    });
  }

  async listDirectory(args, session) {
    try {
      const path = args[0] || session.currentPath;
      const response = await axios.get(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/list`, {
        params: { userId: session.userId, path }
      });
      
      const files = response.data.files;
      if (files.length === 0) {
        return { output: '', error: null };
      }
      
      const output = files.map(file => {
        const type = file.type === 'folder' ? 'd' : '-';
        const size = file.size.toString().padStart(8);
        const date = new Date(file.updatedAt).toLocaleDateString();
        return `${type}${file.permissions} ${size} ${date} ${file.name}`;
      }).join('\n');
      
      return { output, error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async makeDirectory(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'mkdir: missing operand' };
      }

      const name = args[0].trim();
      const basePath = session.currentPath.replace(/\/+/g, '/').replace(/\/$/, '');
      
      await axios.post(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/create`, {
        userId: session.userId,
        path: basePath,
        name: name,
        type: 'folder'
      });
      
      return { output: '', error: null };
    } catch (error) {
      logger.error('mkdir error:', error.response?.data || error);
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async changeDirectory(args, session) {
    try {
      const targetPath = args[0] || '/home/user';
      
      let newPath;
      if (targetPath.startsWith('/')) {
        newPath = targetPath;
      } else if (targetPath === '..') {
        const pathParts = session.currentPath.split('/').filter(p => p);
        pathParts.pop();
        newPath = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
      } else {
        newPath = session.currentPath === '/' ? 
          `/${targetPath}` : 
          `${session.currentPath}/${targetPath}`;
      }
      
      // Check if path exists
      const response = await axios.get(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/exists`, {
        params: { userId: session.userId, path: newPath }
      });
      
      if (response.data.exists) {
        session.currentPath = newPath;
        return { output: '', error: null };
      } else {
        return { output: '', error: `cd: ${targetPath}: No such file or directory` };
      }
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async createFile(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'touch: missing operand' };
      }

      const name = args[0].trim();
      const basePath = session.currentPath.replace(/\/+/g, '/').replace(/\/$/, '');
      
      await axios.post(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/create`, {
        userId: session.userId,
        path: basePath,
        name: name,
        type: 'file',
        content: ''
      });
      
      return { output: '', error: null };
    } catch (error) {
      logger.error('touch error:', error.response?.data || error);
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async readFile(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'cat: missing operand' };
      }

      const fileName = args[0];
      const response = await axios.get(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/read`, {
        params: { 
          userId: session.userId, 
          path: session.currentPath, 
          name: fileName 
        }
      });
      
      return { output: response.data.content || '', error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async writeFile(args, session) {
    try {
      if (args.length < 2) {
        return { output: '', error: 'write: missing operands (usage: write <filename> <content>)' };
      }

      const fileName = args[0];
      const content = args.slice(1).join(' ');
      
      await axios.put(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/write`, {
        userId: session.userId,
        path: session.currentPath,
        name: fileName,
        content: content
      });
      
      return { output: '', error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async echo(args, session) {
    const output = args.join(' ').replace(/^["']|["']$/g, ''); // Remove surrounding quotes
    return { output, error: null };
  }

  async clear(args, session) {
    return { output: '\x1b[2J\x1b[H', error: null };
  }

  async removeFile(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'rm: missing operand' };
      }

      const fileName = args[0];
      
      await axios.delete(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/delete`, {
        data: { 
          userId: session.userId, 
          path: session.currentPath,
          name: fileName,
          type: 'file'
        }
      });
      
      return { output: '', error: null };
    } catch (error) {
      logger.error('rm error:', error.response?.data || error);
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async removeDirectory(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'rmdir: missing operand' };
      }

      const dirName = args[0];
      
      await axios.delete(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/delete`, {
        data: { 
          userId: session.userId, 
          path: session.currentPath,
          name: dirName,
          type: 'folder'
        }
      });
      
      return { output: '', error: null };
    } catch (error) {
      logger.error('rmdir error:', error.response?.data || error);
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async printWorkingDirectory(args, session) {
    return { output: session.currentPath, error: null };
  }

  async whoami(args, session) {
    return { output: session.username, error: null };
  }

  async help(args, session) {
    const commands = [
      'Available commands:',
      '  ls [path]     - List directory contents',
      '  mkdir <name>  - Create directory',
      '  cd <path>     - Change directory',
      '  touch <name>  - Create empty file',
      '  cat <file>    - Read file contents',
      '  echo <text>   - Display text',
      '  echo "text" > file  - Write text to file',
      '  echo "text" >> file - Append text to file',
      '  write <file> <content> - Write content to file',
      '  clear         - Clear screen',
      '  rm <file>     - Remove file',
      '  rmdir <dir>   - Remove directory',
      '  pwd           - Print working directory',
      '  whoami        - Show current user',
      '  help          - Show this help',
      '  ping          - Test connectivity',
      '  date          - Show current date',
      '  uptime        - Show system uptime'
    ];
    return { output: commands.join('\n'), error: null };
  }

  async ping(args, session) {
    const target = args[0] || 'localhost';
    return { output: `PING ${target}: 64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.5ms`, error: null };
  }

  async date(args, session) {
    return { output: new Date().toString(), error: null };
  }

  async uptime(args, session) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return { output: `up ${hours}h ${minutes}m`, error: null };
  }
}

module.exports = CommandRouter;