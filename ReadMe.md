# Vbrick MCP Server

This project implements an MCP (Model Context Protocol) server that runs in local mode. It provides tools to interact with the Vbrick Rev API, enabling operations such as video search and authentication.

## Supported Tools

The following Vbrick Rev API calls are supported by this project:

1. **Search Videos**
   - Endpoint: `/api/v2/videos/search`
   - Description: Searches for videos by title or description based on the provided query.

2. **Get Video Details**
   - Endpoint: `/api/v2/videos/{videoId}/details`
   - Description: Retrieves video details

3. **Get Video Chapters**
   - Endpoint: `/api/v2/videos/{videoId}/chapters`
   - Description: Retrieves video chapters

3. **Who Am I?**
   - Endpoint: `/api/v2/users/me`
   - Description: Check who is the current logged-in Vbrick rev user. Always use this tool first to check if the user is   authenticated and get users info.

4. **Authorize**
   - Displays a localhost link to the user which redirects to Vbrick's Oauth login screen.  Login will call back to the localhost and deliver a bearer token that will allow the MCP server to authenticate subsequent requests.

## Configuration

To configure the API keys and other settings, use the `.env` file. Below is an example configuration:

```js
VBRICK_REV_TENANT_URL=<<https://your-vbrick-tenant.com>>
OAUTH_CLIENT_ID=<<your-vbrick-mcp-server-api-key>>
```

### Steps to Configure:
In Vbrick Rev, create an API key called "vbrick-mcp-server" and assign it a unique, random key and add the below callback URLs: 
```
http://localhost:8008/oauth/callback
http://localhost:8009/oauth/callback
```

Your LLM Client such as Claude or Cursor AI will need to set environment variables to your Vbrick Rev tentant URL and key.  Example:
```
"VBRICK_REV_TENANT_URL": "<<https://your-vbrick-tenant.com>>"
"OAUTH_CLIENT_ID": "<<your-vbrick-mcp-server-api-key>>"
```

The configuration may be different depending on which tools you are using. To use a port other than 8008, set the OAUTH_PORT variable.  Claude always calls two instances of the MCP server which uses a backup port, by default it is 8009, but you can set OAUTH_BACKUP_PORT if you need a different one.

## Running the MCP Server

To run the MCP server in local mode:
1. Install dependencies:
   ```bash
   npm ci
   ```
2. Build the project using the following command:
   ```bash
   npm run build
   ```
3. Run the server:
   ```bash
   npm start
   ```

With npm start command, the server will start and listen for incoming requests. Ensure that the `.env` file is correctly configured before running the server.

If you are using LLM clients like Claude or Cursor AI, you don't need to execute Step# 3 (npm start) above from the command line as you will be starting the Vbrick MCP server from those LLM clients. See example below. 

## Testing

Integration tests are provided to validate the functionality of the Vbrick Rev API calls. To run the tests, use the following command:
```bash
npm run test
```

## Sample Claude Desktop Config
```
{
  "mcpServers": {
    "vbrick-mcp-server": {
      "command": "node",
      "args": [
        "C:\\mcp\\vbrick-mcp-server\\dist\\index.js"
      ],
      "env": {
        "VBRICK_REV_TENANT_URL": "<<https://your-vbrick-tenant.com>>",
        "OAUTH_CLIENT_ID": "<<https://your-vbrick-tenant.com>>"
      }
    }
  }
}
```

