# CLAUDE.md -- mcp-notion

MCP server e CLI para operações com a API do Notion: busca de páginas, criação de conteúdo rico e uso de templates reutilizáveis.

## O que e

Servidor MCP (`@mcp/notion`) que expõe 10 ferramentas para interagir com o Notion via Model Context Protocol. Inclui CLI humano (`notion`) para uso local e CI. Consumido via MCP Hub (padrão recomendado) ou diretamente via stdio em qualquer cliente MCP. Parte do ecossistema de integrações do hub do Ferd.

## Stack & estrutura

TypeScript 5 + Node.js 18+ + MCP SDK 1.x + @notionhq/client 2.x + Vitest 3.x

```
src/
  index.ts          # entrypoint MCP (stdio)
  app.ts            # servidor MCP registrável
  cli.ts            # CLI humano `notion`
  cli-support.ts    # suporte ao CLI
  tools/pages.ts    # 10 ferramentas MCP (busca, criação, templates)
  utils/
    blocks.ts       # construtores de blocos rich-text
    richText.ts     # anotações de formatação
    templates.ts    # 6 templates pré-definidos
  cache/            # cache em memória (TTL configurável)
  security/         # rate limiter, policy, token validator
  config/           # leitura de variáveis de ambiente
dist/               # output compilado (tsc)
tests/
  unit/             # vitest unit tests
  integration/      # package-contract e smoke tests
.env.example        # variáveis necessárias (não commitar .env)
```

## Como rodar / validar

```bash
# Setup
npm install
cp .env.example .env   # editar NOTION_TOKEN

# Build
npm run build          # tsc → dist/

# Validar (rodar antes de DONE)
npm run type-check     # tsc --noEmit
npm run lint           # eslint src
npm test               # vitest run (unit + integration)

# Dev / smoke test
npm run dev            # tsx src/index.ts (MCP stdio)
node dist/cli.js auth status --env-file .env
```

## Invariantes / regras criticas

- `NOTION_TOKEN` nunca vai para git, logs ou output — usar `.env` local ou secret store do MCP client; `.env` esta no `.gitignore`.
- `ALLOWED_PAGE_IDS` / `BLOCKED_PAGE_IDS` controlam blast-radius em runtime; respeitar ao criar testes com pages reais.
- A ferramenta `add_content_blocks` suporta apenas `position: "append"` — nao existe insert/prepend no Notion block API.
- `create_root_page` requer `NOTION_ROOT_PARENT_PAGE_ID` ou `MCP_NOTION_ROOT_PARENT_PAGE_ID` configurado — falha silenciosa sem ele.
- Tokens Notion comecam com `secret_` (internal integration) ou sao OAuth access tokens — validar formato antes de depurar erros 401.
- Rate limit da Notion API: 60 req/min — o servidor implementa retry com backoff, mas operacoes em lote devem respeitar isso.
- Build e obrigatorio antes de rodar (`npm run build`); `dist/` nao e commitado.

## Gotchas

- O MCP Hub usa `smart-search` + `call-tool("notion", ...)` como padrao; uso direto via stdio nao precisa de Hub.
- `VALIDATE_TOKEN=false` pula validacao de startup (util para offline/mock em CI sem token real).
- `tsx` e dev-only — producao sempre usa `node dist/`.
- Templates sao case-sensitive: `meeting_notes`, `project_plan`, `documentation`, `article`, `weekly_report`, `bug_report`.

---

## 🚨 USO OBRIGATÓRIO VIA MCP HUB

**SEMPRE use as ferramentas inteligentes do MCP Hub** para interagir com o Notion. NUNCA tente conexões diretas ou uso da API do Notion manualmente.

### Padrão Intelligence-First (RECOMENDADO)

```typescript
// PRIMEIRO: Busca inteligente em português
smart-search({ query: "criar página notion", context: "trabalho" })

// SEGUNDO: Executar ferramenta recomendada
call-tool("notion", "create_rich_page", {
  parent_page_id: "parent-id",
  title: "Relatório Semanal",
  blocks: [...]
})
```

