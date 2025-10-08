// Block creation utilities for Notion API
import { createRichText, createRichTextArray, Colors, type TextAnnotations, type RichTextElement } from './richText.js';

export type BlockType = 
  | 'paragraph'
  | 'heading_1'
  | 'heading_2' 
  | 'heading_3'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'to_do'
  | 'callout'
  | 'quote'
  | 'divider'
  | 'code'
  | 'table'
  | 'bookmark'
  | 'image'
  | 'video'
  | 'file'
  | 'toggle';

export interface BlockOptions {
  annotations?: TextAnnotations;
  color?: string;
  language?: string;
  icon?: string;
  checked?: boolean;
  toggleable?: boolean;
  children?: any[];
  caption?: string;
  url?: string;
}

/**
 * Main block factory function
 */
export function createBlock(
  type: BlockType,
  content: string | RichTextElement[] = '',
  options: BlockOptions = {}
): any {
  const richText = createRichTextArray(content);
  const base = { 
    object: 'block' as const, 
    type 
  };

  switch (type) {
    case 'paragraph':
      return {
        ...base,
        paragraph: {
          rich_text: richText,
          color: options.color || 'default',
        },
      };

    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return {
        ...base,
        [type]: {
          rich_text: richText,
          color: options.color || 'default',
          is_toggleable: options.toggleable || false,
        },
      };

    case 'bulleted_list_item':
    case 'numbered_list_item':
      return {
        ...base,
        [type]: {
          rich_text: richText,
          color: options.color || 'default',
          children: options.children || [],
        },
      };

    case 'to_do':
      return {
        ...base,
        to_do: {
          rich_text: richText,
          checked: options.checked || false,
          color: options.color || 'default',
          children: options.children || [],
        },
      };

    case 'callout':
      return {
        ...base,
        callout: {
          rich_text: richText,
          icon: options.icon ? { emoji: options.icon } : { emoji: '💡' },
          color: options.color || 'default',
          children: options.children || [],
        },
      };

    case 'quote':
      return {
        ...base,
        quote: {
          rich_text: richText,
          color: options.color || 'default',
          children: options.children || [],
        },
      };

    case 'divider':
      return {
        ...base,
        divider: {},
      };

    case 'code':
      return {
        ...base,
        code: {
          rich_text: richText,
          language: options.language || 'javascript',
          caption: options.caption ? [createRichText(options.caption)] : [],
        },
      };

    case 'toggle':
      return {
        ...base,
        toggle: {
          rich_text: richText,
          color: options.color || 'default',
          children: options.children || [],
        },
      };

    case 'bookmark':
      return {
        ...base,
        bookmark: {
          url: options.url || '',
          caption: options.caption ? [createRichText(options.caption)] : [],
        },
      };

    case 'image':
      return {
        ...base,
        image: {
          external: {
            url: options.url || '',
          },
          caption: options.caption ? [createRichText(options.caption)] : [],
        },
      };

    default:
      throw new Error(`Unsupported block type: ${type}`);
  }
}

/**
 * Quick block creation functions
 */
export const Blocks = {
  // Headers with emoji support
  h1: (text: string, emoji?: string, options?: BlockOptions) => 
    createBlock('heading_1', emoji ? `${emoji} ${text}` : text, options),
  
  h2: (text: string, emoji?: string, options?: BlockOptions) => 
    createBlock('heading_2', emoji ? `${emoji} ${text}` : text, options),
  
  h3: (text: string, emoji?: string, options?: BlockOptions) => 
    createBlock('heading_3', emoji ? `${emoji} ${text}` : text, options),

  // Content blocks
  text: (text: string, options?: BlockOptions) => 
    createBlock('paragraph', text, options),
  
  bold: (text: string, options?: BlockOptions) => 
    createBlock('paragraph', [createRichText(text, { bold: true })], options),
  
  italic: (text: string, options?: BlockOptions) => 
    createBlock('paragraph', [createRichText(text, { italic: true })], options),
  
  code: (code: string, language?: string, caption?: string) => 
    createBlock('code', code, { language, caption }),

  // Lists
  bullet: (text: string, options?: BlockOptions) => 
    createBlock('bulleted_list_item', text, options),
  
  number: (text: string, options?: BlockOptions) => 
    createBlock('numbered_list_item', text, options),
  
  todo: (text: string, checked = false, options?: BlockOptions) => 
    createBlock('to_do', text, { ...options, checked }),

  // Special blocks
  callout: (text: string, icon = '💡', color?: string) => 
    createBlock('callout', text, { icon, color }),
  
  quote: (text: string, options?: BlockOptions) => 
    createBlock('quote', text, options),
  
  divider: () => createBlock('divider'),

  // Toggle block for collapsible content
  toggle: (text: string, children: any[] = [], options?: BlockOptions) => 
    createBlock('toggle', text, { ...options, children }),

  // Media blocks
  image: (url: string, caption?: string) => 
    createBlock('image', '', { url, caption }),
  
  bookmark: (url: string, caption?: string) => 
    createBlock('bookmark', '', { url, caption }),
};

/**
 * Create a list of blocks from an array of strings
 */
export function createBulletList(items: string[]): any[] {
  return items.map(item => Blocks.bullet(item));
}

export function createNumberedList(items: string[]): any[] {
  return items.map(item => Blocks.number(item));
}

export function createTodoList(items: Array<{text: string, checked?: boolean}>): any[] {
  return items.map(item => Blocks.todo(item.text, item.checked));
}

/**
 * Create a table of contents from headings
 */
export function createTableOfContents(sections: Array<{title: string, level: 1 | 2 | 3}>): any[] {
  const toc = [
    Blocks.h2('📑 Table of Contents'),
    Blocks.divider(),
  ];

  sections.forEach(section => {
    const indent = '  '.repeat(section.level - 1);
    toc.push(Blocks.bullet(`${indent}${section.title}`));
  });

  toc.push(Blocks.divider());
  return toc;
}