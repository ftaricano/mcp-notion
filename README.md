# MCP Notion Server

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2.svg)

Status: beta

MCP server + human CLI for common Notion page workflows: search pages, inspect content, create structured pages, append rich blocks, and start documents from reusable templates.

## Requirements

- Node.js 18+
- A Notion token with access to the target pages
- A Notion page shared with the integration when you want to create or update content

## Install

From npm after publishing:

```bash
npm install -g @mcp/notion
```

From source:

```bash
git clone https://github.com/ftaricano/mcp-notion.git
cd mcp-notion
npm install
npm run build
```

## Configure Notion Auth

Create a local environment file:

```bash
cp .env.example .env
```

Set `NOTION_TOKEN` in `.env` or in your MCP client environment. Do not commit `.env`.

### Internal Integration Token

1. Open https://www.notion.so/my-integrations.
2. Create an internal integration.
3. Copy the integration secret into `NOTION_TOKEN`.
4. Share the target Notion pages with that integration.

### OAuth Token

Notion OAuth apps can also provide an access token. This package does not run the OAuth browser authorization flow; pass the OAuth access token as `NOTION_TOKEN` after your OAuth app obtains it.

Use the smallest workspace/page access needed. If a token leaks, revoke or rotate it in Notion and remove it from local env files, shell profiles, CI secrets, and MCP client configs.

## Quickstart

Check local config without calling Notion:

```bash
notion --env-file .env auth status
```

Test the token against Notion:

```bash
notion --env-file .env --timeout 10s auth test
```

List available MCP tools:

```bash
notion list
```

Search pages:

```bash
notion --env-file .env search_pages --query "Release notes" --page_size=5
```

Create a page under a parent page:

```bash
notion --env-file .env create_page \
  --parent_page_id=11111111-1111-1111-1111-111111111111 \
  --title="Weekly Notes" \
  --content="Draft agenda"
```

Create a formatted page from JSON:

```bash
notion --env-file .env create_rich_page --json '{
  "parent_page_id": "11111111-1111-1111-1111-111111111111",
  "title": "Project Overview",
  "blocks": [
    { "type": "heading_1", "content": "Overview" },
    { "type": "paragraph", "content": "Current scope and next steps." },
    { "type": "to_do", "content": "Confirm milestones", "checked": false }
  ]
}'
```

## MCP Client Setup

Use the built server entrypoint with any stdio MCP client:

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-notion/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "your-token-from-a-secret-store",
        "VALIDATE_TOKEN": "true",
        "MAX_REQUESTS_PER_MINUTE": "60"
      }
    }
  }
}
```

For local source checkouts, build before connecting:

```bash
npm run build
node dist/index.js
```

For installed npm packages, point your client at the `mcp-notion` binary when your runtime can resolve global npm bins.

## CLI Reference

```bash
notion list
notion schema <tool>
notion auth status
notion auth test
notion <tool> --key=value [--other=value]
notion <tool> --json '{"key":"value"}'
```

Global options:

- `--env-file <path>` loads environment variables before running.
- `--timeout <value>` accepts values such as `5000` or `10s`.
- `--compact` prints JSON output on one line where supported.

## Available MCP Tools

Core page operations:

- `search_pages`
- `get_page`
- `get_page_content`
- `create_page`
- `update_page`

Rich content and templates:

- `create_rich_page`
- `create_page_from_template`
- `add_content_blocks` (`append` only)
- `list_templates`
- `create_root_page`

`create_root_page` requires `NOTION_ROOT_PARENT_PAGE_ID` or `MCP_NOTION_ROOT_PARENT_PAGE_ID`.

## Runtime Guardrails

Environment variables:

- `NOTION_TOKEN` - required for live Notion calls.
- `VALIDATE_TOKEN=false` - skips startup token validation for offline/local smoke tests.
- `MAX_REQUESTS_PER_MINUTE=60` - controls in-process request throttling.
- `ENABLE_AUDIT_LOG=false` - disables local operation audit logging.
- `ALLOWED_PAGE_IDS=id1,id2` - restricts operations to an allowlist.
- `BLOCKED_PAGE_IDS=id3,id4` - denies specific pages.
- `NOTION_ROOT_PARENT_PAGE_ID=<page-id>` - enables `create_root_page`.
- `MCP_NOTION_ROOT_PARENT_PAGE_ID=<page-id>` - compatibility alias for the same root parent.

Notion page IDs may use UUIDs with or without hyphens.

## Templates

- `meeting_notes`
- `project_plan`
- `documentation`
- `article`
- `weekly_report`
- `bug_report`

## Development

```bash
npm install
npm run build
npm run lint
npm run type-check
npm test
npm run pack:dry-run
```

`npm run test:unit` runs fast unit coverage. `npm run test:integration` verifies package metadata, security docs, and the npm pack file list.

## Security

See [SECURITY.md](SECURITY.md). The short version:

- keep real tokens out of git,
- use Notion workspace/page permissions to limit access,
- use `ALLOWED_PAGE_IDS` and `BLOCKED_PAGE_IDS` for runtime blast-radius control,
- report vulnerabilities through GitHub Security Advisories.

## MCP Hub Usage

If you use this server behind MCP Hub, see [CLAUDE.md](CLAUDE.md) for hub-specific calling patterns and Portuguese examples.

## License

[MIT](LICENSE)
