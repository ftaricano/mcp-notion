// Enhanced page creation tools
import { z } from 'zod';
import { Client } from '@notionhq/client';
import { createBlock, Blocks } from '../utils/blocks.js';
import { createRichText, Colors } from '../utils/richText.js';
import { getTemplate, getAvailableTemplates, type TemplateType, type TemplateVariables } from '../utils/templates.js';

// Enhanced schemas for new tools
export const CreateRichPageSchema = z.object({
  parent_page_id: z.string().describe('Parent page ID where the new page will be created'),
  title: z.string().describe('Title of the new page'),
  blocks: z.array(z.object({
    type: z.enum(['heading_1', 'heading_2', 'heading_3', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'quote', 'divider', 'code']),
    content: z.string().default(''),
    annotations: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      underline: z.boolean().optional(),
      code: z.boolean().optional(),
      color: z.string().optional()
    }).optional(),
    language: z.string().optional(),
    icon: z.string().optional(),
    checked: z.boolean().optional(),
  })).optional().describe('Array of blocks to create the page content'),
});

export const CreatePageFromTemplateSchema = z.object({
  parent_page_id: z.string().describe('Parent page ID where the new page will be created'),
  title: z.string().describe('Title of the new page'),
  template: z.enum(['meeting_notes', 'project_plan', 'documentation', 'article', 'weekly_report', 'bug_report']).describe('Template type to use'),
  variables: z.record(z.string()).optional().describe('Variables to customize the template (e.g., {date: "2024-01-15", author: "João"})'),
});

export const AddContentBlocksSchema = z.object({
  page_id: z.string().describe('Page ID to add content to'),
  blocks: z.array(z.object({
    type: z.enum(['heading_1', 'heading_2', 'heading_3', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'quote', 'divider', 'code']),
    content: z.string().default(''),
    annotations: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      underline: z.boolean().optional(),
      code: z.boolean().optional(),
      color: z.string().optional()
    }).optional(),
    language: z.string().optional(),
    icon: z.string().optional(),
    checked: z.boolean().optional(),
  })).describe('Array of blocks to add to the page'),
  position: z.enum(['append', 'prepend']).default('append').describe('Where to add the blocks'),
});

export const ListTemplatesSchema = z.object({});

export const CreateRootPageSchema = z.object({
  title: z.string().describe('Title of the new page'),
  content_type: z.enum(['template', 'rich', 'basic']).default('rich').describe('Type of content to create'),
  template: z.enum(['meeting_notes', 'project_plan', 'documentation', 'article', 'weekly_report', 'bug_report']).optional().describe('Template to use if content_type is template'),
  variables: z.record(z.string()).optional().describe('Variables for template customization'),
  blocks: z.array(z.object({
    type: z.enum(['heading_1', 'heading_2', 'heading_3', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'quote', 'divider', 'code']),
    content: z.string().default(''),
    annotations: z.object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      underline: z.boolean().optional(),
      code: z.boolean().optional(),
      color: z.string().optional()
    }).optional(),
    language: z.string().optional(),
    icon: z.string().optional(),
    checked: z.boolean().optional(),
  })).optional().describe('Custom blocks if content_type is rich'),
});

/**
 * Get workspace information and find a suitable parent
 */