### Padrão Tradicional (FALLBACK)

```typescript
// Descobrir ferramentas disponíveis
list-all-tools({ server_id: "notion" })

// Executar ferramenta específica
call-tool("notion", "search_pages", {
  query: "projeto",
  page_size: 10
})
```

## 🛠️ Ferramentas Disponíveis (10 Total)

### Operações Básicas (5 ferramentas)

#### 1. `search_pages`
Buscar páginas do Notion por título.

**Parâmetros**:
- `query` (string, obrigatório): Texto para buscar nos títulos
- `page_size` (number, opcional): Número de resultados (padrão: 10)

**Exemplo via Hub**:
```typescript
smart-search({ query: "buscar páginas notion projeto" })
call-tool("notion", "search_pages", {
  query: "projeto",
  page_size: 5
})
```

#### 2. `get_page`
Obter informações básicas sobre uma página.

**Parâmetros**:
- `page_id` (string, obrigatório): ID da página do Notion

**Exemplo**:
```typescript
call-tool("notion", "get_page", {
  page_id: "page-uuid-here"
})
```

#### 3. `get_page_content`
Obter o conteúdo/blocos de uma página.

**Parâmetros**:
- `page_id` (string, obrigatório): ID da página do Notion

**Exemplo**:
```typescript
call-tool("notion", "get_page_content", {
  page_id: "page-uuid-here"
})
```

#### 4. `create_page`
Criar uma página básica com texto simples.

**Parâmetros**:
- `parent_page_id` (string, obrigatório): ID da página pai
- `title` (string, obrigatório): Título da nova página
- `content` (string, opcional): Conteúdo inicial

**Nota**: Para formatação rica, use `create_rich_page` em vez desta ferramenta.

**Exemplo**:
```typescript
call-tool("notion", "create_page", {
  parent_page_id: "parent-uuid",
  title: "Nova Página",
  content: "Conteúdo simples"
})
```

#### 5. `update_page`
Atualizar o título de uma página.

**Parâmetros**:
- `page_id` (string, obrigatório): ID da página a atualizar
- `title` (string, opcional): Novo título

**Exemplo**:
```typescript
call-tool("notion", "update_page", {
  page_id: "page-uuid",
  title: "Novo Título"
})
```

### Operações Avançadas (5 ferramentas)

#### 6. `create_rich_page` 🎨
Criar páginas com formatação rica e múltiplos tipos de blocos.

**Parâmetros**:
- `parent_page_id` (string, obrigatório): ID da página pai
- `title` (string, obrigatório): Título da página
- `blocks` (array, opcional): Array de blocos formatados

**Tipos de Blocos Suportados**:
- `heading_1`, `heading_2`, `heading_3` - Cabeçalhos com suporte a emoji
- `paragraph` - Parágrafos de texto com formatação
- `bulleted_list_item`, `numbered_list_item` - Listas
- `to_do` - Itens de checklist
- `callout` - Caixas de destaque com ícones
- `quote` - Blocos de citação
- `code` - Blocos de código com syntax highlighting
- `divider` - Separadores visuais

**Exemplo Completo**:
```typescript
smart-search({ query: "criar página formatada notion" })
call-tool("notion", "create_rich_page", {
  parent_page_id: "parent-uuid",
  title: "🚀 Visão Geral do Projeto",
  blocks: [
    {
      type: "heading_1",
      content: "🎯 Objetivos do Projeto"
    },
    {
      type: "callout",
      content: "Marco importante chegando!",
      icon: "⚠️"
    },
    {
      type: "bulleted_list_item",
      content: "Definir arquitetura"
    },
    {
      type: "code",
      content: "console.log('Hello World');",
      language: "javascript"
    },
    {
      type: "to_do",
      content: "Revisar documentação",
      checked: false
    }
  ]
})
```

