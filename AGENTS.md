# AGENTS.md -- mcp-notion

As regras operacionais deste repo sao canonicas em [CLAUDE.md](CLAUDE.md) (fonte unica para Claude/Codex/Hermes). Leia-o antes de tocar em codigo.

TL;DR das invariantes:
- `NOTION_TOKEN` nunca vai para git, logs ou output -- usar `.env` local ou secret store; `.env` esta no `.gitignore`.
- `add_content_blocks` suporta apenas `position: "append"` -- nao existe insert/prepend na Notion block API.
- `create_root_page` requer `NOTION_ROOT_PARENT_PAGE_ID` configurado no ambiente -- falha sem ele.
- Build obrigatorio antes de rodar: `npm run build` (tsc -> `dist/`); `dist/` nao e commitado.
- Rate limit Notion: 60 req/min -- servidor implementa retry, mas lotes devem respeitar isso.

Validar: `npm run type-check && npm run lint && npm test`
