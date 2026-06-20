# Security Policy

## Supported Versions

Security fixes target the latest published version and the `main` branch.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories:

https://github.com/ftaricano/mcp-notion/security/advisories/new

Avoid opening a public issue for token leakage, auth bypasses, data exposure, or any bug that could expose private Notion content.

## Secret Handling

This project reads Notion tokens from environment variables. It should never require a token in source code, committed examples, command history screenshots, or issue reports.

Do not commit:

- `.env` or `.env.*` files with real values
- Notion internal integration tokens
- Notion OAuth access or refresh tokens
- local credential exports such as `tokens.json`, `credentials.json`, or `.notion-mcp-env`
- logs containing request headers, page IDs from private workspaces, or token validation errors

The checked-in `.env.example` intentionally leaves `NOTION_TOKEN` blank.

## Notion Tokens

`NOTION_TOKEN` may be either:

- an internal integration token created at https://www.notion.so/my-integrations
- an OAuth access token issued by a Notion OAuth app

Use the minimum workspace/page access needed for the workflow. Share only the pages the integration must read or write.

If a token is exposed:

1. Revoke or rotate it in Notion immediately.
2. Remove it from local `.env` files, shell profiles, CI secrets, and MCP client configs.
3. Inspect recent Notion integration activity and affected pages.
4. If the token reached git history, treat the old token as permanently compromised.

## Runtime Guardrails

The server includes optional runtime controls:

- `VALIDATE_TOKEN=false` disables startup token validation for offline/local smoke tests.
- `MAX_REQUESTS_PER_MINUTE` limits in-process tool calls.
- `ALLOWED_PAGE_IDS` restricts operations to known pages.
- `BLOCKED_PAGE_IDS` denies sensitive pages even if a token can access them.
- `NOTION_ROOT_PARENT_PAGE_ID` or `MCP_NOTION_ROOT_PARENT_PAGE_ID` is required before `create_root_page` can create content without a specific parent argument.

These controls reduce blast radius but do not replace Notion workspace permissions.
