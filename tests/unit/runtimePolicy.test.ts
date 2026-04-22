import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertPageAccess,
  getConfiguredRootParentOrThrow,
  loadRuntimeSecurityConfig,
  type RuntimeSecurityConfig,
} from '../../src/security/runtimePolicy.js';
import { ErrorType, NotionMCPError } from '../../src/utils/errorHandler.js';

const ALLOWED_ID = '11111111-1111-1111-1111-111111111111';
const BLOCKED_ID = '22222222-2222-2222-2222-222222222222';
const ROOT_ID = '33333333-3333-3333-3333-333333333333';

function makeConfig(overrides: Partial<RuntimeSecurityConfig> = {}): RuntimeSecurityConfig {
  return {
    validateToken: false,
    maxRequestsPerMinute: 60,
    allowedPageIds: [],
    blockedPageIds: [],
    enableAuditLog: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runtime policy enforcement', () => {
  it('blocks page access even when ids use different hyphen formats', () => {
    const config = makeConfig({
      blockedPageIds: [BLOCKED_ID],
    });

    expect(() => assertPageAccess(BLOCKED_ID.replace(/-/g, ''), config, 'get_page')).toThrowError(NotionMCPError);

    try {
      assertPageAccess(BLOCKED_ID.replace(/-/g, ''), config, 'get_page');
    } catch (error) {
      const notionError = error as NotionMCPError;
      expect(notionError.type).toBe(ErrorType.AUTH);
      expect(notionError.message).toContain('blocked by runtime policy');
      expect(notionError.context).toMatchObject({
        operation: 'get_page',
        params: { pageId: BLOCKED_ID.replace(/-/g, '') },
      });
    }
  });

  it('rejects page access when allowlist is configured and target page is outside it', () => {
    const config = makeConfig({
      allowedPageIds: [ALLOWED_ID],
    });

    expect(() => assertPageAccess(ROOT_ID, config, 'update_page')).toThrow(/runtime allowlist/);
  });

  it('rejects create_root_page when configured root parent is itself blocked', () => {
    const config = makeConfig({
      rootParentPageId: ROOT_ID,
      blockedPageIds: [ROOT_ID],
    });

    expect(() => getConfiguredRootParentOrThrow(config)).toThrow(/blocked by runtime policy/);
  });
});

describe('runtime policy config loading', () => {
  it('loads and validates allowlist, blocklist, and root parent ids from env', () => {
    vi.stubEnv('VALIDATE_TOKEN', 'false');
    vi.stubEnv('MAX_REQUESTS_PER_MINUTE', '120');
    vi.stubEnv('ALLOWED_PAGE_IDS', `${ALLOWED_ID},${ROOT_ID.replace(/-/g, '')}`);
    vi.stubEnv('BLOCKED_PAGE_IDS', BLOCKED_ID);
    vi.stubEnv('NOTION_ROOT_PARENT_PAGE_ID', ROOT_ID);
    vi.stubEnv('ENABLE_AUDIT_LOG', 'false');

    expect(loadRuntimeSecurityConfig()).toEqual({
      validateToken: false,
      maxRequestsPerMinute: 120,
      allowedPageIds: [ALLOWED_ID, ROOT_ID.replace(/-/g, '')],
      blockedPageIds: [BLOCKED_ID],
      rootParentPageId: ROOT_ID,
      enableAuditLog: false,
    });
  });

  it('fails fast on invalid env page ids instead of silently accepting them', () => {
    vi.stubEnv('ALLOWED_PAGE_IDS', 'not-a-page-id');

    expect(() => loadRuntimeSecurityConfig()).toThrow(/ID de página do Notion válido/);
  });
});
