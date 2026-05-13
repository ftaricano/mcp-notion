import { Client } from '@notionhq/client';
import { z } from 'zod';
import {
  AddContentBlocksSchema,
  CreatePageFromTemplateSchema,
  CreateRichPageSchema,
  CreateRootPageSchema,
  addContentBlocks,
  createPageFromTemplate,
  createRichPage,
  createRootPage,
  formatBlocksResponse,
  formatPageContentResponse,
  formatPageResponse,
  listTemplates,
} from './tools/pages.js';
import {
  assertPageAccess,
  auditOperation,
  enforceRateLimit,
  loadRuntimeSecurityConfig,
  notionIdSchema,
  optionalPlainContentSchema,
  safeTitleSchema,
  searchQuerySchema,
  validateTokenIfEnabled,
} from './security/runtimePolicy.js';
import {
  ErrorLogger,
  NotionMCPError,
  ErrorType,
  classifyError,
  generateCorrelationId,
  sanitizeErrorForUser,
  withRetry,
} from './utils/errorHandler.js';

let notion: Client | undefined;

export async function initializeNotion() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new NotionMCPError(
      'NOTION_TOKEN environment variable is required',
      ErrorType.AUTH,
      { operation: 'initialize_notion' },
      undefined,
      false
    );
  }

  const runtimeSecurityConfig = loadRuntimeSecurityConfig();
  await validateTokenIfEnabled(token, runtimeSecurityConfig);

  notion = new Client({ auth: token });
  return notion;
}

export function getCachedNotionClient() {
  return notion;
}

export const SearchPagesSchema = z.object({
  query: searchQuerySchema.describe('Text to search for in page titles'),
  page_size: z.number().int().min(1).max(100).optional().default(10).describe('Number of results to return'),
});

export const GetPageSchema = z.object({
  page_id: notionIdSchema.describe('Notion page ID'),
});

export const GetPageContentSchema = z.object({
  page_id: notionIdSchema.describe('Notion page ID'),
});

export const CreatePageSchema = z.object({
  parent_page_id: notionIdSchema.describe('Parent page ID where the new page will be created'),
  title: safeTitleSchema.describe('Title of the new page'),
  content: optionalPlainContentSchema.describe('Initial content for the page'),
});

export const UpdatePageSchema = z.object({
  page_id: notionIdSchema.describe('Page ID to update'),
  title: safeTitleSchema.optional().describe('New title for the page'),
});

export interface NotionToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const blockItemsSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['heading_1', 'heading_2', 'heading_3', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'quote', 'divider', 'code'],
      description: 'Type of content block',
    },
    content: {
      type: 'string',
      description: 'Text content of the block',
    },
    annotations: {
      type: 'object',
      properties: {
        bold: { type: 'boolean' },
        italic: { type: 'boolean' },
        code: { type: 'boolean' },
        color: { type: 'string' },
      },
      description: 'Text formatting options',
    },
    language: {
      type: 'string',
      description: 'Programming language for code blocks',
    },
    icon: {
      type: 'string',
      description: 'Emoji icon for callouts',
    },
    checked: {
      type: 'boolean',
      description: 'Checked state for to-do items',
    },
  },
  required: ['type'],
};