#### 7. `create_page_from_template` 📋
Usar templates profissionais pré-definidos.

**Parâmetros**:
- `parent_page_id` (string, obrigatório): ID da página pai
- `title` (string, obrigatório): Título da página
- `template` (enum, obrigatório): Tipo de template
- `variables` (object, opcional): Variáveis para customizar o template

**Templates Disponíveis**:
1. **meeting_notes** - Documentação de reunião profissional
2. **project_plan** - Planejamento de projeto abrangente
3. **documentation** - Estrutura de documentação técnica
4. **article** - Formato de post de blog ou artigo
5. **weekly_report** - Relatórios de status semanais
6. **bug_report** - Documentação de bugs de software

**Exemplo com Template**:
```typescript
smart-search({ query: "criar reunião notion template" })
call-tool("notion", "create_page_from_template", {
  parent_page_id: "parent-uuid",
  title: "Reunião de Equipe - Planejamento Q4",
  template: "meeting_notes",
  variables: {
    date: "2024-08-16",
    facilitator: "João Silva",
    attendees: "Equipe A, Equipe B"
  }
})
```

**Exemplo Weekly Report**:
```typescript
call-tool("notion", "create_page_from_template", {
  parent_page_id: "parent-uuid",
  title: "Relatório Semanal - Semana 32",
  template: "weekly_report",
  variables: {
    week: "32",
    year: "2024",
    team: "Desenvolvimento"
  }
})
```

#### 8. `add_content_blocks` 📦
Adicionar blocos de conteúdo formatado ao final de uma página existente.

**Parâmetros**:
- `page_id` (string, obrigatório): ID da página
- `blocks` (array, obrigatório): Array de blocos formatados
- `position` (enum, opcional): apenas "append" é suportado em runtime, padrão: "append"

**Exemplo**:
```typescript
call-tool("notion", "add_content_blocks", {
  page_id: "page-uuid",
  blocks: [
    {
      type: "heading_2",
      content: "📊 Novos Dados"
    },
    {
      type: "paragraph",
      content: "Análise atualizada do projeto",
      annotations: {
        bold: true
      }
    }
  ],
  position: "append"
})
```

#### 9. `list_templates` 📚
Listar todos os templates disponíveis com descrições.

**Parâmetros**: Nenhum

**Exemplo**:
```typescript
call-tool("notion", "list_templates", {})
```

#### 10. `create_root_page` 🌟
Criar página sob um parent raiz explicitamente configurado com formatação avançada.

**Parâmetros**:
- `title` (string, obrigatório): Título da página
- `content_type` (enum, opcional): "template", "rich", ou "basic" (padrão: "rich")
- `template` (enum, opcional): Template a usar se content_type for "template"
- `variables` (object, opcional): Variáveis para customização do template
- `blocks` (array, opcional): Blocos formatados se content_type for "rich"
- Requer `NOTION_ROOT_PARENT_PAGE_ID` ou `MCP_NOTION_ROOT_PARENT_PAGE_ID` configurado no ambiente

**Exemplo com Template**:
```typescript
smart-search({ query: "criar página raiz notion" })
call-tool("notion", "create_root_page", {
  title: "📋 Plano de Projeto Principal",
  content_type: "template",
  template: "project_plan",
  variables: {
    project_name: "MCP Integration",
    start_date: "2024-08-01",
    owner: "Equipe Dev"
  }
})
```

**Exemplo com Conteúdo Rico**:
```typescript
call-tool("notion", "create_root_page", {
  title: "🎯 Objetivos Estratégicos 2024",
  content_type: "rich",
  blocks: [
    {
      type: "heading_1",
      content: "🚀 Visão e Missão"
    },
    {
      type: "callout",
      content: "Nossa meta é inovar continuamente",
      icon: "💡"
    }
  ]
})
```

## 🎨 Formatação de Blocos Avançada

