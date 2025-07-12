
// Redis message handling
redisClient.connect().then(() => {
  redisClient.subscribe('fs-commands', async (message) => {
    const { command, data, sessionId } = message;
    
    try {
      let result;
      switch (command) {
        case 'ls':
          result = await fsController.listDirectory(data.userId, data.path);
          break;
        case 'mkdir':
          result = await fsController.createFile(data.userId, data.path, data.name, 'folder');
          break;
        case 'touch':
          result = await fsController.createFile(data.userId, data.path, data.name, 'file');
          break;
        case 'cat':
          result = await fsController.readFile(data.userId, data.path, data.name);
          break;
        case 'rm':
          result = await fsController.deleteFile(data.userId, data.path, data.name);
          break;
        case 'pathExists':
          result = await fsController.pathExists(data.userId, data.path);
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      await redisClient.publish('fs-responses', {
        sessionId,
        success: true,
        result
      });
    } catch (error) {
      await redisClient.publish('fs-responses', {
        sessionId,
        success: false,
        error: error.message
      });
    }
  });
});

const PORT = config.SERVICES.FS_PORT;
app.listen(PORT, () => {
  logger.info(`FS Service running on port ${PORT}`);
});