# Google Drive MCP Server

A Model Context Protocol (MCP) server for interacting with Google Drive. This server provides read-only access to your Google Drive files and supports multiple transport protocols.

## 🚀 Features

- List files and folders from Google Drive
- Search for files by content or name
- Read file contents (supports Google Docs, Sheets, etc.)
- Export Google Workspace files to various formats
- Multiple transport protocols: Stdio, WebSocket, and SSE
- Docker support for easy deployment

## 📋 Prerequisites

- **Node.js 18+** (for development and local running)
- **Google Cloud Project** with Drive API enabled
- **Google OAuth2 credentials**
- **Docker** (optional, for containerized deployment)

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Google Cloud Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select project and enable Google Drive API
3. Create OAuth 2.0 credentials (Desktop application)
4. Add `http://localhost` to authorized redirect URIs

### 3. Environment Configuration
Create `.env` file:
```bash
# Required: Credentials path
GDRIVE_CREDENTIALS_PATH=./credentials/.gdrive-server-credentials.json

# Required: OAuth credentials from Google Cloud Console
GDRIVE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=your-client-secret-here

# Will be generated during auth flow
GDRIVE_ACCESS_TOKEN=
GDRIVE_REFRESH_TOKEN=
```

### 4. Authentication
```bash
npm run auth:dev
```
Follow the OAuth flow and update your `.env` file with the generated tokens.

### 5. Build the Project
```bash
npm run build
```

## 🚀 Running the Server

### Local Development
```bash
# Stdio transport (for Claude Desktop)
npm run start:dev

# WebSocket transport 
npm run start:websocket:dev

# SSE transport (for MCP Inspector)
npm run start:sse:dev
```

### Production
```bash
# Stdio transport
npm start

# WebSocket transport
npm run start:websocket

# SSE transport
npm run start:sse
```

### Docker
```bash
# Build and start with Docker
npm run docker:build
npm run docker:up

# View logs
npm run docker:logs

# Stop
npm run docker:down
```

## 🔗 Connecting to MCP Inspector

### 1. Start the SSE Server
```bash
npm run start:sse:dev
```

### 2. Run MCP Inspector
```bash
npx @modelcontextprotocol/inspector
```

### 3. Connect to Your Server
- **SSE URL**: `http://localhost:3000/sse`
- **Health Check**: `http://localhost:3000/health`

## 📡 Available Transports

| Transport | Command | Use Case | Connection |
|-----------|---------|----------|------------|
| **Stdio** | `npm run start:dev` | Claude Desktop integration | Process communication |
| **WebSocket** | `npm run start:websocket:dev` | Real-time applications | `ws://localhost:3000/mcp` |
| **SSE** | `npm run start:sse:dev` | MCP Inspector, web apps | `http://localhost:3000/sse` |

## 🔧 Development

### Available Scripts
```bash
npm run build          # Build TypeScript
npm run watch          # Watch mode
npm run start:dev      # Start stdio server  
npm run start:sse:dev  # Start SSE server
npm run auth:dev       # Run auth flow
npm run clean          # Clean built files
```

### Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test SSE endpoint
curl http://localhost:3000/sse
```

## 🛡️ Security

- OAuth2 authentication with Google
- Read-only access to Google Drive
- Credentials stored in environment variables
- Docker volume isolation for sensitive data

## 📁 Project Structure

```
mcp_gdrive/
├── src/index.ts              # Main server code
├── dist/                     # Compiled JavaScript
├── docker-volumes/
│   ├── credentials/          # Mounted credentials
│   └── logs/                # Application logs
├── Dockerfile               # Container definition
├── docker-compose.yml       # Service orchestration
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (create this)
└── README.md                # This file
```

## 🔨 MCP Capabilities

### Resources
- `gdrive:///file-id` - Access individual Google Drive files
- Pagination support for large directories

### Tools
- **search** - Search for files by content or filename
  - Input: `{ "query": "search terms" }`
  - Returns: List of matching files

### File Type Support
- Google Docs → Markdown
- Google Sheets → CSV  
- Google Slides → Plain Text
- Google Drawings → PNG
- Regular files (PDF, images, etc.)

## 🐛 Troubleshooting

### Authentication Issues
```bash
# Re-run auth flow
npm run auth:dev

# Verify .env file has all required variables
cat .env

# Check if credentials file exists
ls -la .gdrive-server-credentials.json
```

### Docker Issues
```bash
# Check Docker logs
npm run docker:logs

# Rebuild Docker image
npm run docker:build

# Check health
curl http://localhost:3000/health
```

### Connection Issues
```bash
# Test different transports
npm run start:sse:dev     # For MCP Inspector
npm run start:websocket:dev  # For WebSocket clients
npm run start:dev         # For Claude Desktop
```

### Port Issues
```bash
# Check what's using port 3000
lsof -i :3000

# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Use different port
PORT=3001 npm run start:sse:dev
```

## 📄 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GDRIVE_CREDENTIALS_PATH` | ✅ | Path to store credential file |
| `GDRIVE_CLIENT_ID` | ✅ | OAuth 2.0 Client ID |
| `GDRIVE_CLIENT_SECRET` | ✅ | OAuth 2.0 Client Secret |
| `GDRIVE_ACCESS_TOKEN` | ✅ | Generated during auth flow |
| `GDRIVE_REFRESH_TOKEN` | ✅ | Generated during auth flow |
| `PORT` | ❌ | Server port (default: 3000) |
| `MCP_LOG_LEVEL` | ❌ | Logging level (default: info) |

## 📄 License

MIT License

---

## 🚀 Quick Start Summary

```bash
# 1. Setup
npm install
cp .env.example .env  # Edit with your Google credentials

# 2. Authenticate  
npm run auth:dev

# 3. Start for MCP Inspector
npm run start:sse:dev

# 4. Run MCP Inspector separately
npx @modelcontextprotocol/inspector
# Connect to: http://localhost:3000/sse

# 5. Or use with Docker
npm run docker:build && npm run docker:up
```

Your MCP GDrive server is now ready for use with MCP Inspector! 🎉
