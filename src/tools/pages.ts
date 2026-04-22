import { z } from 'zod';
import { Client } from '@notionhq/client';
import { createBlock } from '../utils/blocks.js';
import { createRichText } from '../utils/richText.js';
import { getTemplate, getAvailableTemplates } from '../utils/templates.js';
import {
  notionIdSchema,
  safeTitleSchema,
  blockInputSchema,
  blocksArraySchema,
  templateVariablesSchema,
  getConfiguredRootParentOrThrow,
  loadRuntimeSecurityConfig,
} from '../security/runtimePolicy.js';

const templateSchema = z.enum(['meeting_notes', 'project_plan', 'documentation', 'article', 'weekly_report', 'bug_report']);
const contentTypeSchema = z.enum(['template', 'rich', 'basic']);

// Enhanced schemas for new tools
export const CreateRichPageSchema = z.object({
  parent_page_id: notionIdSchema.describe('Parent page ID where the new page will be created'),
  title: safeTitleSchema.describe('Title of the new page'),
  blocks: blocksArraySchema.optional().describe('Array of blocks to create the page content'),
});

export const CreatePageFromTemplateSchema = z.object({
  parent_page_id: notionIdSchema.describe('Parent page ID where the new page will be created'),
  title: safeTitleSchema.describe('Title of the new page'),
  template: templateSchema.describe('Template type to use'),
  variables: templateVariablesSchema.describe('Variables to customize the template (e.g., {date: "2024-01-15", author: "João"})'),
});

export const AddContentBlocksSchema = z.object({
  page_id: notionIdSchema.describe('Page ID to add content to'),
  blocks: blocksArraySchema.describe('Array of blocks to add to the page'),
  position: z.enum(['append']).default('append').describe('Where to add the blocks. Only append is supported at runtime.'),
});

export const ListTemplatesSchema = z.object({});

export const CreateRootPageSchema = z.object({
  title: safeTitleSchema.describe('Title of the new page'),
  content_type: contentTypeSchema.default('rich').describe('Type of content to create'),
  template: templateSchema.optional().describe('Template to use if content_type is template'),
  variables: templateVariablesSchema.describe('Variables for template customization'),
  blocks: blocksArraySchema.optional().describe('Custom blocks if content_type is rich'),
}).superRefine((value, ctx) => {
  if (value.content_type === 'template' && !value.template) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Template is required when content_type is "template"',
      path: ['template'],
    });
  }
});

export async function getWorkspaceParent(): Promise<string> {
  const config = loadRuntimeSecurityConfig();
  return getConfiguredRootParentOrThrow(config);
}

function toNotionBlock(block: z.infer<typeof blockInputSchema>) {
  const richText = block.annotations
    ? [createRichText(block.content, block.annotations)]
    : [createRichText(block.content)];

  switch (block.type) {
    case 'callout':
      return createBlock('callout', richText, {
        icon: block.icon || '💡',
        color: block.annotations?.color || 'default',
      });
    case 'code':
      return createBlock('code', block.content, {
        language: block.language || 'javascript',
      });
    case 'to_do':
      return createBlock('to_do', richText, {
        checked: block.checked || false,
        color: block.annotations?.color || 'default',
      });
    case 'divider':
      return createBlock('divider');
    default:
      return createBlock(block.type, richText, {
        color: block.annotations?.color || 'default',
      });
  }
}

function buildPageChildren(args: z.infer<typeof CreateRootPageSchema>): any[] {
  const { content_type, template, variables = {}, blocks = [] } = args;

  switch (content_type) {
    case 'template':
      return getTemplate(template!, variables);
    case 'rich':
      return blocks.length > 0
        ? blocks.map(toNotionBlock)
        : [createBlock('paragraph', 'Página criada com o servidor MCP Notion.')];
    case 'basic':
    default:
      return [createBlock('paragraph', 'Página criada com o servidor MCP Notion.')];
  }
}

export async function createRootPage(notion: Client, args: z.infer<typeof CreateRootPageSchema>) {
  const config = loadRuntimeSecurityConfig();
  const parentId = getConfiguredRootParentOrThrow(config);
  const pageChildren = buildPageChildren(args);

  return notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ text: { content: args.title } }],
      },
    },
    children: pageChildren,
  });
}

export async function createRichPage(notion: Client, args: z.infer<typeof CreateRichPageSchema>) {
  const { parent_page_id, title, blocks = [] } = args;

  const pageData: any = {
    parent: { page_id: parent_page_id },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
  };

  if (blocks.length > 0) {
    pageData.children = blocks.map(toNotionBlock);
  }

  return notion.pages.create(pageData);
}

export async function createPageFromTemplate(notion: Client, args: z.infer<typeof CreatePageFromTemplateSchema>) {
  const { parent_page_id, title, template, variables = {} } = args;

  return notion.pages.create({
    parent: { page_id: parent_page_id },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
    children: getTemplate(template, variables),
  });
}

export async function addContentBlocks(notion: Client, args: z.infer<typeof AddContentBlocksSchema>) {
  const { page_id, blocks } = args;

  return notion.blocks.children.append({
    block_id: page_id,
    children: blocks.map(toNotionBlock),
  });
}

export async function listTemplates() {
  return getAvailableTemplates();
}

export function formatPageResponse(page: any, action: string = 'criada'): string {
  const title = page.properties?.title?.title?.[0]?.text?.content || 'Sem título';
  const url = page.url;
  const pageId = page.id;
  const lastEdited = new Date(page.last_edited_time).toLocaleDateString('pt-BR');

  return `✅ **Página ${action} com sucesso!**

📄 **Título:** ${title}
🆔 **ID:** ${pageId}
🔗 **URL:** ${url}
📅 **Última edição:** ${lastEdited}`;
}

export function formatBlocksResponse(response: any, pageId: string): string {
  const blocksCount = response.results?.length || 0;

  return `✅ **Conteúdo adicionado com sucesso!**

📄 **Page ID:** ${pageId}
📦 **Blocos adicionados:** ${blocksCount}
📍 **Posição:** append`;
}

function extractBlockPreview(block: any): string {
  if (!block || typeof block !== 'object') {
    return 'Sem detalhes disponíveis';
  }

  const payload = block[block.type];
  const richText = Array.isArray(payload?.rich_text)
    ? payload.rich_text.map((item: any) => item?.plain_text || '').join('')
    : '';

  if (richText.trim()) {
    return richText.trim().slice(0, 140);
  }

  if (block.type === 'code') {
    return String(payload?.rich_text?.[0]?.plain_text || '').trim().slice(0, 140) || 'Bloco de código';
  }

  if (block.type === 'divider') {
    return 'Separador';
  }

  return 'Conteúdo não textual';
}

export function formatPageContentResponse(blocks: any): string {
  const results = Array.isArray(blocks.results) ? blocks.results : [];
  const blockTypes = Array.from(new Set(results.map((block: any) => block.type))).join(', ') || 'nenhum';
  const preview = results.length > 0
    ? results.slice(0, 10).map((block: any, index: number) => `${index + 1}. [${block.type}] ${extractBlockPreview(block)}`).join('\n')
    : 'Nenhum bloco encontrado.';

  return `📦 **Conteúdo da Página:**

**Total de blocos:** ${results.length}
**Tipos de bloco:** ${blockTypes}
**Prévia:**
${preview}`;
}
