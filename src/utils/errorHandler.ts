import { APIResponseError } from '@notionhq/client';

export enum ErrorType {
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent',
  AUTH = 'auth',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  operation: string;
  params?: any;
  attempt?: number;
  maxAttempts?: number;
  correlationId?: string;
}

export class NotionMCPError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(
    message: string,
    type: ErrorType,
    context: ErrorContext,
    originalError?: Error,
    retryable = false
  ) {
    super(message);
    this.name = 'NotionMCPError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.retryable = retryable;
    this.userMessage = this.getUserFriendlyMessage();
  }

  private getUserFriendlyMessage(): string {
    const messages = {
      [ErrorType.AUTH]: '❌ **Erro de autenticação:** Verifique se o token do Notion está configurado corretamente.',
      [ErrorType.RATE_LIMIT]: '⏳ **Limite de requisições excedido:** Aguarde alguns segundos e tente novamente.',
      [ErrorType.VALIDATION]: '⚠️ **Dados inválidos:** Verifique os parâmetros fornecidos.',
      [ErrorType.NETWORK]: '🌐 **Erro de conexão:** Verifique sua conexão com a internet.',
      [ErrorType.TEMPORARY]: '🔄 **Erro temporário:** O sistema está tentando novamente...',
      [ErrorType.PERMANENT]: '❌ **Erro permanente:** Esta operação não pode ser completada.',
      [ErrorType.UNKNOWN]: '❓ **Erro desconhecido:** Algo inesperado aconteceu.',
    };

    return messages[this.type] || messages[ErrorType.UNKNOWN];
  }
}

export function classifyError(error: any): ErrorType {
  if (error instanceof APIResponseError) {
    const code = String((error as any).code || '');
    if (code === 'unauthorized' || code === 'restricted_resource') return ErrorType.AUTH;
    if (code === 'rate_limited') return ErrorType.RATE_LIMIT;
    if (code === 'invalid_request' || code === 'validation_error' || code === 'missing_version') return ErrorType.VALIDATION;
    if (code === 'object_not_found' || code === 'database_not_found' || code === 'page_not_found' || code === 'block_not_found' || code === 'user_not_found') return ErrorType.PERMANENT;
    if (code === 'conflict_error' || code === 'internal_server_error' || code === 'service_unavailable') return ErrorType.TEMPORARY;
    return ErrorType.UNKNOWN;
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return ErrorType.NETWORK;
  }

  if (error.message?.includes('rate') || error.message?.includes('limit')) {
    return ErrorType.RATE_LIMIT;
  }

  if (error.message?.includes('auth') || error.message?.includes('token')) {
    return ErrorType.AUTH;
  }

  return ErrorType.UNKNOWN;
}

export function isRetryableError(error: any): boolean {
  const errorType = classifyError(error);
  return [
    ErrorType.TEMPORARY,
    ErrorType.RATE_LIMIT,
    ErrorType.NETWORK,
  ].includes(errorType);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      context.attempt = attempt;
      context.maxAttempts = maxAttempts;
      
      const result = await operation();
      
      // Success - log if it was a retry
      if (attempt > 1) {
        console.log(`✅ Operation succeeded on attempt ${attempt}:`, context.operation);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      const errorType = classifyError(error);
      const isRetryable = isRetryableError(error);
      
      // Log error details
      console.error(`❌ Attempt ${attempt}/${maxAttempts} failed:`, {
        operation: context.operation,
        errorType,
        message: lastError.message,
        retryable: isRetryable,
      });
      
      // Don't retry if not retryable or last attempt
      if (!isRetryable || attempt === maxAttempts) {
        throw new NotionMCPError(
          `Operation failed after ${attempt} attempt(s): ${lastError.message}`,
          errorType,
          context,
          lastError,
          false
        );
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateBackoffDelay(attempt, baseDelay, errorType);
      
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError;
}

function calculateBackoffDelay(attempt: number, baseDelay: number, errorType: ErrorType): number {
  // Rate limit errors get longer delays
  if (errorType === ErrorType.RATE_LIMIT) {
    return Math.min(baseDelay * Math.pow(2, attempt) * 2, 60000); // Max 1 minute
  }
  
  // Regular exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateCorrelationId(): string {
  return `mcp-notion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sanitizeErrorForUser(error: any): string {
  // Remove sensitive information from error messages
  let message = error.message || 'Unknown error';
  
  // Remove token references
  message = message.replace(/token[:\s]*[^\s]+/gi, 'token: [REDACTED]');
  
  // Remove IDs that might be sensitive
  message = message.replace(/[a-f0-9]{32}/gi, '[ID]');
  
  // Remove URLs that might contain sensitive data
  message = message.replace(/https?:\/\/[^\s]+/gi, '[URL]');
  
  return message;
}

export class ErrorLogger {
  private static errors: Array<{
    timestamp: Date;
    error: NotionMCPError;
    resolved: boolean;
  }> = [];
  
  static log(error: NotionMCPError): void {
    this.errors.push({
      timestamp: new Date(),
      error,
      resolved: false,
    });
    
    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }
  }
  
  static markResolved(correlationId: string): void {
    const entry = this.errors.find(e => e.error.context.correlationId === correlationId);
    if (entry) {
      entry.resolved = true;
    }
  }
  
  static getRecentErrors(limit = 10): typeof ErrorLogger.errors {
    return this.errors.slice(-limit);
  }
  
  static getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    resolved: number;
    unresolved: number;
  } {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<ErrorType, number>,
      resolved: 0,
      unresolved: 0,
    };
    
    for (const entry of this.errors) {
      stats.byType[entry.error.type] = (stats.byType[entry.error.type] || 0) + 1;
      if (entry.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }
    }
    
    return stats;
  }
}