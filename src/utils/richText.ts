// Rich text utilities for Notion API
export interface TextAnnotations {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
}

export interface RichTextElement {
  type: 'text';
  text: {
    content: string;
    link?: {
      url: string;
    };
  };
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text?: string;
  href?: string;
}

/**
 * Creates a rich text element with formatting annotations
 */
export function createRichText(
  content: string, 
  annotations?: TextAnnotations, 
  link?: string
): RichTextElement {
  const richText: RichTextElement = {
    type: 'text',
    text: {
      content,
    },
    annotations: {
      bold: annotations?.bold || false,
      italic: annotations?.italic || false,
      strikethrough: annotations?.strikethrough || false,
      underline: annotations?.underline || false,
      code: annotations?.code || false,
      color: annotations?.color || 'default',
    },
  };

  if (link) {
    richText.text.link = { url: link };
  }

  return richText;
}

/**
 * Creates an array of rich text elements from mixed content
 */
export function createRichTextArray(content: string | RichTextElement[]): RichTextElement[] {
  if (typeof content === 'string') {
    return [createRichText(content)];
  }
  return content;
}

/**
 * Parse markdown-like syntax for quick formatting
 * Supports: **bold**, *italic*, `code`, ~~strikethrough~~, [link](url)
 */
export function parseMarkdownText(text: string): RichTextElement[] {
  const result: RichTextElement[] = [];
  let currentIndex = 0;

  // Simple regex patterns for markdown
  const patterns = [
    { regex: /\*\*(.*?)\*\*/g, format: { bold: true } },
    { regex: /\*(.*?)\*/g, format: { italic: true } },
    { regex: /`(.*?)`/g, format: { code: true } },
    { regex: /~~(.*?)~~/g, format: { strikethrough: true } },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, format: {}, hasLink: true },
  ];

  // For now, return simple rich text
  // TODO: Implement full markdown parsing
  return [createRichText(text)];
}

/**
 * Color constants for Notion
 */
export const Colors = {
  // Text colors
  DEFAULT: 'default',
  GRAY: 'gray',
  BROWN: 'brown',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLUE: 'blue',
  PURPLE: 'purple',
  PINK: 'pink',
  RED: 'red',
  
  // Background colors
  GRAY_BACKGROUND: 'gray_background',
  BROWN_BACKGROUND: 'brown_background',
  ORANGE_BACKGROUND: 'orange_background',
  YELLOW_BACKGROUND: 'yellow_background',
  GREEN_BACKGROUND: 'green_background',
  BLUE_BACKGROUND: 'blue_background',
  PURPLE_BACKGROUND: 'purple_background',
  PINK_BACKGROUND: 'pink_background',
  RED_BACKGROUND: 'red_background',
} as const;

/**
 * Quick formatting functions
 */
export const Format = {
  bold: (text: string) => createRichText(text, { bold: true }),
  italic: (text: string) => createRichText(text, { italic: true }),
  code: (text: string) => createRichText(text, { code: true }),
  strikethrough: (text: string) => createRichText(text, { strikethrough: true }),
  underline: (text: string) => createRichText(text, { underline: true }),
  colored: (text: string, color: string) => createRichText(text, { color }),
  link: (text: string, url: string) => createRichText(text, {}, url),
};