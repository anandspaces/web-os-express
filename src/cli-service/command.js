
// ===== CLI-SERVICE/COMMAND-ROUTER.JS =====
const axios = require('axios');
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
      'pwd': this.printWorkingDirectory.bind(this),
      'whoami': this.whoami.bind(this),
      'help': this.help.bind(this),
      'ping': this.ping.bind(this),
      'date': this.date.bind(this),
      'uptime': this.uptime.bind(this)
    };
  }

  async executeCommand(command, args, session) {
    try {
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
      
      await axios.post(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/create`, {
        userId: session.userId,
        path: session.currentPath,
        name: args[0],
        type: 'folder'
      });
      
      return { output: '', error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async changeDirectory(args, session) {
    try {
      const targetPath = args[0] || '/home/user';
      
      // Handle relative paths
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
      
      await axios.post(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/create`, {
        userId: session.userId,
        path: session.currentPath,
        name: args[0],
        type: 'file',
        content: ''
      });
      
      return { output: '', error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async readFile(args, session) {
    try {
      if (!args[0]) {
        return { output: '', error: 'cat: missing operand' };
      }
      
      const response = await axios.get(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/read`, {
        params: { 
          userId: session.userId, 
          path: session.currentPath, 
          name: args[0] 
        }
      });
      
      return { output: response.data.content, error: null };
    } catch (error) {
      return { output: '', error: error.response?.data?.error || error.message };
    }
  }

  async echo(args, session) {
    const output = args.join(' ');
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
      
      await axios.delete(`http://localhost:${config.SERVICES.FS_PORT}/api/fs/delete`, {
        params: { 
          userId: session.userId, 
          path: session.currentPath, 
          name: args[0] 
        }
      });
      
      return { output: '', error: null };
    } catch (error) {
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
      '  touch <name>  - Create file',
      '  cat <file>    - Read file contents',
      '  echo <text>   - Display text',
      '  clear         - Clear screen',
      '  rm <name>     - Remove file/directory',
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
