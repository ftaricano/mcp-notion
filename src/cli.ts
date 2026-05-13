#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { loadRuntimeSecurityConfig } from './security/runtimePolicy.js';
import { formatJson, helpText, loadEnvFile, parseCliArgs, withTimeout } from './cli-support.js';

function extractText(result: { content?: Array<{ text?: string }> }) {
  return result.content?.map((item) => item.text).filter((text): text is string => Boolean(text)).join('\n\n') ?? '';
}

async function authStatus(compact: boolean) {
  const config = loadRuntimeSecurityConfig();
  const status = {
    notionTokenConfigured: Boolean(process.env.NOTION_TOKEN),
    validateToken: config.validateToken,
    rootParentConfigured: config.rootParentPageId ?? null,
    allowedPageIds: config.allowedPageIds.length,
    blockedPageIds: config.blockedPageIds.length,
    maxRequestsPerMinute: config.maxRequestsPerMinute,
    auditLogEnabled: config.enableAuditLog,
  };

  console.log(formatJson(status, compact));
}

async function authTest(compact: boolean, timeoutMs?: number) {
  const { initializeNotion } = await import('./app.js');
  const notion = await withTimeout(initializeNotion(), timeoutMs);
  const me = (await withTimeout((notion as any).users.me(), timeoutMs)) as {
    id: string;
    name?: string | null;
    type?: string | null;
  };

  const output = {
    ok: true,
    botId: me.id,
    name: me.name ?? null,
    type: me.type ?? null,
  };

  console.log(formatJson(output, compact));
}

async function runTool(toolName: string, payload: Record<string, unknown>, compact: boolean, timeoutMs?: number) {
  const { getToolDefinition, executeTool } = await import('./app.js');
  if (!getToolDefinition(toolName)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const result = await withTimeout(executeTool(toolName, payload), timeoutMs);
  const text = extractText(result);

  if (compact) {
    console.log(formatJson({ tool: toolName, ok: !result.isError, payload, text }, true));
  } else {
    console.log(text);
  }

  if (result.isError) {
    process.exitCode = 1;
  }
}

export async function cliMain(argv = process.argv.slice(2)) {
  const command = parseCliArgs(argv);

  if (command.options.envFile) {
    loadEnvFile(command.options.envFile);
  }

  switch (command.kind) {
    case 'help':
      console.log(helpText());
      return;
    case 'list': {
      const { NOTION_TOOLS } = await import('./app.js');
      if (command.options.compact) {
        console.log(formatJson(NOTION_TOOLS, true));
      } else {
        console.log(NOTION_TOOLS.map((tool) => `${tool.name}\n  ${tool.description}`).join('\n\n'));
      }
      return;
    }
    case 'schema': {
      const { getToolDefinition } = await import('./app.js');
      const tool = getToolDefinition(command.toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${command.toolName}`);
      }
      console.log(formatJson(tool.inputSchema, command.options.compact));
      return;
    }
    case 'auth-status':
      await authStatus(command.options.compact);
      return;
    case 'auth-test':
      await authTest(command.options.compact, command.options.timeoutMs);
      return;
    case 'tool':
      await runTool(command.toolName, command.payload, command.options.compact, command.options.timeoutMs);
      return;
  }
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  cliMain().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
