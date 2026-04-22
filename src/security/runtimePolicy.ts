import { z } from 'zod';
import { RateLimiter } from './rateLimiter.js';
import { TokenValidator, SecurityAuditor } from './tokenValidator.js';
import { NotionMCPError, ErrorType } from '../utils/errorHandler.js';

const NOTION_ID_REGEX = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const NOTION_TITLE_MAX_LENGTH = 200;
const NOTION_RICH_TEXT_MAX_LENGTH = 2000;
const NOTION_MAX_BLOCKS_PER_REQUEST = 100;
const NOTION_MAX_TEMPLATE_VARIABLES = 25;
const NOTION_MAX_SEARCH_QUERY_LENGTH = 200;
const ALLOWED_COLORS = [
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
  'gray_background',
  'brown_background',
  'orange_background',
  'yellow_background',
  'green_background',
  'blue_background',
  'purple_background',
  'pink_background',
  'red_background',
] as const;

export const notionIdSchema = z.string()
  .trim()
  .regex(NOTION_ID_REGEX, 'Use um ID de página do Notion válido (UUID com ou sem hífens)');

export const safeTitleSchema = z.string()
  .trim()
  .min(1, 'O título não pode ser vazio')
  .max(NOTION_TITLE_MAX_LENGTH, `O título deve ter no máximo ${NOTION_TITLE_MAX_LENGTH} caracteres`);

export const searchQuerySchema = z.string()
  .trim()
  .min(1, 'A consulta de busca não pode ser vazia')
  .max(NOTION_MAX_SEARCH_QUERY_LENGTH, `A consulta deve ter no máximo ${NOTION_MAX_SEARCH_QUERY_LENGTH} caracteres`);

export const plainContentSchema = z.string()
  .trim()
  .min(1, 'O conteúdo não pode ser vazio')
  .max(NOTION_RICH_TEXT_MAX_LENGTH, `O conteúdo deve ter no máximo ${NOTION_RICH_TEXT_MAX_LENGTH} caracteres`);

export const optionalPlainContentSchema = z.string()
  .trim()
  .max(NOTION_RICH_TEXT_MAX_LENGTH, `O conteúdo deve ter no máximo ${NOTION_RICH_TEXT_MAX_LENGTH} caracteres`)
  .optional()
  .transform((value) => value && value.length > 0 ? value : undefined);

export const annotationsSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  underline: z.boolean().optional(),
  code: z.boolean().optional(),
  color: z.enum(ALLOWED_COLORS).optional(),
}).optional();

export const blockInputSchema = z.object({
  type: z.enum(['heading_1', 'heading_2', 'heading_3', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'callout', 'quote', 'divider', 'code']),
  content: z.string().trim().max(NOTION_RICH_TEXT_MAX_LENGTH, `Cada bloco deve ter no máximo ${NOTION_RICH_TEXT_MAX_LENGTH} caracteres`).default(''),
  annotations: annotationsSchema,
  language: z.string().trim().min(1).max(50).optional(),
  icon: z.string().trim().min(1).max(10).optional(),
  checked: z.boolean().optional(),
}).superRefine((block, ctx) => {
  const textRequired = block.type !== 'divider';
  if (textRequired && block.content.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `O bloco ${block.type} exige conteúdo textual`,
      path: ['content'],
    });
  }
});

export const blocksArraySchema = z.array(blockInputSchema)
  .min(1, 'Informe ao menos um bloco')
  .max(NOTION_MAX_BLOCKS_PER_REQUEST, `Informe no máximo ${NOTION_MAX_BLOCKS_PER_REQUEST} blocos por requisição`);

