import { Client } from '@notionhq/client';
import crypto from 'crypto';

export interface TokenInfo {
  isValid: boolean;
  userId?: string;
  userName?: string;
  botId?: string;
  workspaceId?: string;
  capabilities?: string[];
  expiresAt?: Date;
  lastValidated?: Date;
}

export class TokenValidator {
  private static tokenCache: Map<string, TokenInfo> = new Map();
  private static readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Validates a Notion API token
   */
  static async validate(token: string): Promise<TokenInfo> {
    // Check cache first
    const tokenHash = this.hashToken(token);
    const cached = this.tokenCache.get(tokenHash);
    
    if (cached && cached.lastValidated) {
      const age = Date.now() - cached.lastValidated.getTime();
      if (age < this.CACHE_TTL) {
        console.log('✅ Using cached token validation');
        return cached;
      }
    }

    // Validate token with Notion API
    try {
      const client = new Client({ auth: token });
      
      // Get current user info
      const user = await client.users.me({});
      
      // Get bot info if available
      let botInfo: any = null;
      try {
        const users = await client.users.list({});
        botInfo = users.results.find((u: any) => u.type === 'bot' && u.bot?.owner?.type === 'workspace');
      } catch {
        // Ignore if can't get bot info
      }

      const tokenInfo: TokenInfo = {
        isValid: true,
        userId: user.id,
        userName: user.name || undefined,
        botId: user.type === 'bot' ? user.id : botInfo?.id,
        // The Notion SDK types for bot owner/workspace are loose; use optional chaining and casting to string
        workspaceId: (user as any)?.type === 'bot'
          ? (user as any)?.bot?.owner?.workspace as string | undefined
          : (botInfo as any)?.bot?.owner?.workspace as string | undefined,
        capabilities: this.detectCapabilities(user),
        lastValidated: new Date(),
      };

      // Cache the result
      this.tokenCache.set(tokenHash, tokenInfo);
      
      console.log('✅ Token validated successfully:', {
        userId: tokenInfo.userId,
        userName: tokenInfo.userName,
        workspaceId: tokenInfo.workspaceId,
      });

      return tokenInfo;
    } catch (error: any) {
      console.error('❌ Token validation failed:', error.message);
      
      const tokenInfo: TokenInfo = {
        isValid: false,
        lastValidated: new Date(),
      };

      // Cache invalid result for shorter time (5 minutes)
      this.tokenCache.set(tokenHash, tokenInfo);
      setTimeout(() => this.tokenCache.delete(tokenHash), 300000);

      return tokenInfo;
    }
  }

  /**
   * Detects token capabilities based on API responses
   */
  private static detectCapabilities(user: any): string[] {
    const capabilities: string[] = [];

    // Basic capabilities
    capabilities.push('read_pages', 'read_blocks');

    // Check for write capabilities (bot users typically have more permissions)
    if (user.type === 'bot') {
      capabilities.push(
        'write_pages',
        'write_blocks',
        'read_databases',
        'write_databases',
        'read_users',
        'read_comments',
        'write_comments'
      );
    } else {
      // Person tokens might have limited capabilities
      capabilities.push('write_pages', 'write_blocks');
    }

    return capabilities;
  }

  /**
   * Hashes a token for secure caching
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Clears the token cache
   */
  static clearCache(): void {
    this.tokenCache.clear();
    console.log('🗑️ Token cache cleared');
  }

  /**
   * Gets cache statistics
   */
  static getCacheStats(): { size: number; tokens: string[] } {
    return {
      size: this.tokenCache.size,
      tokens: Array.from(this.tokenCache.keys()).map(hash => hash.substring(0, 8) + '...'),
    };
  }
}

export class SecurityAuditor {
  private static auditLog: Array<{
    timestamp: Date;
    operation: string;
    userId?: string;
    pageId?: string;
    success: boolean;
    error?: string;
  }> = [];

  /**
   * Logs a security-relevant operation
   */
  static log(entry: {
    operation: string;
    userId?: string;
    pageId?: string;
    success: boolean;
    error?: string;
  }): void {
    const logEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.auditLog.push(logEntry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Security audit:', logEntry);
    }
  }

  /**
   * Gets recent audit entries
   */
  static getRecentEntries(limit = 100): typeof SecurityAuditor.auditLog {
    return this.auditLog.slice(-limit);
  }

  /**
   * Gets audit statistics
   */
  static getStats(): {
    total: number;
    successful: number;
    failed: number;
    byOperation: Record<string, number>;
  } {
    const stats = {
      total: this.auditLog.length,
      successful: 0,
      failed: 0,
      byOperation: {} as Record<string, number>,
    };

    for (const entry of this.auditLog) {
      if (entry.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }

      stats.byOperation[entry.operation] = (stats.byOperation[entry.operation] || 0) + 1;
    }

    return stats;
  }

  /**
   * Exports audit log to JSON
   */
  static export(): string {
    return JSON.stringify(this.auditLog, null, 2);
  }

  /**
   * Clears the audit log
   */
  static clear(): void {
    this.auditLog = [];
    console.log('🗑️ Audit log cleared');
  }
}