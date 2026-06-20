import { afterEach, describe, expect, it, vi } from 'vitest';

import { safeTitleSchema, searchQuerySchema } from '../../src/security/runtimePolicy.js';
import { sanitizeErrorForUser } from '../../src/utils/errorHandler.js';

const MOCK_CALL_TOOL_SCHEMA = Symbol('CallToolRequestSchema');
const MOCK_LIST_TOOLS_SCHEMA = Symbol('ListToolsRequestSchema');

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('key input validation hardening', () => {
  it('rejects blank titles and blank search queries after trimming', () => {
    expect(() => safeTitleSchema.parse('   ')).toThrow(/título não pode ser vazio/i);
    expect(() => searchQuerySchema.parse('\n\t')).toThrow(/consulta de busca não pode ser vazia/i);
  });

  it('sanitizes raw auth/init details before showing them to users', () => {
    const sanitized = sanitizeErrorForUser(
      new Error('token fake-token-value failed for page 12345678123456781234567812345678 at https://api.notion.com/v1/pages/test')
    );

    expect(sanitized).toContain('token: [REDACTED]');
    expect(sanitized).toContain('[ID]');
    expect(sanitized).toContain('[URL]');
    expect(sanitized).not.toContain('fake-token-value');
    expect(sanitized).not.toContain('12345678123456781234567812345678');
    expect(sanitized).not.toContain('https://api.notion.com');
  });
});

describe('server auth/init error handling', () => {
  it('returns a sanitized auth error response when tool calls initialize without a token', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NOTION_TOKEN', '');

    let serverInstance: { handlers: Map<symbol, (request: any) => Promise<any>> } | undefined;

    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: class MockServer {
        handlers = new Map();

        constructor() {
          serverInstance = this as any;
        }

        setRequestHandler(schema: symbol, handler: (request: any) => Promise<any>) {
          this.handlers.set(schema, handler);
        }

        connect = vi.fn();
      },
    }));

    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: class MockTransport {},
    }));

    vi.doMock('@modelcontextprotocol/sdk/types.js', () => ({
      CallToolRequestSchema: MOCK_CALL_TOOL_SCHEMA,
      ListToolsRequestSchema: MOCK_LIST_TOOLS_SCHEMA,
    }));

    await import('../../src/index.js');

    const handler = serverInstance?.handlers.get(MOCK_CALL_TOOL_SCHEMA);
    expect(handler).toBeTypeOf('function');

    const response = await handler!({
      params: {
        name: 'search_pages',
        arguments: { query: 'release notes' },
      },
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Erro de autenticação');
    expect(response.content[0].text).toContain('Correlation ID:');
    expect(response.content[0].text).not.toContain('NOTION_TOKEN environment variable is required');
  });
});
