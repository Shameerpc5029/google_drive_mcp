#!/usr/bin/env node
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListResourcesRequestSchema, 
  ListToolsRequestSchema, 
  ReadResourceRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from 'url';

const drive = google.drive("v3");

const server = new Server({
  name: "example-servers/gdrive",
  version: "0.1.0",
}, {
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Get credentials path from environment variable (required)
const credentialsPath = process.env.GDRIVE_CREDENTIALS_PATH;

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

// Function to create credentials from environment variables
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
    expiry_date: Date.now() + 3600000, // 1 hour from now
  };

  try {
    // Ensure directory exists
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

  // Create a temporary OAuth config
  const tempOAuthConfig = {
    web: {
      client_id: client_id,
      client_secret: client_secret,
      redirect_uris: ["http://localhost"]
    }
  };
  
  const tempOAuthPath = path.join(path.dirname(credentialsPath), 'temp-oauth.json');
  
  try {
    // Ensure directory exists
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
    
    // Clean up temp file
    fs.unlinkSync(tempOAuthPath);
    
    // Show tokens for .env file
    if (auth.credentials.access_token && auth.credentials.refresh_token) {
      console.log("\nUpdate your .env file with these tokens:");
      console.log(`GDRIVE_ACCESS_TOKEN=${auth.credentials.access_token}`);
      console.log(`GDRIVE_REFRESH_TOKEN=${auth.credentials.refresh_token}`);
    }
    
    console.log("You can now run the server with: npm start");
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempOAuthPath)) {
      fs.unlinkSync(tempOAuthPath);
    }
    throw error;
  }
}

async function loadCredentialsAndRunServer() {
  // Check if credentials path is set
  if (!credentialsPath) {
    console.error("GDRIVE_CREDENTIALS_PATH must be set in .env file");
    process.exit(1);
  }

  // Try to create credentials from environment variables
  const credentials = createCredentialsFromEnv();
  if (!credentials) {
    console.error("Failed to create credentials from environment variables!");
    console.error("Please run: npm run auth  (to run OAuth flow)");
    console.error("Or ensure all required environment variables are set in .env file");
    process.exit(1);
  }

  // Create OAuth2 client with credentials from environment
  const client_id = process.env.GDRIVE_CLIENT_ID;
  const client_secret = process.env.GDRIVE_CLIENT_SECRET;
  
  if (!client_id || !client_secret) {
    console.error("GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET must be set in .env file");
    process.exit(1);
  }
  
  const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
  auth.setCredentials(credentials);
  google.options({ auth });

  console.error("Credentials loaded. Starting server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Main execution
if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}