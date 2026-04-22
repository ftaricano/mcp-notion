# MCP Notion Server

Status: beta

MCP server for common Notion page workflows. It focuses on creating, reading, updating, and extending pages, with support for rich blocks and reusable templates.

## Why this exists

The Notion API is flexible but verbose for routine documentation tasks. This server gives an MCP client a narrower toolset for the workflows that come up most often in personal knowledge management and team documentation:
- find pages,
- inspect page content,
- create structured pages,
- append formatted blocks,
- start from reusable templates.

## What it includes

- 10 MCP tools for page discovery and content creation
- basic page CRUD-style operations
- rich block creation for headings, paragraphs, lists, callouts, quotes, dividers, code blocks, and to-dos
- reusable page templates such as meeting notes, project plans, documentation, weekly reports, and bug reports
- optional runtime guardrails via token validation, request throttling, and page allow/block lists
- `create_root_page` only when a root parent is explicitly configured via `NOTION_ROOT_PARENT_PAGE_ID` or `MCP_NOTION_ROOT_PARENT_PAGE_ID`
- `CLAUDE.md` with MCP Hub-oriented examples in Portuguese

## Quickstart

Prerequisites:
- Node.js 18+
- A Notion internal integration token with access to the pages you want to work with

1. Install dependencies

```bash
git clone https://github.com/ftaricano/mcp-notion.git
cd mcp-notion
npm install
```

2. Provide the Notion token

```bash
export NOTION_TOKEN=your_notion_integration_token
```

3. Build the server

```bash
npm run build
```

4. Add it to your MCP client

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-notion/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "your_notion_integration_token"
      }
    }
  }
}
```

## Typical use cases

- create structured notes under an existing parent page,
- search a workspace for project or reference pages,
- generate recurring documentation from templates,
- append formatted sections to a page after meetings or reviews,
- create a new page under a preconfigured root parent when a specific parent is not known.

## Available tools

### Core page operations
- `search_pages`
- `get_page`
- `get_page_content`
- `create_page`
- `update_page`

### Rich content and templates
- `create_rich_page`
- `create_page_from_template`
- `add_content_blocks` (`append` only)
- `list_templates`
- `create_root_page` (requires configured root parent)

## Runtime guardrails

Environment variables supported by the runtime:
- Set `VALIDATE_TOKEN` to `false` to skip startup token validation
- `MAX_REQUESTS_PER_MINUTE=60` to control in-process request throttling
- `ALLOWED_PAGE_IDS=id1,id2` to restrict operations to an allowlist
- `BLOCKED_PAGE_IDS=id3,id4` to deny specific pages
- `NOTION_ROOT_PARENT_PAGE_ID=<page-id>` or `MCP_NOTION_ROOT_PARENT_PAGE_ID=<page-id>` to enable `create_root_page`

Notes:
- Notion page IDs must be UUIDs with or without hyphens.
- `get_page_content` returns a bounded preview and block summary instead of raw block JSON.
- `add_content_blocks` no longer claims `prepend` support because the runtime only performs safe append operations.

## Supported block types

The rich page tools currently support:
- `heading_1`, `heading_2`, `heading_3`
- `paragraph`
- `bulleted_list_item`, `numbered_list_item`
- `to_do`
- `callout`
- `quote`
- `divider`
- `code`

## Template set

- `meeting_notes`
- `project_plan`
- `documentation`
- `article`
- `weekly_report`
- `bug_report`

## Example tool calls

Create a simple page:

```json
{
  "tool": "create_page",
  "arguments": {
    "parent_page_id": "page-id",
    "title": "Weekly Notes",
    "content": "Draft agenda"
  }
}
```

Create a richer page:

```json
{
  "tool": "create_rich_page",
  "arguments": {
    "parent_page_id": "page-id",
    "title": "Project Overview",
    "blocks": [
      { "type": "heading_1", "content": "Overview" },
      { "type": "paragraph", "content": "Current scope and next steps." },
      { "type": "to_do", "content": "Confirm milestones", "checked": false }
    ]
  }
}
```

Create from a template:

```json
{
  "tool": "create_page_from_template",
  "arguments": {
    "parent_page_id": "page-id",
    "title": "Sprint Review",
    "template": "meeting_notes",
    "variables": {
      "date": "2026-04-22",
      "facilitator": "Fernando"
    }
  }
}
```

## MCP Hub usage

If you use this server behind MCP Hub, see `CLAUDE.md` for the hub-specific calling patterns and Portuguese examples.

## Development

```bash
npm run build
npm run lint
npm run type-check
npm test
```

## License

MIT
