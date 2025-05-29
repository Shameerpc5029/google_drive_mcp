#!/usr/bin/env node
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { 
  CallToolRequestSchema, 
  ListResourcesRequestSchema, 
  ListToolsRequestSchema, 
  ReadResourceRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from 'ws';

const drive = google.drive("v3");

// Create server instance
const server = new Server({
  name: "gdrive-mcp-server",
  version: "0.6.2",
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Get credentials path from environment variable (required)
const credentialsPath = process.env.GDRIVE_CREDENTIALS_PATH;

// Set up request handlers
server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const pageSize = 10;
  const params: any = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
  };
  
  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }
  
  const res = await drive.files.list(params);
  const files = res.data.files || [];
  
  return {
    resources: files.map((file) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType || 'application/octet-stream',
      name: file.name || 'Unknown',
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const fileId = request.params.uri.replace("gdrive:///", "");
  
  // First get file metadata to check mime type
  const file = await drive.files.get({
    fileId,
    fields: "mimeType",
  });
  
  // For Google Docs/Sheets/etc we need to export
  if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
    let exportMimeType: string;
    
    switch (file.data.mimeType) {
      case "application/vnd.google-apps.document":
        exportMimeType = "text/markdown";
        break;
      case "application/vnd.google-apps.spreadsheet":
        exportMimeType = "text/csv";
        break;
      case "application/vnd.google-apps.presentation":
        exportMimeType = "text/plain";
        break;
      case "application/vnd.google-apps.drawing":
        exportMimeType = "image/png";
        break;
      default:
        exportMimeType = "text/plain";
    }
    
    const res = await drive.files.export({ 
      fileId, 
      mimeType: exportMimeType 
    }, { 
      responseType: "text" 
    });
    
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: exportMimeType,
          text: res.data as string,
        },
      ],
    };
  }
  
  // For regular files download content
  const res = await drive.files.get({ 
    fileId, 
    alt: "media" 
  }, { 
    responseType: "arraybuffer" 
  });
  
  const mimeType = file.data.mimeType || "application/octet-stream";
  
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          text: Buffer.from(res.data as ArrayBuffer).toString("utf-8"),
        },
      ],
    };
  } else {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          blob: Buffer.from(res.data as ArrayBuffer).toString("base64"),
        },
      ],
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search for files in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const userQuery = request.params.arguments?.query as string;
    
    if (!userQuery) {
      throw new Error("Query parameter is required");
    }
    
    const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const formattedQuery = `fullText contains '${escapedQuery}'`;
    
    const res = await drive.files.list({
      q: formattedQuery,
      pageSize: 10,
      fields: "files(id, name, mimeType, modifiedTime, size)",
    });
    
    const fileList = res.data.files
      ?.map((file) => `${file.name || 'Unknown'} (${file.mimeType || 'Unknown type'})`)
      .join("\n") || '';
    
    return {
      content: [
        {
          type: "text",
          text: `Found ${res.data.files?.length ?? 0} files:\n${fileList}`,
        },
      ],
      isError: false,
    };
  }
  
  throw new Error("Tool not found");
});

