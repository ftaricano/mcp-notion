// Page templates for professional-looking Notion pages
import { Blocks, createTableOfContents } from './blocks.js';

export interface TemplateVariables {
  [key: string]: string | string[] | boolean | number;
}

export type TemplateType = 
  | 'meeting_notes'
  | 'project_plan'
  | 'documentation'
  | 'todo_list'
  | 'article'
  | 'weekly_report'
  | 'brainstorm'
  | 'technical_spec'
  | 'user_story'
  | 'bug_report';

/**
 * Meeting Notes template
 */
export function createMeetingNotesTemplate(variables: TemplateVariables = {}): any[] {
  const {
    date = new Date().toLocaleDateString('pt-BR'),
    participants = 'A definir',
    duration = '1 hora',
    location = 'Online'
  } = variables;

  return [
    Blocks.callout('Anotações de reunião organizadas e estruturadas', '📋', 'blue_background'),
    Blocks.divider(),
    
    Blocks.h2('📅 Detalhes da Reunião'),
    Blocks.bullet(`**Data:** ${date}`),
    Blocks.bullet(`**Participantes:** ${participants}`),
    Blocks.bullet(`**Duração:** ${duration}`),
    Blocks.bullet(`**Local:** ${location}`),
    
    Blocks.h2('🎯 Agenda'),
    Blocks.todo('Item da agenda 1', false),
    Blocks.todo('Item da agenda 2', false),
    Blocks.todo('Item da agenda 3', false),
    
    Blocks.h2('📝 Principais Discussões'),
    Blocks.text('• Tópico 1: [Descrição da discussão]'),
    Blocks.text('• Tópico 2: [Principais pontos levantados]'),
    Blocks.text('• Tópico 3: [Decisões tomadas]'),
    
    Blocks.h2('✅ Ações e Responsabilidades'),
    Blocks.todo('Ação 1 - Responsável: [Nome]', false),
    Blocks.todo('Ação 2 - Responsável: [Nome]', false),
    Blocks.todo('Ação 3 - Responsável: [Nome]', false),
    
    Blocks.h2('📌 Próximos Passos'),
    Blocks.callout('Resumo das próximas ações e cronograma', '⏭️', 'yellow_background'),
    
    Blocks.h2('📎 Anexos e Links'),
    Blocks.text('• [Link para documento relevante]'),
    Blocks.text('• [Link para apresentação]'),
  ];
}

/**
 * Project Plan template
 */
export function createProjectPlanTemplate(variables: TemplateVariables = {}): any[] {
  const {
    description = 'Descrição do projeto',
    startDate = 'A definir',
    endDate = 'A definir',
    team = 'Equipe a ser definida',
    budget = 'Orçamento a ser definido'
  } = variables;

  return [
    Blocks.callout(`📋 **Visão Geral:** ${description}`, '🚀', 'blue_background'),
    Blocks.divider(),
    
    Blocks.h2('🎯 Objetivos do Projeto'),
    Blocks.bullet('Objetivo 1: [Descrição detalhada]'),
    Blocks.bullet('Objetivo 2: [Métricas de sucesso]'),
    Blocks.bullet('Objetivo 3: [Resultados esperados]'),
    
    Blocks.h2('📅 Cronograma'),
    Blocks.bullet(`**Data de Início:** ${startDate}`),
    Blocks.bullet(`**Data de Término:** ${endDate}`),
    Blocks.bullet(`**Duração Estimada:** [Calcular baseado nas datas]`),
    
    Blocks.h2('👥 Equipe do Projeto'),
    Blocks.text(`**Equipe Principal:** ${team}`),
    Blocks.bullet('Gerente de Projeto: [Nome]'),
    Blocks.bullet('Desenvolvedor Lead: [Nome]'),
    Blocks.bullet('Designer: [Nome]'),
    Blocks.bullet('QA: [Nome]'),
    
    Blocks.h2('💰 Orçamento'),
    Blocks.callout(`Orçamento Total: ${budget}`, '💸', 'green_background'),
    
    Blocks.h2('📋 Fases do Projeto'),
    Blocks.toggle('🔍 Fase 1: Descoberta e Planejamento', [
      Blocks.todo('Levantamento de requisitos', false),
      Blocks.todo('Análise de viabilidade', false),
      Blocks.todo('Definição de escopo', false),
    ]),
    Blocks.toggle('🏗️ Fase 2: Desenvolvimento', [
      Blocks.todo('Setup do ambiente', false),
      Blocks.todo('Desenvolvimento core', false),
      Blocks.todo('Integração de componentes', false),
    ]),
    Blocks.toggle('🧪 Fase 3: Testes e QA', [
      Blocks.todo('Testes unitários', false),
      Blocks.todo('Testes de integração', false),
      Blocks.todo('Testes de usuário', false),
    ]),
    Blocks.toggle('🚀 Fase 4: Entrega e Deploy', [
      Blocks.todo('Preparação do ambiente de produção', false),
      Blocks.todo('Deploy e monitoramento', false),
      Blocks.todo('Documentação final', false),
    ]),
    
    Blocks.h2('⚠️ Riscos e Mitigações'),
    Blocks.bullet('**Risco 1:** [Descrição] - *Mitigação:* [Estratégia]'),
    Blocks.bullet('**Risco 2:** [Descrição] - *Mitigação:* [Estratégia]'),
    
    Blocks.h2('📊 Métricas de Sucesso'),
    Blocks.bullet('KPI 1: [Descrição e meta]'),
    Blocks.bullet('KPI 2: [Descrição e meta]'),
    Blocks.bullet('KPI 3: [Descrição e meta]'),
  ];
}

