export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private static instances: Map<string, RateLimiter> = new Map();
  private requests: Map<string, RequestRecord[]> = new Map();
  private config: RateLimitConfig;

  private constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Gets or creates a rate limiter instance
   */
  static getInstance(config: RateLimitConfig): RateLimiter {
    const key = config.identifier || 'default';
    
    if (!this.instances.has(key)) {
      this.instances.set(key, new RateLimiter(config));
    }
    
    return this.instances.get(key)!;
  }

  /**
   * Checks if a request is allowed and updates the counter
   */
  async checkLimit(identifier: string = 'global'): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create request records for this identifier
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const records = this.requests.get(identifier)!;

    // Remove old records outside the window
    const validRecords = records.filter(r => r.timestamp > windowStart);
    this.requests.set(identifier, validRecords);

    // Count requests in the current window
    const requestCount = validRecords.reduce((sum, r) => sum + r.count, 0);

    // Check if limit is exceeded
    if (requestCount >= this.config.maxRequests) {
      const oldestRecord = validRecords[0];
      const resetAt = new Date(oldestRecord.timestamp + this.config.windowMs);
      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Add new request record
    validRecords.push({
      timestamp: now,
      count: 1,
    });

    const remaining = this.config.maxRequests - requestCount - 1;
    const resetAt = new Date(now + this.config.windowMs);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Resets the rate limit for a specific identifier
   */
  reset(identifier: string = 'global'): void {
    this.requests.delete(identifier);
  }

  /**
   * Gets current statistics
   */
  getStats(): {
    identifiers: string[];
    totalRequests: number;
    config: RateLimitConfig;
  } {
    let totalRequests = 0;
    const identifiers: string[] = [];

    this.requests.forEach((records, id) => {
      identifiers.push(id);
      totalRequests += records.reduce((sum, r) => sum + r.count, 0);
    });

    return {
      identifiers,
      totalRequests,
      config: this.config,
    };
  }

  /**
   * Clears all rate limit data
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * Notion API specific rate limiter
 */
export class NotionRateLimiter {
  private static limiter = RateLimiter.getInstance({
    maxRequests: 60, // Notion's default rate limit
    windowMs: 60000, // 1 minute
    identifier: 'notion-api',
  });

  /**
   * Checks if a Notion API request is allowed
   */
  static async check(operation?: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
  }> {
    // Use operation-specific limits if needed
    const identifier = operation || 'global';
    const result = await this.limiter.checkLimit(identifier);

    if (!result.allowed) {
      console.warn(`⚠️ Rate limit exceeded for ${identifier}:`, {
        resetAt: result.resetAt,
        retryAfter: result.retryAfter,
      });
    }

    return result;
  }

  /**
   * Waits if rate limited
   */
  static async waitIfLimited(operation?: string): Promise<void> {
    const result = await this.check(operation);
    
    if (!result.allowed && result.retryAfter) {
      console.log(`⏳ Rate limited. Waiting ${result.retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, result.retryAfter! * 1000));
    }
  }

  /**
   * Gets rate limit statistics
   */
  static getStats() {
    return this.limiter.getStats();
  }

  /**
   * Resets rate limits
   */
  static reset(operation?: string): void {
    this.limiter.reset(operation || 'global');
  }
}

/**
 * Decorator for rate-limited functions
 */
export function rateLimited(
  maxRequests: number = 60,
  windowMs: number = 60000
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const limiter = RateLimiter.getInstance({
      maxRequests,
      windowMs,
      identifier: `${target.constructor.name}.${propertyKey}`,
    });

    descriptor.value = async function (...args: any[]) {
      const result = await limiter.checkLimit();
      
      if (!result.allowed) {
        throw new Error(
          `Rate limit exceeded. Try again in ${result.retryAfter}s`
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}