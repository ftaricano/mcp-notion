import { z } from 'zod';
import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import * as fs from 'fs';
import * as path from 'path';

// Configuration schema with validation
const ConfigSchema = z.object({
  notion: z.object({
    token: z.string().min(1, 'NOTION_TOKEN is required'),
    version: z.string().default('2022-06-28'),
    timeoutMs: z.number().default(60000),
    retryConfig: z.object({
      maxAttempts: z.number().default(3),
      baseDelay: z.number().default(1000),
      maxDelay: z.number().default(30000),
    }).default({}),
  }),
  
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(300000), // 5 minutes
    maxSize: z.number().default(100),
    strategy: z.enum(['memory', 'redis']).default('memory'),
  }).default({}),
  
  security: z.object({
    validateToken: z.boolean().default(true),
    allowedPageIds: z.array(z.string()).optional(),
    blockedPageIds: z.array(z.string()).optional(),
    maxRequestsPerMinute: z.number().default(60),
    enableAuditLog: z.boolean().default(true),
  }).default({}),
  
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    metricsEnabled: z.boolean().default(true),
    healthCheckInterval: z.number().default(60000),
  }).default({}),
  
  features: z.object({
    enableDatabaseOperations: z.boolean().default(false),
    enableBlockEditing: z.boolean().default(true),
    enableTemplates: z.boolean().default(true),
    enableRichText: z.boolean().default(true),
    experimentalFeatures: z.boolean().default(false),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: Config;
  private configPath: string;
  private watchers: Map<string, (config: Config) => void> = new Map();
  private notionClient: Client | null = null;

  private constructor() {
    this.configPath = this.findConfigFile();
    this.config = this.loadConfiguration();
    this.setupHotReload();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private findConfigFile(): string {
    const configPaths = [
      path.join(process.cwd(), '.mcp-notion.json'),
      path.join(process.cwd(), 'mcp-notion.config.json'),
      path.join(process.env.HOME || '', '.mcp-notion', 'config.json'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`📁 Using config file: ${configPath}`);
        return configPath;
      }
    }

    // No config file found, will use environment variables
    return '';
  }

  private loadConfiguration(): Config {
    // Load environment variables
    config();

    let fileConfig: any = {};
    
    // Load from config file if exists
    if (this.configPath && fs.existsSync(this.configPath)) {
      try {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(configContent);
        console.log('✅ Configuration loaded from file');
      } catch (error) {
        console.error('❌ Failed to load config file:', error);
      }
    }

    // Merge environment variables with file config (env vars take precedence)
    const mergedConfig = {
      notion: {
        token: process.env.NOTION_TOKEN || fileConfig['notion']?.['token'] || '',
        version: process.env.NOTION_API_VERSION || fileConfig['notion']?.['version'] || '2022-06-28',
        timeoutMs: parseInt(process.env.NOTION_TIMEOUT || '60000'),
        retryConfig: {
          maxAttempts: parseInt(process.env.NOTION_MAX_RETRIES || '3'),
          baseDelay: parseInt(process.env.NOTION_RETRY_DELAY || '1000'),
          maxDelay: parseInt(process.env.NOTION_MAX_RETRY_DELAY || '30000'),
        },
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.CACHE_TTL || '300000'),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100'),
        strategy: (process.env.CACHE_STRATEGY || 'memory') as 'memory' | 'redis',
      },
      security: {
        validateToken: process.env.VALIDATE_TOKEN !== 'false',
        allowedPageIds: process.env.ALLOWED_PAGE_IDS?.split(',').filter(Boolean),
        blockedPageIds: process.env.BLOCKED_PAGE_IDS?.split(',').filter(Boolean),
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60'),
        enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
      },
      features: {
        enableDatabaseOperations: process.env.ENABLE_DATABASE_OPS === 'true',
        enableBlockEditing: process.env.ENABLE_BLOCK_EDITING !== 'false',
        enableTemplates: process.env.ENABLE_TEMPLATES !== 'false',
        enableRichText: process.env.ENABLE_RICH_TEXT !== 'false',
        experimentalFeatures: process.env.EXPERIMENTAL_FEATURES === 'true',
      },
      ...fileConfig,
    };

    // Validate configuration
    try {
      return ConfigSchema.parse(mergedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Configuration validation failed:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid configuration');
      }
      throw error;
    }
  }

  private setupHotReload(): void {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return;
    }

    fs.watchFile(this.configPath, { interval: 5000 }, () => {
      console.log('🔄 Configuration file changed, reloading...');
      try {
        const newConfig = this.loadConfiguration();
        this.config = newConfig;
        this.notifyWatchers(newConfig);
        console.log('✅ Configuration reloaded successfully');
      } catch (error) {
        console.error('❌ Failed to reload configuration:', error);
      }
    });
  }

  getConfig(): Config {
    return this.config;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  async validateNotionToken(): Promise<boolean> {
    if (!this.config.security.validateToken) {
      return true;
    }

    try {
      if (!this.notionClient) {
        this.notionClient = new Client({
          auth: this.config.notion.token,
          notionVersion: this.config.notion.version,
          timeoutMs: this.config.notion.timeoutMs,
        });
      }

      // Test the token by fetching the current user
      const user = await this.notionClient.users.me({});
      console.log(`✅ Notion token validated for user: ${user.name || user.id}`);
      return true;
    } catch (error) {
      console.error('❌ Notion token validation failed:', error);
      return false;
    }
  }

  getNotionClient(): Client {
    if (!this.notionClient) {
      this.notionClient = new Client({
        auth: this.config.notion.token,
        notionVersion: this.config.notion.version,
        timeoutMs: this.config.notion.timeoutMs,
      });
    }
    return this.notionClient;
  }

  isPageAllowed(pageId: string): boolean {
    const { allowedPageIds, blockedPageIds } = this.config.security;

    // Check if page is blocked
    if (blockedPageIds && blockedPageIds.includes(pageId)) {
      return false;
    }

    // If allowlist is defined, check if page is in it
    if (allowedPageIds && allowedPageIds.length > 0) {
      return allowedPageIds.includes(pageId);
    }

    // Default: allow if not blocked and no allowlist defined
    return true;
  }

  isFeatureEnabled(feature: keyof Config['features']): boolean {
    return this.config.features[feature] === true;
  }

  watch(id: string, callback: (config: Config) => void): void {
    this.watchers.set(id, callback);
  }

  unwatch(id: string): void {
    this.watchers.delete(id);
  }

  private notifyWatchers(config: Config): void {
    this.watchers.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in config watcher:', error);
      }
    });
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  saveConfig(): void {
    if (!this.configPath) {
      this.configPath = path.join(process.cwd(), '.mcp-notion.json');
    }

    try {
      fs.writeFileSync(this.configPath, this.exportConfig());
      console.log(`✅ Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error('❌ Failed to save configuration:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const configManager = ConfigurationManager.getInstance();