### Annotations (Formatação de Texto)

Todas as ferramentas que aceitam blocos suportam annotations:

```typescript
{
  type: "paragraph",
  content: "Texto formatado",
  annotations: {
    bold: true,      // Negrito
    italic: true,    // Itálico
    code: true,      // Código inline
    color: "blue"    // Cor do texto
  }
}
```

**Cores Disponíveis**:
- Texto: `default`, `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`
- Fundo: `gray_background`, `brown_background`, `orange_background`, etc.

### Blocos Especiais

**Callout com Ícone**:
```typescript
{
  type: "callout",
  content: "Aviso importante!",
  icon: "⚠️",
  annotations: {
    color: "yellow_background"
  }
}
```

**Código com Linguagem**:
```typescript
{
  type: "code",
  content: "function hello() { return 'world'; }",
  language: "javascript"  // javascript, python, typescript, etc.
}
```

**To-Do Item**:
```typescript
{
  type: "to_do",
  content: "Tarefa a fazer",
  checked: false
}
```

## 🔧 Configuração e Autenticação

### Variáveis de Ambiente Necessárias

```env
# Obrigatório
NOTION_TOKEN=secret_your_notion_integration_token

# Opcional (com defaults)
NOTION_API_VERSION=2022-06-28
NOTION_TIMEOUT=60000
NOTION_MAX_RETRIES=3

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=300000
CACHE_MAX_SIZE=100

# Security
VALIDATE_TOKEN=true
MAX_REQUESTS_PER_MINUTE=60
ENABLE_AUDIT_LOG=true
```

### Obter Token do Notion

1. Acesse https://www.notion.so/my-integrations
2. Clique em "+ New integration"
3. Dê um nome e selecione o workspace
4. Copie o "Internal Integration Token"
5. **IMPORTANTE**: Compartilhe as páginas/databases com a integração

### Configuração MCP Hub

O servidor Notion já está integrado no MCP Hub. Use apenas as ferramentas do Hub:

```json
{
  "mcpServers": {
    "mcp-hub": {
      "command": "node",
      "args": ["/path/to/mcp-hub/dist/index.js"],
      "env": {
        "HUB_CONFIG": "/path/to/hub-config.json"
      }
    }
  }
}
```

## 🎯 Casos de Uso Práticos

### 1. Documentação de Reunião
```typescript
// Usar busca inteligente
smart-search({ query: "criar ata reunião notion" })

// Criar com template
call-tool("notion", "create_page_from_template", {
  parent_page_id: "team-space-id",
  title: "Reunião Semanal - Sprint 15",
  template: "meeting_notes",
  variables: {
    date: "2024-08-16",
    facilitator: "Maria Santos",
    attendees: "Dev Team, Product Owner"
  }
})
```

### 2. Relatório de Status Semanal
```typescript
call-tool("notion", "create_page_from_template", {
  parent_page_id: "reports-page-id",
  title: "Status Report - Week 32/2024",
  template: "weekly_report",
  variables: {
    week: "32",
    year: "2024",
    highlights: "Feature X completed, Bug Y fixed"
  }
})
```

### 3. Documentação Técnica
```typescript
call-tool("notion", "create_rich_page", {
  parent_page_id: "docs-page-id",
  title: "🔧 API Documentation - User Service",
  blocks: [
    { type: "heading_1", content: "📖 Overview" },
    { type: "paragraph", content: "User service provides authentication and profile management." },
    { type: "heading_2", content: "🔑 Authentication" },
    { type: "code", content: "POST /api/v1/auth/login", language: "http" },
    { type: "callout", content: "Requires API key in header", icon: "🔐" }
  ]
})
```

### 4. Bug Report
```typescript
call-tool("notion", "create_page_from_template", {
  parent_page_id: "bugs-page-id",
  title: "[BUG-123] Login fails on mobile",
  template: "bug_report",
  variables: {
    severity: "High",
    reporter: "João Silva",
    date: "2024-08-16",
    environment: "Production - Mobile App"
  }
})
```

