import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AddContentBlocksSchema,
  CreateRootPageSchema,
  createRootPage,
  getWorkspaceParent,
} from '../../src/tools/pages.js';
import { blockInputSchema, templateVariablesSchema } from '../../src/security/runtimePolicy.js';

const ROOT_ID = '33333333-3333-3333-3333-333333333333';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('schema hardening regressions', () => {
  it('requires a template when create_root_page uses template content', () => {
    expect(() => CreateRootPageSchema.parse({
      title: 'Release checklist',
      content_type: 'template',
    })).toThrow(/Template is required/);
  });

  it('rejects non-append positions for add_content_blocks', () => {
    expect(() => AddContentBlocksSchema.parse({
      page_id: ROOT_ID,
      position: 'prepend',
      blocks: [{ type: 'paragraph', content: 'blocked' }],
    })).toThrow();
  });

  it('rejects empty textual blocks but still allows divider blocks without content', () => {
    expect(() => blockInputSchema.parse({ type: 'paragraph', content: '   ' })).toThrow(/exige conteúdo textual/);
    expect(blockInputSchema.parse({ type: 'divider' })).toMatchObject({ type: 'divider', content: '' });
  });

  it('caps template variables to prevent unbounded payloads', () => {
    const variables = Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`key-${index}`, `value-${index}`]));

    expect(() => templateVariablesSchema.parse(variables)).toThrow(/no máximo 25 variáveis/);
  });
});

describe('create_root_page safety constraints', () => {
  it('uses the configured root parent id and default placeholder content', async () => {
    vi.stubEnv('NOTION_ROOT_PARENT_PAGE_ID', ROOT_ID);

    const notion = {
      pages: {
        create: vi.fn().mockResolvedValue({ id: 'page-1' }),
      },
    } as any;

    await createRootPage(notion, { title: 'Root-safe page' });

    expect(notion.pages.create).toHaveBeenCalledWith(expect.objectContaining({
      parent: { page_id: ROOT_ID },
      properties: {
        title: {
          title: [{ text: { content: 'Root-safe page' } }],
        },
      },
      children: [expect.objectContaining({ type: 'paragraph' })],
    }));
  });

  it('refuses to resolve a workspace parent when none is configured', async () => {
    await expect(getWorkspaceParent()).rejects.toThrow(/NOTION_ROOT_PARENT_PAGE_ID/);
  });

  it('refuses create_root_page when the configured root parent is blocked by policy', async () => {
    vi.stubEnv('NOTION_ROOT_PARENT_PAGE_ID', ROOT_ID);
    vi.stubEnv('BLOCKED_PAGE_IDS', ROOT_ID.replace(/-/g, ''));

    const notion = {
      pages: {
        create: vi.fn(),
      },
    } as any;

    await expect(createRootPage(notion, { title: 'Should never be created' })).rejects.toThrow(/blocked by runtime policy/);
    expect(notion.pages.create).not.toHaveBeenCalled();
  });
});