/**
 * Technical Documentation template
 */
export function createDocumentationTemplate(variables: TemplateVariables = {}): any[] {
  const {
    version = '1.0.0',
    author = 'Equipe de Desenvolvimento',
    lastUpdate = new Date().toLocaleDateString('pt-BR')
  } = variables;

  return [
    Blocks.callout('Documentação técnica completa e estruturada', '📚', 'purple_background'),
    
    Blocks.h2('📄 Informações do Documento'),
    Blocks.bullet(`**Versão:** ${version}`),
    Blocks.bullet(`**Autor:** ${author}`),
    Blocks.bullet(`**Última Atualização:** ${lastUpdate}`),
    Blocks.divider(),
    
    ...createTableOfContents([
      { title: 'Visão Geral', level: 1 },
      { title: 'Arquitetura', level: 1 },
      { title: 'Instalação', level: 1 },
      { title: 'Configuração', level: 1 },
      { title: 'API Reference', level: 1 },
      { title: 'Exemplos', level: 1 },
      { title: 'Troubleshooting', level: 1 },
    ]),
    
    Blocks.h1('🔍 Visão Geral'),
    Blocks.text('Descrição geral do sistema, suas funcionalidades principais e propósito.'),
    
    Blocks.h2('🎯 Objetivos'),
    Blocks.bullet('Objetivo 1: [Descrição]'),
    Blocks.bullet('Objetivo 2: [Descrição]'),
    
    Blocks.h2('🏗️ Arquitetura'),
    Blocks.text('Descrição da arquitetura do sistema:'),
    Blocks.code(`
// Exemplo de estrutura
{
  "frontend": "React/TypeScript",
  "backend": "Node.js/Express",
  "database": "PostgreSQL",
  "deployment": "Docker/AWS"
}`, 'json'),
    
    Blocks.h2('🚀 Instalação'),
    Blocks.text('Passos para instalação:'),
    Blocks.number('Clone o repositório'),
    Blocks.number('Instale as dependências'),
    Blocks.number('Configure as variáveis de ambiente'),
    Blocks.number('Execute o comando de start'),
    
    Blocks.code(`git clone [repository-url]
cd project-directory
npm install
cp .env.example .env
npm start`, 'bash'),
    
    Blocks.h2('⚙️ Configuração'),
    Blocks.text('Variáveis de ambiente necessárias:'),
    Blocks.code(`DATABASE_URL=postgresql://localhost:5432/dbname
EXAMPLE_SERVICE_KEY=replace-me
PORT=3000`, 'env'),
    
    Blocks.h2('📡 API Reference'),
    Blocks.text('Documentação dos endpoints:'),
    
    Blocks.h3('GET /api/users'),
    Blocks.text('Retorna lista de usuários'),
    Blocks.code(`{
  "users": [
    {"id": 1, "name": "João", "email": "joao@email.com"}
  ]
}`, 'json'),
    
    Blocks.h2('💡 Exemplos'),
    Blocks.text('Exemplos de uso prático:'),
    Blocks.code(`// Exemplo básico
const response = await fetch('/api/users');
const users = await response.json();
console.log(users);`, 'javascript'),
    
    Blocks.h2('🔧 Troubleshooting'),
    Blocks.bullet('**Problema 1:** [Descrição] - *Solução:* [Como resolver]'),
    Blocks.bullet('**Problema 2:** [Descrição] - *Solução:* [Como resolver]'),
  ];
}

