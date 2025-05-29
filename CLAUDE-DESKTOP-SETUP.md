# 🖥️ Claude Desktop Setup Guide

## 📁 Claude Desktop Configuration Location

The Claude Desktop configuration file should be placed at:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

## 🔧 Setup Instructions

### Step 1: Build Your MCP Server
```bash
cd /Users/shameer/Documents/personal-projects/mcp_gdrive
npm run build
```

### Step 2: Copy the Configuration
Copy the contents of `claude-config.json` from this project into your Claude Desktop config file.

#### Option A: Manual Copy
1. Open `claude-config.json` from this project
2. Copy the entire contents
3. Create/edit your Claude Desktop config file at the location above
4. Paste the configuration

#### Option B: Command Line Copy (macOS)
```bash
# Create the directory if it doesn't exist
mkdir -p "~/Library/Application Support/Claude"

# Copy the config file
cp claude-config.json "~/Library/Application Support/Claude/claude_desktop_config.json"
```

### Step 3: Restart Claude Desktop
- Quit Claude Desktop completely
- Restart the application
- Your Google Drive integration should now be available

## 📋 Configuration Details

The configuration includes:
- **Server Name**: `gdrive`
- **Command**: Runs your built MCP server via Node.js
- **Path**: Points to your compiled JavaScript file
- **Environment**: Includes all your Google Drive credentials

## 🔍 Testing the Integration

Once configured, you can:

1. **Ask Claude about your files:**
   - "What files do I have in Google Drive?"
   - "Show me my recent documents"

2. **Search your Drive:**
   - "Search for files containing 'project proposal'"
   - "Find spreadsheets about budget"

3. **Read file contents:**
   - "Read the contents of my presentation.pptx"
   - "What's in my meeting notes document?"

## 🛠️ Troubleshooting

### If Claude Desktop doesn't recognize your server:

1. **Check the file path** in the config matches your actual project location
2. **Ensure the project is built** with `npm run build`
3. **Verify credentials** are in your `.env` file
4. **Restart Claude Desktop** completely
5. **Check Claude Desktop logs** (usually in Application Support folder)

### Test your server independently:
```bash
# Test that your MCP server works
npm run start:dev

# Should show authentication success and server ready messages
```

## 🔄 Updating Configuration

If you move your project or update credentials:
1. Update the paths in `claude-config.json`
2. Copy the updated config to Claude Desktop
3. Restart Claude Desktop

## 🎯 Alternative: Use Environment Variables

For better security, you can reference environment variables:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "node",
      "args": [
        "/Users/shameer/Documents/personal-projects/mcp_gdrive/dist/index.js"
      ]
    }
  }
}
```

Then ensure your `.env` file is properly loaded by the system.

Your Google Drive integration is now ready for Claude Desktop! 🎉