// Authentication functions
function createCredentialsFromEnv() {
  const access_token = process.env.GDRIVE_ACCESS_TOKEN;
  const refresh_token = process.env.GDRIVE_REFRESH_TOKEN;
  const client_id = process.env.GDRIVE_CLIENT_ID;
  const client_secret = process.env.GDRIVE_CLIENT_SECRET;
  
  if (!access_token || !refresh_token || !client_id || !client_secret || !credentialsPath) {
    console.error('Missing required environment variables:');
    console.error('- GDRIVE_ACCESS_TOKEN');
    console.error('- GDRIVE_REFRESH_TOKEN');
    console.error('- GDRIVE_CLIENT_ID');
    console.error('- GDRIVE_CLIENT_SECRET');
    console.error('- GDRIVE_CREDENTIALS_PATH');
    return null;
  }

  const credentials = {
    access_token: access_token,
    refresh_token: refresh_token,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    token_type: "Bearer",
    expiry_date: Date.now() + 3600000,
  };

  try {
    const dir = path.dirname(credentialsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log(`Credentials successfully written to ${credentialsPath}`);
    return credentials;
  } catch (error: any) {
    console.error('Error writing credentials file:', error?.message || 'Unknown error');
    return null;
  }
}

async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  
  const client_id = process.env.GDRIVE_CLIENT_ID;
  const client_secret = process.env.GDRIVE_CLIENT_SECRET;
  
  if (!client_id || !client_secret || !credentialsPath) {
    console.error('Required environment variables must be set in .env file:');
    console.error('- GDRIVE_CLIENT_ID');
    console.error('- GDRIVE_CLIENT_SECRET'); 
    console.error('- GDRIVE_CREDENTIALS_PATH');
    process.exit(1);
  }

  const tempOAuthConfig = {
    web: {
      client_id: client_id,
      client_secret: client_secret,
      redirect_uris: ["http://localhost"]
    }
  };
  
  const tempOAuthPath = path.join(path.dirname(credentialsPath), 'temp-oauth.json');
  
  try {
    const dir = path.dirname(credentialsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(tempOAuthPath, JSON.stringify(tempOAuthConfig, null, 2));
    
    const auth = await authenticate({
      keyfilePath: tempOAuthPath,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    
    fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials, null, 2));
    console.log("Credentials saved to:", credentialsPath);
    
    fs.unlinkSync(tempOAuthPath);
    
    if (auth.credentials.access_token && auth.credentials.refresh_token) {
      console.log("\nUpdate your .env file with these tokens:");
      console.log(`GDRIVE_ACCESS_TOKEN=${auth.credentials.access_token}`);
      console.log(`GDRIVE_REFRESH_TOKEN=${auth.credentials.refresh_token}`);
    }
    
    console.log("You can now run the server with: npm start");
  } catch (error) {
    if (fs.existsSync(tempOAuthPath)) {
      fs.unlinkSync(tempOAuthPath);
    }
    throw error;
  }
}

async function setupAuthentication() {
  if (!credentialsPath) {
    console.error("GDRIVE_CREDENTIALS_PATH must be set in .env file");
    process.exit(1);
  }

  const credentials = createCredentialsFromEnv();
  if (!credentials) {
    console.error("Failed to create credentials from environment variables!");
    console.error("Please run: npm run auth  (to run OAuth flow)");
    console.error("Or ensure all required environment variables are set in .env file");
    process.exit(1);
  }

  const client_id = process.env.GDRIVE_CLIENT_ID;
  const client_secret = process.env.GDRIVE_CLIENT_SECRET;
  
  if (!client_id || !client_secret) {
    console.error("GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET must be set in .env file");
    process.exit(1);
  }
  
  const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
  auth.setCredentials(credentials);
  google.options({ auth });

  console.error("Google Drive authentication successful.");
}

async function runStdioServer() {
  await setupAuthentication();
  console.error("Starting MCP server with stdio transport...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runSSEServer() {
  await setupAuthentication();
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  console.error(`Starting SSE server on port ${port} for MCP Inspector...`);
  
  // Create HTTP server with enhanced CORS and SSE support
  const httpServer = http.createServer((req, res) => {
    // Enhanced CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        service: 'mcp-gdrive',
        version: '0.6.2',
        capabilities: ['resources', 'tools'],
        transports: ['sse'],
        endpoints: {
          sse: '/sse',
          health: '/health'
        },
        docker: process.env.NODE_ENV === 'production'
      }));
      return;
    }
    
    // Root endpoint with info
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'MCP GDrive Server',
        version: '0.6.2',
        endpoints: {
          sse: 'http://localhost:' + port + '/sse',
          health: 'http://localhost:' + port + '/health'
        },
        instructions: 'Connect MCP Inspector to the SSE endpoint'
      }));
      return;
    }
    
    // SSE endpoint for MCP Inspector
    if (req.url === '/sse') {
      console.error('📡 New SSE connection from MCP Inspector');
      
      try {
        // Create SSE transport (it will handle headers itself)
        const transport = new SSEServerTransport('/sse', res);
        
        // Connect the MCP server to this transport
        server.connect(transport).then(() => {
          console.error('✅ MCP server connected to SSE transport successfully');
        }).catch((error: unknown) => {
          console.error('❌ Failed to connect MCP server to SSE transport:', error);
        });
        
        // Handle connection close
        req.on('close', () => {
          console.error('🔌 SSE connection closed by client');
        });
        
        req.on('error', (error) => {
          console.error('💥 SSE connection error:', error);
        });
        
      } catch (error: unknown) {
        console.error('💥 Error setting up SSE connection:', error);
        if (!res.headersSent) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to establish SSE connection', details: errorMessage }));
        }
      }
      
      return;
    }
    
    // Default 404 response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: 'Available endpoints: /sse (for MCP Inspector), /health (for status check)',
      endpoints: {
        sse: 'http://localhost:' + port + '/sse',
        health: 'http://localhost:' + port + '/health'
      }
    }));
  });
  
  // Enhanced error handling
  httpServer.on('error', (error) => {
    console.error('💥 HTTP server error:', error);
  });
  
  // Start the server with enhanced logging
  httpServer.listen(port, '0.0.0.0', () => {
    console.error('🚀 MCP GDrive server ready!');
    console.error('📊 Server Details:');
    console.error(`   🌐 Host: 0.0.0.0:${port}`);
    console.error(`   📡 SSE endpoint: http://localhost:${port}/sse`);
    console.error(`   🏥 Health check: http://localhost:${port}/health`);
    console.error(`   🐳 Docker mode: ${process.env.NODE_ENV === 'production' ? 'Yes' : 'No'}`);
    console.error('');
    console.error('🔍 MCP Inspector Instructions:');
    console.error('   1. Run: npx @modelcontextprotocol/inspector');
    console.error('   2. Connect to: http://localhost:' + port + '/sse');
    console.error('   3. Transport: Server-Sent Events (SSE)');
    console.error('');
    console.error('✅ Ready for connections!');
  });
  
  // Enhanced graceful shutdown
  const shutdown = (signal: string) => {
    console.error(`📡 Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      console.error('✅ Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forcing shutdown...');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function runWebSocketServer() {
  await setupAuthentication();
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  console.error(`Starting WebSocket server on port ${port} for MCP Inspector...`);
  
  // Create HTTP server with health endpoint
  const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        service: 'mcp-gdrive',
        version: '0.6.2',
        capabilities: ['resources', 'tools'],
        transports: ['websocket']
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found - Use WebSocket for MCP communication');
    }
  });
  
  // Create WebSocket server for MCP communication
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/mcp'
  });
  
  wss.on('connection', async (ws) => {
    console.error('New MCP Inspector connection established');
    
    // Create transport for this WebSocket connection
    const transport = {
      start: async () => {
        console.error('WebSocket transport initialized');
      },
      
      send: async (message: any) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      },
      
      close: async () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
    
    // Handle WebSocket events
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.error(`Received MCP message: ${message.method || 'unknown'}`);
        // The SDK will handle message processing
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.error('MCP Inspector connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Connect the MCP server to this WebSocket
    try {
      await server.connect(transport);
      console.error('MCP server connected to WebSocket transport');
    } catch (error) {
      console.error('Failed to connect MCP server to WebSocket:', error);
      ws.close();
    }
  });
  
  // Start the server
  httpServer.listen(port, '0.0.0.0', () => {
    console.error(`🚀 MCP GDrive server ready!`);
    console.error(`📡 WebSocket endpoint: ws://localhost:${port}/mcp`);
    console.error(`🏥 Health check: http://localhost:${port}/health`);
    console.error(`🔍 Use MCP Inspector to connect and test the server`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down gracefully...');
    httpServer.close(() => {
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.error('Received SIGINT, shutting down gracefully...');
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

// Main execution logic
const args = process.argv.slice(2);

if (args.includes("auth")) {
  authenticateAndSaveCredentials().catch(console.error);
} else if (args.includes("--sse") || process.env.MCP_TRANSPORT === "sse") {
  runSSEServer().catch(console.error);
} else if (args.includes("--websocket") || process.env.MCP_TRANSPORT === "websocket") {
  runWebSocketServer().catch(console.error);
} else {
  runStdioServer().catch(console.error);
}