/**
 * Article/Blog Post template
 */
export function createArticleTemplate(variables: TemplateVariables = {}): any[] {
  const {
    author = 'Autor',
    date = new Date().toLocaleDateString('pt-BR'),
    readTime = '5 min',
    tags = 'tecnologia, desenvolvimento'
  } = variables;

  return [
    Blocks.callout(`Por ${author} • ${date} • ${readTime} de leitura`, '✍️', 'gray_background'),
    Blocks.text(`**Tags:** ${tags}`),
    Blocks.divider(),
    
    Blocks.h2('📝 Introdução'),
    Blocks.text('Contextualize o tema e desperte o interesse do leitor. Explique o que será abordado e por que é importante.'),
    
    Blocks.h2('🎯 Problema/Objetivo'),
    Blocks.callout('Descreva o problema que está sendo resolvido ou o objetivo do artigo', '🎯', 'yellow_background'),
    
    Blocks.h2('💡 Desenvolvimento'),
    Blocks.text('Desenvolva o conteúdo principal:'),
    
    Blocks.h3('Tópico 1'),
    Blocks.text('Conteúdo detalhado sobre o primeiro tópico...'),
    
    Blocks.h3('Tópico 2'),
    Blocks.text('Conteúdo detalhado sobre o segundo tópico...'),
    
    Blocks.h3('Exemplo Prático'),
    Blocks.text('Demonstre com um exemplo:'),
    Blocks.code(`// Exemplo de código
function exemploFuncao() {
  console.log("Exemplo prático");
}`, 'javascript'),
    
    Blocks.h2('✅ Conclusão'),
    Blocks.text('Resumo dos pontos principais e conclusões finais.'),
    
    Blocks.h2('🔗 Referências'),
    Blocks.bullet('[Link para referência 1]'),
    Blocks.bullet('[Link para referência 2]'),
    
    Blocks.divider(),
    Blocks.callout('Gostou do artigo? Deixe seu feedback! 👍', '💬', 'blue_background'),
  ];
}

/**
 * Weekly Report template
 */
export function createWeeklyReportTemplate(variables: TemplateVariables = {}): any[] {
  const {
    week = `${new Date().getDate()}/${new Date().getMonth() + 1}`,
    team = 'Equipe de Desenvolvimento'
  } = variables;

  return [
    Blocks.callout(`Relatório Semanal - ${team} - Semana ${week}`, '📊', 'blue_background'),
    Blocks.divider(),
    
    Blocks.h2('✅ Conquistas da Semana'),
    Blocks.bullet('Conquista 1: [Descrição e impacto]'),
    Blocks.bullet('Conquista 2: [Descrição e impacto]'),
    Blocks.bullet('Conquista 3: [Descrição e impacto]'),
    
    Blocks.h2('🎯 Objetivos Concluídos'),
    Blocks.todo('Objetivo 1', true),
    Blocks.todo('Objetivo 2', true),
    Blocks.todo('Objetivo 3', false),
    
    Blocks.h2('📈 Métricas e KPIs'),
    Blocks.bullet('Produtividade: [Valor/Meta]'),
    Blocks.bullet('Qualidade: [Valor/Meta]'),
    Blocks.bullet('Satisfação da equipe: [Valor/Meta]'),
    
    Blocks.h2('🚧 Desafios Enfrentados'),
    Blocks.bullet('Desafio 1: [Descrição e como foi resolvido]'),
    Blocks.bullet('Desafio 2: [Descrição e status atual]'),
    
    Blocks.h2('📅 Próxima Semana'),
    Blocks.h3('🎯 Objetivos'),
    Blocks.todo('Objetivo 1 para próxima semana', false),
    Blocks.todo('Objetivo 2 para próxima semana', false),
    
    Blocks.h3('🔄 Melhorias Planejadas'),
    Blocks.bullet('Melhoria 1: [Descrição]'),
    Blocks.bullet('Melhoria 2: [Descrição]'),
    
    Blocks.h2('💬 Feedback da Equipe'),
    Blocks.quote('Espaço para feedback e sugestões da equipe'),
  ];
}

