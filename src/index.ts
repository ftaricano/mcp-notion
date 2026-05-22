#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NOTION_TOOLS, executeTool } from './app.js';

export { initializeNotion } from './app.js';

export function createServer() {
  const server = new Server(
    {
      name: 'notion-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: NOTION_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return executeTool(name, args);
  });

  return server;
}

const server = createServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}
