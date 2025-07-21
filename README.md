# WebOS Backend - Production-Grade Web-Based Operating System

A scalable, production-ready backend for a browser-based operating system with terminal interface, built using Node.js, Express, MongoDB, WebSockets, and microservices architecture.

## 🚀 Features

- **Real-time Terminal Interface**: WebSocket-based CLI with streaming command output
- **Virtual File System**: MongoDB-backed persistent file system with full CRUD operations
- **Microservices Architecture**: Scalable service-oriented design with Redis message queues
- **Authentication & Sessions**: JWT-based auth with support for anonymous users
- **Command Processing**: Extensible command router with built-in Unix-like commands
- **Rate Limiting**: WebSocket rate limiting and security middleware
- **Production Ready**: Docker containerization, logging, error handling

## 🏗️ Architecture

### Services
- **Gateway Service** (Port 3000): WebSocket server and API gateway
- **Auth Service** (Port 3001): JWT authentication and user management
- **FS Service** (Port 3002): Virtual file system operations
- **CLI Service** (Port 3003): Command parsing and execution

### Infrastructure
- **MongoDB**: Persistent data storage
- **Redis**: Message queue and session cache
- **Docker**: Containerization and orchestration

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- Redis 7.2+
- Docker & Docker Compose (optional)

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with required variables
4. Start services: `npm run start:services`
5. Open client at `http://localhost:3000`

### Docker Deployment
```bash
docker-compose up -d
```

## 🔧 Available Commands

- `ls [path]` - List directory contents
- `mkdir <name>` - Create directory
- `cd <path>` - Change directory
- `touch <name>` - Create file
- `cat <file>` - Read file contents
- `echo <text>` - Display text
- `clear` - Clear screen
- `rm <name>` - Remove file/directory
- `pwd` - Print working directory
- `whoami` - Show current user
- `help` - Show available commands
- `ping` - Test connectivity
- `date` - Show current date
- `uptime` - Show system uptime

## 🔒 Security Features

- Path traversal protection
- Input sanitization
- JWT authentication
- Rate limiting
- CORS and security headers
- User session isolation

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/anonymous` - Anonymous login
- `POST /api/auth/verify` - Token verification

### File System
- `GET /api/fs/list` - List directory contents
- `POST /api/fs/create` - Create file/folder
- `GET /api/fs/read` - Read file content
- `PUT /api/fs/write` - Write file content
- `DELETE /api/fs/delete` - Delete file/folder

### CLI
- `POST /api/cli/execute` - Execute command
- `GET /api/cli/session/:id` - Get session info

### System
- `GET /api/health` - Health check
- `GET /api/stats` - System statistics

## 🔄 WebSocket Events

### Client → Server
- `command` - Execute CLI command
- `ping` - Connection test

### Server → Client
- `output` - Command output/error
- `clear` - Clear terminal
- `pong` - Ping response

## 🚀 Scaling & Production

### Horizontal Scaling
- Multiple service instances behind load balancer
- Redis clustering for message queues
- MongoDB replica sets for high availability

### Monitoring
- Winston logging with multiple transports
- Health check endpoints
- Connection statistics

### Performance
- WebSocket connection pooling
- Rate limiting per user
- Optimized MongoDB queries with indexes

## 📝 Environment Variables

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/web-os
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
AUTH_PORT=3001
FS_PORT=3002
CLI_PORT=3003
GATEWAY_PORT=3000
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🛡️ Security

For security issues, please email security@webos.com

---

Built with ❤️ for the future of web-based operating systems