/**
 * Bug Report template
 */
export function createBugReportTemplate(variables: TemplateVariables = {}): any[] {
  const {
    priority = 'Média',
    reporter = 'Usuário',
    date = new Date().toLocaleDateString('pt-BR')
  } = variables;

  return [
    Blocks.callout(`🐛 Bug Report - Prioridade: ${priority}`, '🚨', 'red_background'),
    
    Blocks.h2('📋 Informações Básicas'),
    Blocks.bullet(`**Reportado por:** ${reporter}`),
    Blocks.bullet(`**Data:** ${date}`),
    Blocks.bullet(`**Prioridade:** ${priority}`),
    Blocks.bullet('**Status:** 🔍 Em investigação'),
    
    Blocks.h2('🔍 Descrição do Bug'),
    Blocks.text('[Descrição clara e concisa do problema encontrado]'),
    
    Blocks.h2('🔄 Passos para Reproduzir'),
    Blocks.number('Passo 1: [Ação específica]'),
    Blocks.number('Passo 2: [Ação específica]'),
    Blocks.number('Passo 3: [Ação específica]'),
    
    Blocks.h2('✅ Comportamento Esperado'),
    Blocks.text('[Descreva o que deveria acontecer]'),
    
    Blocks.h2('❌ Comportamento Atual'),
    Blocks.text('[Descreva o que está acontecendo]'),
    
    Blocks.h2('🖥️ Ambiente'),
    Blocks.bullet('Sistema Operacional: [Windows/Mac/Linux]'),
    Blocks.bullet('Browser: [Chrome/Firefox/Safari + versão]'),
    Blocks.bullet('Versão da aplicação: [versão]'),
    
    Blocks.h2('📎 Evidências'),
    Blocks.text('• Screenshots: [Anexar se disponível]'),
    Blocks.text('• Logs de erro: [Anexar se disponível]'),
    Blocks.text('• Video: [Anexar se disponível]'),
    
    Blocks.h2('🔧 Possíveis Soluções'),
    Blocks.text('[Se houver ideias de como resolver]'),
    
    Blocks.h2('📝 Notas Adicionais'),
    Blocks.text('[Qualquer informação adicional relevante]'),
  ];
}

/**
 * Get template by type
 */
export function getTemplate(type: TemplateType, variables: TemplateVariables = {}): any[] {
  switch (type) {
    case 'meeting_notes':
      return createMeetingNotesTemplate(variables);
    case 'project_plan':
      return createProjectPlanTemplate(variables);
    case 'documentation':
      return createDocumentationTemplate(variables);
    case 'article':
      return createArticleTemplate(variables);
    case 'weekly_report':
      return createWeeklyReportTemplate(variables);
    case 'bug_report':
      return createBugReportTemplate(variables);
    default:
      throw new Error(`Template type '${type}' not found`);
  }
}

/**
 * List all available templates
 */
export function getAvailableTemplates(): Array<{type: TemplateType, name: string, description: string}> {
  return [
    {
      type: 'meeting_notes',
      name: 'Notas de Reunião',
      description: 'Template estruturado para atas de reunião com agenda, discussões e ações'
    },
    {
      type: 'project_plan',
      name: 'Plano de Projeto',
      description: 'Template completo para planejamento de projetos com cronograma e equipe'
    },
    {
      type: 'documentation',
      name: 'Documentação Técnica',
      description: 'Template para documentação técnica com índice e estrutura profissional'
    },
    {
      type: 'article',
      name: 'Artigo/Blog Post',
      description: 'Template para artigos e posts com estrutura de introdução, desenvolvimento e conclusão'
    },
    {
      type: 'weekly_report',
      name: 'Relatório Semanal',
      description: 'Template para relatórios semanais de equipe com métricas e objetivos'
    },
    {
      type: 'bug_report',
      name: 'Relatório de Bug',
      description: 'Template estruturado para reportar bugs com todas as informações necessárias'
    }
  ];
}