export const NOTION_TOOLS: NotionToolDefinition[] = [
  {
    name: 'search_pages',
    description: 'Search for Notion pages by title',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for in page titles' },
        page_size: { type: 'number', description: 'Number of results to return', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_page',
    description: 'Get basic information about a Notion page',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Notion page ID' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'get_page_content',
    description: 'Get the content/blocks of a Notion page',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Notion page ID' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'create_page',
    description: 'Create a new Notion page (basic - use create_rich_page for better formatting)',
    inputSchema: {
      type: 'object',
      properties: {
        parent_page_id: { type: 'string', description: 'Parent page ID where the new page will be created' },
        title: { type: 'string', description: 'Title of the new page' },
        content: { type: 'string', description: 'Initial content for the page' },
      },
      required: ['parent_page_id', 'title'],
    },
  },
  {
    name: 'update_page',
    description: 'Update a Notion page title',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Page ID to update' },
        title: { type: 'string', description: 'New title for the page' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'create_rich_page',
    description: 'Create a formatted Notion page with rich content blocks',
    inputSchema: {
      type: 'object',
      properties: {
        parent_page_id: { type: 'string', description: 'Parent page ID where the new page will be created' },
        title: { type: 'string', description: 'Title of the new page' },
        blocks: { type: 'array', description: 'Array of formatted content blocks', items: blockItemsSchema },
      },
      required: ['parent_page_id', 'title'],
    },
  },
  {
    name: 'create_page_from_template',
    description: 'Create a page using a built-in template',
    inputSchema: {
      type: 'object',
      properties: {
        parent_page_id: { type: 'string', description: 'Parent page ID where the new page will be created' },
        title: { type: 'string', description: 'Title of the new page' },
        template: {
          type: 'string',
          enum: ['meeting_notes', 'project_plan', 'documentation', 'article', 'weekly_report', 'bug_report'],
          description: 'Template type to use for creating the page',
        },
        variables: {
          type: 'object',
          description: 'Variables to customize the template',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['parent_page_id', 'title', 'template'],
    },
  },
  {
    name: 'add_content_blocks',
    description: 'Add formatted content blocks to an existing Notion page',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Page ID to add content to' },
        blocks: { type: 'array', description: 'Array of formatted content blocks to add', items: blockItemsSchema },
        position: {
          type: 'string',
          enum: ['append'],
          default: 'append',
          description: 'Where to add the blocks. Runtime currently supports append only.',
        },
      },
      required: ['page_id', 'blocks'],
    },
  },
  {
    name: 'list_templates',
    description: 'List all available page templates with descriptions',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_root_page',
    description: 'Create a page under a configured root parent',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the new page' },
        content_type: {
          type: 'string',
          enum: ['template', 'rich', 'basic'],
          default: 'rich',
          description: 'Type of content to create',
        },
        template: {
          type: 'string',
          enum: ['meeting_notes', 'project_plan', 'documentation', 'article', 'weekly_report', 'bug_report'],
          description: 'Template to use if content_type is template',
        },
        variables: {
          type: 'object',
          description: 'Variables for template customization',
          additionalProperties: { type: 'string' },
        },
        blocks: { type: 'array', description: 'Custom formatted content blocks if content_type is rich', items: blockItemsSchema },
      },
      required: ['title'],
    },
  },
];

export const TOOL_MAP = new Map(NOTION_TOOLS.map((tool) => [tool.name, tool]));

export function getToolDefinition(name: string) {
  return TOOL_MAP.get(name);
}

function formatSearchResults(response: any, query: string) {
  const pages = response.results.map((page: any) => {
    const title = page.properties?.title?.title?.[0]?.text?.content || 'Sem título';
    return {
      id: page.id,
      title,
      url: page.url,
      last_edited: new Date(page.last_edited_time).toLocaleDateString('pt-BR'),
    };
  });

  return `🔍 **Resultados da busca para "${query}":**\n\n${pages.map((page: any, index: number) => `${index + 1}. **${page.title}**\n   📄 ID: ${page.id}\n   🔗 URL: ${page.url}\n   📅 Última edição: ${page.last_edited}`).join('\n\n')}`;
}

