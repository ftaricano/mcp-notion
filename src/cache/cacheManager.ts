import crypto from 'crypto';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
}

export abstract class CacheStrategy {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
  abstract delete(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract getStats(): CacheStats;
  abstract invalidateByTag(tag: string): Promise<number>;
}

/**
 * In-memory cache implementation
 */
export class MemoryCacheStrategy extends CacheStrategy {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    entries: 0,
    hitRate: 0,
  };
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 300000) {
    super();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry is expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateHitRate();
      return null;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const size = this.estimateSize(value);
    
    // Evict entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
      size,
      tags,
    };

    this.cache.set(key, entry);
    this.stats.entries = this.cache.size;
    this.stats.size += size;
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.size -= entry.size;
      this.cache.delete(key);
      this.stats.entries = this.cache.size;
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
    };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        this.cache.delete(key);
        this.stats.size -= entry.size;
        invalidated++;
      }
    }
    
    this.stats.entries = this.cache.size;
    return invalidated;
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();
    let lruHits = Infinity;

    // Find least recently used entry
    for (const [key, entry] of this.cache.entries()) {
      const lastAccess = entry.timestamp;
      if (lastAccess < lruTime || (lastAccess === lruTime && entry.hits < lruHits)) {
        lruKey = key;
        lruTime = lastAccess;
        lruHits = entry.hits;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey)!;
      this.stats.size -= entry.size;
      this.cache.delete(lruKey);
      this.stats.evictions++;
      this.stats.entries = this.cache.size;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.stats.size -= entry.size;
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.stats.entries = this.cache.size;
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  private estimateSize(value: any): number {
    // Rough estimation of object size in bytes
    const str = JSON.stringify(value);
    return str ? str.length * 2 : 0; // 2 bytes per character (rough estimate)
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Main cache manager
 */
export class CacheManager {
  private static instance: CacheManager;
  private strategy: CacheStrategy;
  private enabled: boolean;

  private constructor(strategy?: CacheStrategy, enabled = true) {
    this.strategy = strategy || new MemoryCacheStrategy();
    this.enabled = enabled;
  }

  static getInstance(strategy?: CacheStrategy): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(strategy);
    }
    return CacheManager.instance;
  }

  /**
   * Generates a cache key from parameters
   */
  static generateKey(operation: string, params: any): string {
    const hash = crypto.createHash('md5');
    hash.update(operation);
    hash.update(JSON.stringify(params));
    return hash.digest('hex');
  }

  /**
   * Gets a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    return this.strategy.get<T>(key);
  }

  /**
   * Sets a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    if (!this.enabled) return;
    return this.strategy.set(key, value, ttl, tags);
  }

  /**
   * Gets or sets a value using a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`💾 Cache hit: ${key.substring(0, 8)}...`);
      return cached;
    }

    // Generate new value
    console.log(`🔄 Cache miss: ${key.substring(0, 8)}...`);
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, ttl, tags);
    
    return value;
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.enabled) return false;
    return this.strategy.delete(key);
  }

  /**
   * Clears all cache
   */
  async clear(): Promise<void> {
    return this.strategy.clear();
  }

  /**
   * Invalidates cache entries by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    if (!this.enabled) return 0;
    const count = await this.strategy.invalidateByTag(tag);
    if (count > 0) {
      console.log(`🗑️ Invalidated ${count} cache entries with tag: ${tag}`);
    }
    return count;
  }

  /**
   * Gets cache statistics
   */
  getStats(): CacheStats {
    return this.strategy.getStats();
  }

  /**
   * Enables or disables caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`💾 Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Checks if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Cache decorator for methods
 */
export function cached(ttl?: number, tags?: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = CacheManager.getInstance();

    descriptor.value = async function (...args: any[]) {
      const key = CacheManager.generateKey(
        `${target.constructor.name}.${propertyKey}`,
        args
      );

      return cache.getOrSet(
        key,
        () => originalMethod.apply(this, args),
        ttl,
        tags
      );
    };

    return descriptor;
  };
}