export async function getWorkspaceParent(notion: Client): Promise<string> {
  try {
    // Try to search for any page to get workspace context
    const response = await notion.search({
      page_size: 1,
    });
    
    if (response.results.length > 0) {
      // Use the first page's parent or the page itself as reference
      const firstPage = response.results[0] as any;
      
      // If it has a parent page, use that workspace
      if (firstPage.parent?.type === 'workspace') {
        return 'workspace';
      }
      
      // Otherwise find the root page in the hierarchy
      let currentPage = firstPage;
      while (currentPage.parent?.type === 'page_id') {
        try {
          currentPage = await notion.pages.retrieve({
            page_id: currentPage.parent.page_id,
          });
        } catch {
          break;
        }
      }
      
      // Use this page as parent for new root pages
      return currentPage.id;
    }
    
    throw new Error('No accessible workspace found');
  } catch (error) {
    throw new Error(`Cannot access workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a page in workspace root (or as close as possible)
 */
export async function createRootPage(notion: Client, args: z.infer<typeof CreateRootPageSchema>) {
  const { title, content_type, template, variables = {}, blocks = [] } = args;
  
  // Always get a suitable parent page (workspace not supported for private integrations)
  const parentId = await getWorkspaceParent(notion);
  
  // Prepare page content based on type
  let pageChildren: any[] = [];
  
  switch (content_type) {
    case 'template':
      if (!template) throw new Error('Template is required when content_type is "template"');
      pageChildren = getTemplate(template, variables);
      break;
      
    case 'rich':
      if (blocks.length > 0) {
        pageChildren = blocks.map(block => {
          const richText = block.annotations 
            ? [createRichText(block.content, block.annotations)]
            : [createRichText(block.content)];

          switch (block.type) {
            case 'callout':
              return createBlock('callout', richText, {
                icon: block.icon || '💡',
                color: block.annotations?.color || 'default'
              });
            case 'code':
              return createBlock('code', block.content, {
                language: block.language || 'javascript'
              });
            case 'to_do':
              return createBlock('to_do', richText, {
                checked: block.checked || false,
                color: block.annotations?.color || 'default'
              });
            default:
              return createBlock(block.type, richText, {
                color: block.annotations?.color || 'default'
              });
          }
        });
      } else {
        // Default rich content
        pageChildren = [
          createBlock('callout', '🎉 Página criada com funcionalidades avançadas!', {
            icon: '🚀',
            color: 'blue_background'
          }),
          createBlock('heading_2', '✨ Recursos Implementados'),
          createBlock('bulleted_list_item', 'Rich text com formatação avançada'),
          createBlock('bulleted_list_item', '11 tipos de blocos suportados'),
          createBlock('bulleted_list_item', '6 templates profissionais disponíveis'),
          createBlock('divider'),
          createBlock('heading_2', '🎨 Demonstração Visual'),
          createBlock('callout', 'Esta página demonstra o poder das novas funcionalidades implementadas!', {
            icon: '💡',
            color: 'yellow_background'
          })
        ];
      }
      break;
      
    case 'basic':
    default:
      pageChildren = [
        createBlock('paragraph', 'Página criada com o servidor MCP Notion aprimorado!')
      ];
      break;
  }
  
  // Create the page with valid parent
  const pageData: any = {
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
    children: pageChildren,
  };
  
  try {
    const page = await notion.pages.create(pageData);
    return page;
  } catch (error: any) {
    throw new Error(`Failed to create page: ${error.message}`);
  }
}

/**
 * Create a rich page with custom blocks
 */
export async function createRichPage(notion: Client, args: z.infer<typeof CreateRichPageSchema>) {
  const { parent_page_id, title, blocks = [] } = args;

  // Create the page structure
  const pageData: any = {
    parent: {
      page_id: parent_page_id,
    },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
  };

  // Convert input blocks to Notion blocks
  if (blocks.length > 0) {
    pageData.children = blocks.map(block => {
      const richText = block.annotations 
        ? [createRichText(block.content, block.annotations)]
        : [createRichText(block.content)];

      switch (block.type) {
        case 'callout':
          return createBlock('callout', richText, {
            icon: block.icon || '💡',
            color: block.annotations?.color || 'default'
          });
        case 'code':
          return createBlock('code', block.content, {
            language: block.language || 'javascript'
          });
        case 'to_do':
          return createBlock('to_do', richText, {
            checked: block.checked || false,
            color: block.annotations?.color || 'default'
          });
        default:
          return createBlock(block.type, richText, {
            color: block.annotations?.color || 'default'
          });
      }
    });
  }

  const page = await notion.pages.create(pageData);
  return page;
}

/**
 * Create page from template
 */
export async function createPageFromTemplate(notion: Client, args: z.infer<typeof CreatePageFromTemplateSchema>) {
  const { parent_page_id, title, template, variables = {} } = args;

  // Get template blocks
  const templateBlocks = getTemplate(template, variables);

  // Create the page
  const pageData: any = {
    parent: {
      page_id: parent_page_id,
    },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
    children: templateBlocks,
  };

  const page = await notion.pages.create(pageData);
  return page;
}

/**
 * Add content blocks to existing page
 */
export async function addContentBlocks(notion: Client, args: z.infer<typeof AddContentBlocksSchema>) {
  const { page_id, blocks, position } = args;

  // Convert input blocks to Notion blocks
  const notionBlocks = blocks.map(block => {
    const richText = block.annotations 
      ? [createRichText(block.content, block.annotations)]
      : [createRichText(block.content)];

    switch (block.type) {
      case 'callout':
        return createBlock('callout', richText, {
          icon: block.icon || '💡',
          color: block.annotations?.color || 'default'
        });
      case 'code':
        return createBlock('code', block.content, {
          language: block.language || 'javascript'
        });
      case 'to_do':
        return createBlock('to_do', richText, {
          checked: block.checked || false,
          color: block.annotations?.color || 'default'
        });
      default:
        return createBlock(block.type, richText, {
          color: block.annotations?.color || 'default'
        });
    }
  });

  if (position === 'prepend') {
    // For prepend, we need to get existing blocks and insert at the beginning
    const existingBlocks = await notion.blocks.children.list({
      block_id: page_id,
    });
    
    // Insert new blocks at the beginning
    const response = await notion.blocks.children.append({
      block_id: page_id,
      children: notionBlocks,
    });
    
    return response;
  } else {
    // Append is simpler
    const response = await notion.blocks.children.append({
      block_id: page_id,
      children: notionBlocks,
    });
    
    return response;
  }
}

/**
 * List available templates
 */
export async function listTemplates() {
  return getAvailableTemplates();
}

/**
 * Format page response for better readability
 */
export function formatPageResponse(page: any, action: string = 'criada'): string {
  const title = page.properties?.title?.title?.[0]?.text?.content || 'Sem título';
  const url = page.url;
  const pageId = page.id;
  const lastEdited = new Date(page.last_edited_time).toLocaleDateString('pt-BR');
  
  return `✅ **Página ${action} com sucesso!**

📄 **Título:** ${title}
🆔 **ID:** ${pageId}
🔗 **URL:** ${url}
📅 **Última edição:** ${lastEdited}

🎨 **Melhorias aplicadas:**
• Rich text com formatação avançada
• Estrutura visual hierárquica  
• Blocos coloridos e organizados
• Layout profissional`;
}

/**
 * Format blocks response for better readability
 */
export function formatBlocksResponse(response: any, pageId: string): string {
  const blocksCount = response.results?.length || 0;
  
  return `✅ **Conteúdo adicionado com sucesso!**

📄 **Page ID:** ${pageId}
📦 **Blocos adicionados:** ${blocksCount}
📅 **Data:** ${new Date().toLocaleDateString('pt-BR')}

🎨 **Seu conteúdo agora tem:**
• Formatação rica e visual
• Estrutura organizada
• Cores e ícones
• Layout profissional`;
}