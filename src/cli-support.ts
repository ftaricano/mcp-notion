import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CliOptions {
  compact: boolean;
  envFile?: string;
  timeoutMs?: number;
}

export type CliCommand =
  | { kind: 'help'; options: CliOptions }
  | { kind: 'list'; options: CliOptions }
  | { kind: 'schema'; toolName: string; options: CliOptions }
  | { kind: 'auth-status'; options: CliOptions }
  | { kind: 'auth-test'; options: CliOptions }
  | { kind: 'tool'; toolName: string; payload: Record<string, unknown>; options: CliOptions };

export function parseCliArgs(argv: string[]): CliCommand {
  const options: CliOptions = { compact: false };
  const positional: string[] = [];
  const toolArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--compact') {
      options.compact = true;
      continue;
    }

    if (token === '--env-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --env-file');
      }
      options.envFile = value;
      index += 1;
      continue;
    }

    if (token.startsWith('--env-file=')) {
      options.envFile = token.slice('--env-file='.length);
      continue;
    }

    if (token === '--timeout') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --timeout');
      }
      options.timeoutMs = parseTimeout(value);
      index += 1;
      continue;
    }

    if (token.startsWith('--timeout=')) {
      options.timeoutMs = parseTimeout(token.slice('--timeout='.length));
      continue;
    }

    if (positional.length === 0 && token.startsWith('-')) {
      throw new Error(`Unknown global option: ${token}`);
    }

    if (positional.length === 0 || (positional[0] === 'schema' && positional.length < 2) || (positional[0] === 'auth' && positional.length < 2)) {
      positional.push(token);
      continue;
    }

    toolArgs.push(token);
  }

  if (positional.length === 0 || positional[0] === 'help' || positional[0] === '--help' || positional[0] === '-h') {
    return { kind: 'help', options };
  }

  if (positional[0] === 'list') {
    return { kind: 'list', options };
  }

  if (positional[0] === 'schema') {
    const toolName = positional[1];
    if (!toolName) {
      throw new Error('Usage: notion schema <tool>');
    }
    return { kind: 'schema', toolName, options };
  }

  if (positional[0] === 'auth') {
    const subcommand = positional[1];
    if (subcommand === 'status') {
      return { kind: 'auth-status', options };
    }
    if (subcommand === 'test') {
      return { kind: 'auth-test', options };
    }
    throw new Error('Usage: notion auth <status|test>');
  }

  return {
    kind: 'tool',
    toolName: positional[0],
    payload: parseToolPayload(toolArgs),
    options,
  };
}

export function parseToolPayload(tokens: string[]) {
  const payload: Record<string, unknown> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    if (token === '--json') {
      const value = tokens[index + 1];
      if (!value) {
        throw new Error('Missing JSON payload after --json');
      }
      Object.assign(payload, JSON.parse(value));
      index += 1;
      continue;
    }

    if (token.startsWith('--json=')) {
      Object.assign(payload, JSON.parse(token.slice('--json='.length)));
      continue;
    }

    const keyValue = token.slice(2);
    const equalsIndex = keyValue.indexOf('=');
    if (equalsIndex === -1) {
      const nextValue = tokens[index + 1];
      if (!nextValue || nextValue.startsWith('--')) {
        payload[keyValue] = true;
      } else {
        payload[keyValue] = coerceValue(nextValue);
        index += 1;
      }
      continue;
    }

    const key = keyValue.slice(0, equalsIndex);
    const rawValue = keyValue.slice(equalsIndex + 1);
    payload[key] = coerceValue(rawValue);
  }

  return payload;
}

export function parseTimeout(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)(ms|s)?$/);
  if (!match) {
    throw new Error(`Invalid timeout value: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  return match[2] === 's' ? amount * 1000 : amount;
}

export function coerceValue(rawValue: string): unknown {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      return rawValue;
    }
  }
  return rawValue;
}

export function loadEnvFile(envFilePath: string) {
  const absolutePath = resolve(envFilePath);
  const content = readFileSync(absolutePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) {
      process.env[key] = unquoted;
    }
  }

  return absolutePath;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

export function formatJson(value: unknown, compact: boolean) {
  return JSON.stringify(value, null, compact ? 0 : 2);
}

export function helpText() {
  return [
    'Notion CLI for mcp-notion',
    '',
    'Usage:',
    '  notion list',
    '  notion schema <tool>',
    '  notion <tool> --key=value [--other=value]',
    '  notion <tool> --json \'{"key":"value"}\'',
    '  notion auth status',
    '  notion auth test',
    '',
    'Global options:',
    '  --compact              Print JSON output on a single line',
    '  --env-file <path>      Load environment variables from a file before running',
    '  --timeout <value>      Timeout in ms or s, for example 5000 or 5s',
  ].join('\n');
}
