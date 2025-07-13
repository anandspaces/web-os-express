const logger = require('../logger');

class CommandRouter {
  constructor() {
    this.commands = new Map();
    this.initializeBasicCommands();
  }

  initializeBasicCommands() {
    this.registerCommand('help', this.helpCommand.bind(this));
    this.registerCommand('echo', this.echoCommand.bind(this));
    this.registerCommand('clear', this.clearCommand.bind(this));
  }

  registerCommand(name, handler) {
    this.commands.set(name, handler);
  }

  async executeCommand(command, context) {
    try {
      const [cmdName, ...args] = command.split(' ');
      const handler = this.commands.get(cmdName);

      if (!handler) {
        return {
          output: '',
          error: `Command not found: ${cmdName}`
        };
      }

      return await handler(args, context);
    } catch (error) {
      logger.error('Command execution error:', error);
      return {
        output: '',
        error: 'Internal command execution error'
      };
    }
  }

  // Basic command handlers
  async helpCommand(args, context) {
    const commands = Array.from(this.commands.keys());
    return {
      output: `Available commands:\n${commands.join('\n')}\n\nType 'help <command>' for more information about a specific command.`,
      error: null
    };
  }

  async echoCommand(args, context) {
    return {
      output: args.join(' ') + '\n',
      error: null
    };
  }

  async clearCommand(args, context) {
    return {
      output: '',
      error: null
    };
  }
}

module.exports = CommandRouter;