export const templateVariablesSchema = z.record(
  z.string().trim().min(1).max(100),
  z.string().trim().max(NOTION_RICH_TEXT_MAX_LENGTH)
).optional().superRefine((value, ctx) => {
  if (value && Object.keys(value).length > NOTION_MAX_TEMPLATE_VARIABLES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Informe no máximo ${NOTION_MAX_TEMPLATE_VARIABLES} variáveis de template`,
    });
  }
});

export interface RuntimeSecurityConfig {
  validateToken: boolean;
  maxRequestsPerMinute: number;
  allowedPageIds: string[];
  blockedPageIds: string[];
  rootParentPageId?: string;
  enableAuditLog: boolean;
}

let tokenValidated = false;

function normalizeNotionId(pageId: string): string {
  return pageId.replace(/-/g, '').toLowerCase();
}

function parsePageIdList(value?: string): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => notionIdSchema.parse(entry));
}

export function loadRuntimeSecurityConfig(): RuntimeSecurityConfig {
  const maxRequestsRaw = Number.parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10);
  const maxRequestsPerMinute = Number.isFinite(maxRequestsRaw) && maxRequestsRaw > 0 ? maxRequestsRaw : 60;
  const rootParentPageId = process.env.NOTION_ROOT_PARENT_PAGE_ID || process.env.MCP_NOTION_ROOT_PARENT_PAGE_ID;

  return {
    validateToken: process.env.VALIDATE_TOKEN !== 'false',
    maxRequestsPerMinute,
    allowedPageIds: parsePageIdList(process.env.ALLOWED_PAGE_IDS),
    blockedPageIds: parsePageIdList(process.env.BLOCKED_PAGE_IDS),
    rootParentPageId: rootParentPageId ? notionIdSchema.parse(rootParentPageId) : undefined,
    enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
  };
}

export async function validateTokenIfEnabled(token: string, config: RuntimeSecurityConfig): Promise<void> {
  if (!config.validateToken || tokenValidated) {
    return;
  }

  const tokenInfo = await TokenValidator.validate(token);
  if (!tokenInfo.isValid) {
    throw new NotionMCPError(
      'Notion token validation failed',
      ErrorType.AUTH,
      { operation: 'initialize_notion' },
      undefined,
      false
    );
  }

  tokenValidated = true;
}

export async function enforceRateLimit(operation: string, config: RuntimeSecurityConfig): Promise<void> {
  const limiter = RateLimiter.getInstance({
    maxRequests: config.maxRequestsPerMinute,
    windowMs: 60000,
    identifier: `runtime-${operation}-${config.maxRequestsPerMinute}`,
  });

  const result = await limiter.checkLimit(operation);
  if (!result.allowed) {
    throw new NotionMCPError(
      `Rate limit exceeded for ${operation}`,
      ErrorType.RATE_LIMIT,
      { operation },
      undefined,
      true
    );
  }
}

export function assertPageAccess(pageId: string, config: RuntimeSecurityConfig, operation: string): void {
  const normalizedPageId = normalizeNotionId(pageId);
  const blocked = config.blockedPageIds.map(normalizeNotionId);
  const allowed = config.allowedPageIds.map(normalizeNotionId);

  if (blocked.includes(normalizedPageId)) {
    throw new NotionMCPError(
      'Target page is blocked by runtime policy',
      ErrorType.AUTH,
      { operation, params: { pageId } },
      undefined,
      false
    );
  }

  if (allowed.length > 0 && !allowed.includes(normalizedPageId)) {
    throw new NotionMCPError(
      'Target page is not included in the runtime allowlist',
      ErrorType.AUTH,
      { operation, params: { pageId } },
      undefined,
      false
    );
  }
}

export function getConfiguredRootParentOrThrow(config: RuntimeSecurityConfig): string {
  if (!config.rootParentPageId) {
    throw new NotionMCPError(
      'Root page creation requires NOTION_ROOT_PARENT_PAGE_ID or MCP_NOTION_ROOT_PARENT_PAGE_ID',
      ErrorType.AUTH,
      { operation: 'create_root_page' },
      undefined,
      false
    );
  }

  assertPageAccess(config.rootParentPageId, config, 'create_root_page');
  return config.rootParentPageId;
}

export function auditOperation(entry: { operation: string; pageId?: string; success: boolean; error?: string }, config: RuntimeSecurityConfig): void {
  if (!config.enableAuditLog) {
    return;
  }

  SecurityAuditor.log({
    operation: entry.operation,
    pageId: entry.pageId,
    success: entry.success,
    error: entry.error,
  });
}
