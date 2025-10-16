#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from 'node:url';

import { config } from "./config.ts";

import { authenticateVbrickAndScheduleRefresh, formatResponse, getFolderPath } from "./vbrickUtilities.ts";
import { startOAuthHandler, getOAuthAccessToken } from "./server.ts";
import open from "open";

const server = new McpServer({
  name: "rev-mcp-server",
  version: "1.0.0",
});

function registerAuthorizeTool() {
  server.tool(
    "vbick_authorize",
    "This tool will let the user get logged in. You will not get a confirmation until the user logs in, so wait for that.",
    {},
    async function (_args, _extra) {
      const loginUrl = `http://localhost:${config.oauth.port}/`;
      console.warn("Pop open a browser window with the login link");
      open(loginUrl);

      const maxWaitMs = 20000;
      const pollIntervalMs = 1000;
      let waited = 0;

      while (!getOAuthAccessToken() && waited < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        waited += pollIntervalMs;
      }

      if (getOAuthAccessToken()) {
        return formatResponse("✅ Login successful!", "text");
      } else {
        return formatResponse(
          "⏳ The login process is still pending. Use the who-am-i tool to keep checking if the login succeeded, or run the authorize tool again.",
          "text"
        );
      }
    }
  );
}

async function registerTools() {
  const toolsDir = getFolderPath("tools");

  const toolFiles = fs.readdirSync(toolsDir).filter(file => file.endsWith(".ts") || file.endsWith(".js"));

  for (const file of toolFiles) {
    const modulePath = path.join(toolsDir, file);
    const toolModule = await import(pathToFileURL(modulePath).href);

    for (const exportKey of Object.keys(toolModule)) {
      const tool = toolModule[exportKey];
      console.warn(`Registering tool: ${tool.name}`);
      server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
    }
  }
}

// Start the server
async function main() {
  if (config.oauth.enabled) {
    await startOAuthHandler();
    registerAuthorizeTool();
  }

  await authenticateVbrickAndScheduleRefresh();
  await registerTools();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.warn("Rev MCP Server running on stdio");
  console.warn(`Tenant: ${config.vbrickRevTenantUrl}, OAuth: ${config.oauth.enabled ? "enabled" : "disabled"}`);
}

process.on("SIGINT", () => {
  console.warn('Received SIGINT. Exiting...');
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.warn('Received SIGTERM. Exiting...');
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