### 5. Adicionar Conteúdo a Página Existente
```typescript
// Buscar página
const pages = call-tool("notion", "search_pages", {
  query: "projeto alpha",
  page_size: 1
})

// Adicionar novo conteúdo
call-tool("notion", "add_content_blocks", {
  page_id: pages[0].id,
  blocks: [
    { type: "divider" },
    { type: "heading_2", content: "📊 Update - 16/08/2024" },
    { type: "paragraph", content: "New milestone achieved!" }
  ],
  position: "append"
})
```

## 🚫 COMPORTAMENTOS PROIBIDOS

### ❌ NUNCA faça:
- Importar `@notionhq/client` ou outras bibliotecas do Notion
- Usar `fetch()` direto para `https://api.notion.com`
- Tentar autenticação OAuth manualmente
- Conectar stdio diretamente com o servidor
- Ler tokens de arquivos ou environment variables diretamente

### ✅ SEMPRE faça:
1. Use `smart-search` para queries em português
2. Use `call-tool` com "notion" como server_id
3. Siga o fluxo: intelligence → identify → execute
4. Consulte `list-templates` antes de usar templates
5. Use `create_rich_page` para conteúdo formatado
6. Use templates quando apropriado

## 📊 Performance e Limites

### Limites da API do Notion
- **Rate Limit**: 60 requisições/minuto (respeitado automaticamente)
- **Retry Logic**: 3 tentativas com backoff exponencial
- **Cache**: >60% hit rate para operações frequentes
- **Response Time**: <500ms para operações em cache

### Best Practices
- Use cache quando possível (habilitado por padrão)
- Busque páginas antes de criar duplicatas
- Use templates para estruturas consistentes
- Adicione emojis nos títulos para melhor organização
- Use callouts para informações importantes
- Organize conteúdo com headings e dividers

## 🔍 Troubleshooting

### Erro: "Unauthorized"
- Verifique se `NOTION_TOKEN` está configurado corretamente
- Confirme que a integração tem acesso à página/database
- Token deve começar com `secret_`

### Erro: "Page not found"
- Verifique se o `page_id` está correto (UUID format)
- Confirme que a integração tem acesso à página
- Use `search_pages` para encontrar IDs corretos

### Erro: "Rate limit exceeded"
- Servidor implementa retry automático
- Aguarde alguns segundos entre operações em massa
- Rate limit é 60 req/min (Notion API limit)

### Template não funciona
- Use `list_templates` para ver templates disponíveis
- Verifique nomes exatos: `meeting_notes`, `project_plan`, etc.
- Variables são case-sensitive

## 📚 Referências

- **README Técnico**: `README.md` - Documentação técnica completa
- **MCP Hub**: `repos/tools/jarvis-runtime/mcp-hub/README.md` - Sistema de inteligência
- **Notion API**: https://developers.notion.com - API oficial do Notion
- **Templates**: Use `list_templates` para ver estruturas disponíveis

## 🎓 Exemplos de Queries em Português

```typescript
// Buscar páginas
smart-search({ query: "buscar páginas notion projeto" })
→ call-tool("notion", "search_pages", {...})

// Criar página formatada
smart-search({ query: "criar página notion com formatação" })
→ call-tool("notion", "create_rich_page", {...})

// Usar template de reunião
smart-search({ query: "criar ata de reunião notion" })
→ call-tool("notion", "create_page_from_template", {template: "meeting_notes"})

// Relatório semanal
smart-search({ query: "criar relatório semanal notion" })
→ call-tool("notion", "create_page_from_template", {template: "weekly_report"})

// Documentação técnica
smart-search({ query: "criar documentação técnica notion" })
→ call-tool("notion", "create_page_from_template", {template: "documentation"})
```

---

**Built with ❤️ for the MCP ecosystem**
