# Google Drive MCP Server

A Model Context Protocol (MCP) server for interacting with Google Drive. This server allows you to search, list, and read files from Google Drive using environment variables for configuration.

## Features

- List files and folders from Google Drive
- Search for files by content or name
- Read file contents (supports Google Docs, Sheets, etc.)
- Export Google Workspace files to various formats
- Secure credential management through environment variables

## Setup

### 1. Project Structure

Create this directory structure:

```
your-project/
├── src/
│   └── index.ts          # Main TypeScript file
├── dist/                 # Compiled JavaScript (generated)
├── .env                  # Environment variables
├── package.json          # Package configuration
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Google Cloud Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Desktop application"
6. Add `http://localhost` to authorized redirect URIs
7. Download the credentials or copy the Client ID and Client Secret

### 4. Environment Configuration

Create a `.env` file with your credentials:

```bash
# Required: Path where credentials will be stored
GDRIVE_CREDENTIALS_PATH=./.gdrive-server-credentials.json

# Required: OAuth credentials from Google Cloud Console
GDRIVE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=your-client-secret-here

# These will be generated during auth flow
GDRIVE_ACCESS_TOKEN=
GDRIVE_REFRESH_TOKEN=
```

### 5. Authentication

Run the authentication flow to get access tokens:

```bash
# Build the project first
npm run build

# Run authentication
npm run auth
```

This will:
1. Open a browser window for Google OAuth
2. Generate access and refresh tokens
3. Display the tokens for you to add to your `.env` file

Update your `.env` file with the generated tokens.

### 6. Start the Server

```bash
npm start
```

## Development

For development with auto-recompilation:

```bash
# Run directly from TypeScript (no build needed)
npm run start:dev

# Run auth flow from TypeScript
npm run auth:dev

# Watch for changes and recompile
npm run watch
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start the compiled server
- `npm run start:dev` - Start server directly from TypeScript
- `npm run auth` - Run OAuth authentication flow
- `npm run auth:dev` - Run auth flow from TypeScript
- `npm run watch` - Watch for changes and recompile
- `npm run clean` - Remove compiled files

## Usage

Once the server is running, it provides the following capabilities:

### Resources
- List files and folders from Google Drive
- Pagination support for large directories

### Tools
- **search**: Search for files by content or filename
  - Query parameter: `query` (string)
  - Returns list of matching files

### File Types Supported
- Google Docs (exported as Markdown)
- Google Sheets (exported as CSV)
- Google Slides (exported as Plain Text)
- Google Drawings (exported as PNG)
- Regular files (PDF, images, text files, etc.)

## Security

- All credentials are stored in environment variables
- OAuth tokens are securely managed
- Credentials file is excluded from version control
- Read-only access to Google Drive

## Troubleshooting

### Build Issues
- Make sure TypeScript is installed: `npm install`
- Check that your file is in `src/index.ts`
- Run `npm run clean` and then `npm run build`

### Authentication Issues
- Verify your Client ID and Client Secret are correct
- Check that the redirect URI `http://localhost` is authorized
- Make sure Google Drive API is enabled in your Google Cloud project

### Runtime Issues
- Ensure all environment variables are set in `.env`
- Check that the credentials file path is accessible
- Verify that tokens haven't expired (re-run auth flow if needed)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GDRIVE_CREDENTIALS_PATH` | Yes | Path to store credential file |
| `GDRIVE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud |
| `GDRIVE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret from Google Cloud |
| `GDRIVE_ACCESS_TOKEN` | Yes* | Generated during auth flow |
| `GDRIVE_REFRESH_TOKEN` | Yes* | Generated during auth flow |

*Generated automatically during authentication

## License

MIT