export async function executeTool(name: string, args: unknown) {
  const correlationId = generateCorrelationId();
  const runtimeSecurityConfig = loadRuntimeSecurityConfig();
  const pageIdFromArgs = typeof (args as Record<string, unknown> | undefined)?.page_id === 'string'
    ? (args as Record<string, string>).page_id
    : typeof (args as Record<string, unknown> | undefined)?.parent_page_id === 'string'
      ? (args as Record<string, string>).parent_page_id
      : undefined;

  try {
    if (!notion) {
      notion = await initializeNotion();
    }

    const notionClient = notion as Client;
    await enforceRateLimit(name, runtimeSecurityConfig);
    if (pageIdFromArgs) {
      assertPageAccess(pageIdFromArgs, runtimeSecurityConfig, name);
    }

    switch (name) {
      case 'search_pages': {
        const { query, page_size } = SearchPagesSchema.parse(args);
        const response = await withRetry(
          () => notionClient.search({
            query,
            page_size,
            filter: {
              property: 'object',
              value: 'page',
            },
          }),
          { operation: 'search_pages', params: { query, page_size }, correlationId },
          3,
          1000
        );

        auditOperation({ operation: name, success: true }, runtimeSecurityConfig);
        return { content: [{ type: 'text', text: formatSearchResults(response, query) }] };
      }
      case 'get_page': {
        const { page_id } = GetPageSchema.parse(args);
        const page = await notionClient.pages.retrieve({ page_id }) as any;
        const title = page.properties?.title?.title?.[0]?.text?.content || 'Sem título';
        const lastEdited = new Date(page.last_edited_time).toLocaleDateString('pt-BR');

        auditOperation({ operation: name, pageId: page_id, success: true }, runtimeSecurityConfig);
        return {
          content: [{
            type: 'text',
            text: `📄 **Informações da Página:**\n\n**Título:** ${title}\n**ID:** ${page.id}\n**URL:** ${page.url}\n**Última edição:** ${lastEdited}\n**Criado em:** ${new Date(page.created_time).toLocaleDateString('pt-BR')}`,
          }],
        };
      }
      case 'get_page_content': {
        const { page_id } = GetPageContentSchema.parse(args);
        const blocks = await notionClient.blocks.children.list({ block_id: page_id });
        auditOperation({ operation: name, pageId: page_id, success: true }, runtimeSecurityConfig);
        return { content: [{ type: 'text', text: formatPageContentResponse(blocks) }] };
      }
      case 'create_page': {
        const { parent_page_id, title, content } = CreatePageSchema.parse(args);
        const pageData: any = {
          parent: { page_id: parent_page_id },
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
          },
        };

        if (content) {
          pageData.children = [{
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content } }],
            },
          }];
        }

        const page = await notionClient.pages.create(pageData);
        auditOperation({ operation: name, pageId: parent_page_id, success: true }, runtimeSecurityConfig);
        return {
          content: [{
            type: 'text',
            text: `${formatPageResponse(page)}\n\n💡 **Dica:** Use \`create_rich_page\` ou \`create_page_from_template\` para páginas com formatação profissional!`,
          }],
        };
      }
      case 'update_page': {
        const { page_id, title } = UpdatePageSchema.parse(args);
        const updateData: any = {};
        if (title) {
          updateData.properties = {
            title: {
              title: [{ text: { content: title } }],
            },
          };
        }

        const page = await notionClient.pages.update({ page_id, ...updateData });
        auditOperation({ operation: name, pageId: page_id, success: true }, runtimeSecurityConfig);
        return { content: [{ type: 'text', text: formatPageResponse(page, 'atualizada') }] };
      }
      case 'create_rich_page': {
        const parsedArgs = CreateRichPageSchema.parse(args);
        const page = await createRichPage(notionClient, parsedArgs);
        auditOperation({ operation: name, pageId: parsedArgs.parent_page_id, success: true }, runtimeSecurityConfig);
        return { content: [{ type: 'text', text: formatPageResponse(page) }] };
      }
      case 'create_page_from_template': {
        const parsedArgs = CreatePageFromTemplateSchema.parse(args);
        const page = await createPageFromTemplate(notionClient, parsedArgs);
        auditOperation({ operation: name, pageId: parsedArgs.parent_page_id, success: true }, runtimeSecurityConfig);
        return {
          content: [{
            type: 'text',
            text: `${formatPageResponse(page)}\n\n📋 **Template usado:** ${parsedArgs.template}\n🎨 **Sua página agora tem estrutura profissional e visual organizada!**`,
          }],
        };
      }
      case 'add_content_blocks': {
        const parsedArgs = AddContentBlocksSchema.parse(args);
        const response = await addContentBlocks(notionClient, parsedArgs);
        auditOperation({ operation: name, pageId: parsedArgs.page_id, success: true }, runtimeSecurityConfig);
        return { content: [{ type: 'text', text: formatBlocksResponse(response, parsedArgs.page_id) }] };
      }
      case 'list_templates': {
        const templates = await listTemplates();
        auditOperation({ operation: name, success: true }, runtimeSecurityConfig);
        return {
          content: [{
            type: 'text',
            text: `📚 **Templates Disponíveis:**\n\n${templates.map((template, index) => `${index + 1}. **${template.name}** (${template.type})\n   ${template.description}`).join('\n\n')}\n\n💡 **Como usar:** Use \`create_page_from_template\` ou \`create_root_page\` com o tipo desejado!`,
          }],
        };
      }
      case 'create_root_page': {
        const parsedArgs = CreateRootPageSchema.parse(args);
        const page = await createRootPage(notionClient, parsedArgs);
        auditOperation({ operation: name, success: true }, runtimeSecurityConfig);
        return {
          content: [{
            type: 'text',
            text: `${formatPageResponse(page)}\n\n🌟 **Página independente criada!**\n📋 **Tipo de conteúdo:** ${parsedArgs.content_type}\n🎨 **Sua página agora está no workspace com formatação profissional!**`,
          }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const normalizedError = error instanceof NotionMCPError
      ? error
      : new NotionMCPError(
          error instanceof Error ? error.message : 'Unknown error occurred',
          classifyError(error),
          { operation: name, correlationId },
          error instanceof Error ? error : undefined,
          false
        );

    ErrorLogger.log(normalizedError);
    auditOperation({ operation: name, pageId: pageIdFromArgs, success: false, error: normalizedError.type }, runtimeSecurityConfig);

    const safeMessage = normalizedError.userMessage || sanitizeErrorForUser(normalizedError);
    return {
      content: [{ type: 'text', text: `${safeMessage}\n\n🪪 **Correlation ID:** ${correlationId}` }],
      isError: true,
    };
  }
}
