# AI-CONTEXT: LicitaIA - Plataforma SaaS de Analise de Editais

> Este arquivo existe para que QUALQUER IA (Claude, GPT, Gemini, etc.) possa entender e continuar este projeto abrindo APENAS esta pasta `licitacao-saas/`.

## O que e este projeto?

**LicitaIA** e um micro-SaaS multi-tenant para analise automatizada de licitacoes do governo brasileiro (PNCP). O sistema:

1. **Busca** licitacoes no PNCP automaticamente (via n8n)
2. **Analisa** editais com IA (OCR + RAG + LLM) (via n8n)
3. **Exibe** resultados em dashboard web (este app Next.js)
4. **Permite revisao humana** via pipeline Kanban
5. **Suporta multi-tenant** (varias empresas, cada uma ve so seus dados)
6. **API publica paga por chamada** com sistema de creditos e API keys

## Arquitetura

```
[Next.js App] <--webhook--> [n8n Workflows] <--API--> [PNCP Gov]
     |                           |                        |
     v                           v                        v
[PostgreSQL + pgvector]     [OCR Supremo]          [Editais PDF]
     (EasyPanel)            [OpenAI Embeddings]
                            [OpenRouter/Gemini]
     |
     v
[API Publica /api/v1/*]  <-- API Keys + Creditos + Rate Limiting
```

- **Next.js 16 (App Router)** = frontend + API + auth + API publica
- **n8n** = workflows pesados (busca, OCR, RAG, analise IA)
- **PostgreSQL** no EasyPanel = banco unico para tudo
- **NextAuth.js v5** = auth com credentials (email/senha)

## Stack Tecnica

| O que     | Tecnologia                                       |
| --------- | ------------------------------------------------ |
| Framework | Next.js 16, TypeScript, App Router               |
| UI        | Tailwind CSS, shadcn/ui, Recharts, Lucide Icons  |
| Auth      | NextAuth.js v5 (Credentials Provider)            |
| Banco     | PostgreSQL + pgvector (EasyPanel)                |
| ORM       | Raw SQL via `pg` (sem Prisma)                    |
| Workflows | n8n (separado, JSONs na pasta pai)               |
| IA        | OpenAI (embeddings), OpenRouter/Gemini (analise) |
| Billing   | API Keys + creditos por chamada (interno)        |

## Estrutura de Pastas

```
licitacao-saas/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx           # Tela de login
│   │   ├── (dashboard)/                    # Layout com sidebar
│   │   │   ├── dashboard/page.tsx          # Dashboard (KPIs + graficos + urgentes)
│   │   │   ├── licitacoes/page.tsx         # Lista com cards + filtros + urgencia
│   │   │   ├── licitacoes/[id]/page.tsx    # Detalhe + analise IA + itens
│   │   │   ├── pipeline/page.tsx           # Kanban de revisao humana
│   │   │   ├── configuracoes/page.tsx      # Keywords + config busca
│   │   │   ├── api-keys/page.tsx           # Gestao de API Keys + creditos + pricing
│   │   │   └── admin/
│   │   │       ├── tenants/page.tsx        # Gerenciar empresas
│   │   │       ├── users/page.tsx          # Gerenciar usuarios
│   │   │       └── custos/page.tsx         # Custos LLM
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts # NextAuth
│   │   │   ├── dashboard/stats/route.ts    # KPIs, graficos, licitacoes urgentes
│   │   │   ├── licitacoes/route.ts         # CRUD lista
│   │   │   ├── licitacoes/[id]/route.ts    # Detalhe
│   │   │   ├── licitacoes/[id]/status/     # Mudar fase
│   │   │   ├── licitacoes/[id]/notes/      # Notas/historico
│   │   │   ├── n8n/trigger-busca/          # Dispara busca n8n
│   │   │   ├── n8n/trigger-analise/        # Dispara analise n8n
│   │   │   ├── n8n/callback/               # n8n reporta resultado + LLM usage
│   │   │   ├── configuracoes/              # Config busca
│   │   │   ├── configuracoes/keywords/     # CRUD palavras-chave
│   │   │   ├── configuracoes/api-keys/     # CRUD API Keys (interno)
│   │   │   ├── cron/execute/               # Execucao de crons
│   │   │   ├── public/licitacoes/[id]/     # Preview publico (limitado)
│   │   │   ├── admin/tenants|users|llm/    # CRUD admin
│   │   │   └── v1/                         # *** API PUBLICA (paga por chamada) ***
│   │   │       ├── licitacoes/route.ts     # GET listar (1 credito)
│   │   │       ├── licitacoes/[id]/route.ts # GET detalhes (2 creditos)
│   │   │       ├── stats/route.ts          # GET estatisticas (1 credito)
│   │   │       ├── usage/route.ts          # GET uso/creditos (gratis)
│   │   │       └── docs/route.ts           # GET documentacao da API
│   │   ├── p/[id]/page.tsx                 # Pagina publica de licitacao
│   │   └── layout.tsx                      # Root (SessionProvider)
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   └── dashboard/
│   │       ├── Sidebar.tsx                 # Menu lateral (com API Keys link)
│   │       └── Header.tsx                  # Barra superior
│   ├── lib/
│   │   ├── auth.ts                         # NextAuth config
│   │   ├── db.ts                           # PostgreSQL pool (query/queryOne)
│   │   ├── api-key.ts                      # *** Middleware API: auth, rate limit, billing ***
│   │   ├── tenant.ts                       # Tenant context helper
│   │   ├── n8n/client.ts                   # Webhook triggers
│   │   └── utils.ts                        # shadcn cn() helper
│   └── types/
│       └── next-auth.d.ts                  # Type augmentation
├── database/
│   └── migrations/
│       ├── 001_users_and_auth.sql          # Users, plans, subscriptions, reviews
│       ├── 002_cron_schedules.sql          # Agendamentos
│       ├── 003_llm_usage_tracking.sql      # Tracking de uso de LLM
│       └── 004_api_keys_and_billing.sql    # *** API Keys, usage, credits, pricing ***
├── .env.local                              # Credenciais (NAO commitar)
└── AI-CONTEXT.md                           # ESTE ARQUIVO
```

## Banco de Dados

**Conexao**: Ver `.env.local` (DATABASE_URL)

### Tabelas Existentes (criadas pelo n8n)

- `tenants` - empresas/clientes
- `configuracoes_busca` - filtros de busca por tenant
- `palavras_chave` - keywords inclusao/exclusao
- `licitacoes` - licitacoes encontradas (tabela principal)
- `editais` - texto OCR dos editais
- `itens_licitacao` - itens extraidos pela IA
- `analises` - resultado da analise IA
- `log_execucoes` - logs dos workflows
- `project_knowledge_base` - vetores RAG (pgvector)
- `vw_licitacoes_pendentes` - view de pendentes

### Tabelas de Auth (001_users_and_auth.sql)

- `users` - usuarios com password_hash e role
- `plans` - planos (starter/pro/enterprise)
- `subscriptions` - assinatura do tenant
- `review_actions` - historico de acoes no pipeline

### Tabelas de Billing/API (004_api_keys_and_billing.sql) ⚠️ PENDENTE EXECUCAO

- `api_keys` - chaves de API com hash SHA-256, permissoes, rate limits
- `api_usage` - log de cada chamada (endpoint, latencia, creditos, IP)
- `api_credits` - saldo de creditos por tenant (balance + free + consumed)
- `api_pricing` - tabela de precos por endpoint
- `consume_api_credits()` - funcao atomica para debitar creditos
- `grant_initial_api_credits()` - trigger que da 100 creditos gratis a novos tenants

### Colunas Adicionadas em licitacoes

- `review_phase` - fase no pipeline (NOVA, PRE_TRIAGEM, ANALISE, DECISAO, PREPARACAO, PARTICIPANDO, CONCLUIDA, REJEITADA)
- `assigned_to` - UUID do analista
- `priority_override` - prioridade manual
- `review_notes` - notas

## Autenticacao

- NextAuth.js v5 com Credentials Provider
- JWT contem: `sub` (user id), `role`, `tenantId`, `tenantName`
- Roles: SUPER_ADMIN, ADMIN, ANALYST, VIEWER
- Middleware em `src/middleware.ts` protege todas as rotas
- Admin cria usuarios manualmente (venda via WhatsApp/PIX)

## Endpoints da API (Internos - requer Session)

| Metodo          | Rota                        | Descricao                           |
| --------------- | --------------------------- | ----------------------------------- |
| GET             | /api/dashboard/stats        | KPIs, graficos, licitacoes urgentes |
| GET             | /api/licitacoes             | Lista paginada com filtros          |
| GET             | /api/licitacoes/[id]        | Detalhe + analise + itens           |
| PATCH           | /api/licitacoes/[id]/status | Mudar fase no pipeline              |
| GET/POST        | /api/licitacoes/[id]/notes  | Notas e historico                   |
| POST            | /api/n8n/trigger-busca      | Dispara busca PNCP via n8n          |
| POST            | /api/n8n/trigger-analise    | Dispara analise via n8n             |
| POST            | /api/n8n/callback           | n8n reporta resultado + LLM usage   |
| GET             | /api/configuracoes          | Config busca + keywords             |
| POST/DELETE     | /api/configuracoes/keywords | CRUD keywords                       |
| GET/POST/DELETE | /api/configuracoes/api-keys | CRUD API Keys                       |
| GET/POST        | /api/admin/tenants          | Gerenciar tenants                   |
| GET/POST        | /api/admin/users            | Gerenciar usuarios                  |
| GET             | /api/admin/llm-usage        | Custos LLM                          |

## API Publica v1 (requer API Key - cobranca por chamada)

| Metodo | Rota                   | Creditos | Descricao                               |
| ------ | ---------------------- | -------- | --------------------------------------- |
| GET    | /api/v1/licitacoes     | 1        | Lista com filtros, paginacao, ordenacao |
| GET    | /api/v1/licitacoes/:id | 2        | Detalhes completos + analise + itens    |
| GET    | /api/v1/stats          | 1        | KPIs e distribuicoes                    |
| GET    | /api/v1/usage          | 0        | Saldo de creditos e historico de uso    |
| GET    | /api/v1/docs           | 0        | Documentacao da API (JSON)              |

### Autenticacao da API v1

- Header: `Authorization: Bearer sk-licitaia-xxx` ou `X-API-Key: sk-licitaia-xxx`
- Keys geradas na pagina `/api-keys` do dashboard
- Cada key tem: permissoes (read/write/trigger), rate limits, expiracao
- Key armazenada como SHA-256 hash (a chave real so e mostrada 1 vez)

### Sistema de Creditos

- Cada tenant recebe 100 creditos gratis ao ser criado
- Cada endpoint custa X creditos (ver tabela acima)
- Creditos debitados atomicamente via funcao SQL
- Headers de resposta: `X-Credits-Consumed`, `X-Credits-Remaining`
- HTTP 402 quando creditos insuficientes
- HTTP 429 quando rate limit excedido

### Middleware `src/lib/api-key.ts`

- `withApiKey(req, options)` - valida key, rate limit, permissoes
- `trackApiUsage(ctx, req, endpoint, status, startTime)` - registra uso
- `checkCredits(tenantId, endpoint)` - verifica saldo antes da chamada
- `generateApiKey()` - gera `sk-licitaia-{random}` + hash + prefix

## Integracao com n8n

Workflows n8n com webhook triggers configurados:

- `POST {N8N_BASE}/webhook/busca-pncp` - payload: `{ tenant_id, force? }`
- `POST {N8N_BASE}/webhook/analise-editais` - payload: `{ tenant_id, max_licitacoes?, licitacao_ids? }`

Config Tenant nos workflows usa `tenant_id` do payload com fallback hardcoded.

Os JSONs dos workflows estao na pasta pai: `../Clear - Busca PNCP v2*.json` e `../Clear - Analise Editais*.json`

## Variaveis de Ambiente (.env.local)

```
DATABASE_URL=postgres://...           # PostgreSQL no EasyPanel
NEXTAUTH_SECRET=...                   # Chave para JWT
NEXTAUTH_URL=http://localhost:3000    # URL da app
N8N_BASE_URL=https://...              # URL base do n8n
N8N_WEBHOOK_BUSCA_URL=https://.../webhook/busca-pncp
N8N_WEBHOOK_ANALISE_URL=https://.../webhook/analise-editais
N8N_WEBHOOK_SECRET=...                # Auth para webhooks
NEXT_PUBLIC_APP_NAME=LicitaIA
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Design System

- **Tema**: Dark mode (slate-900/950)
- **Cores**: indigo (primaria), purple (secundaria), emerald (sucesso), amber (alerta), red (erro)
- **UI**: Cards com gradientes, hover effects, glow decorativo
- **Tipografia**: Tracking wider em headers, tabular-nums em numeros
- **Sidebar**: Gradients, icones em containers, barra lateral ativa, status online pulse
- **Licitacoes**: Cards com barra lateral de prioridade, countdown de urgencia com cores
- **Dashboard**: KPI cards com gradiente, pipeline visual, painel urgentes, charts premium

## Tarefas Pendentes (TODO)

### ⚠️ URGENTE: Executar Migration 004

- **Problema**: Index parcial `idx_api_usage_daily` usa `NOW()` que nao e IMMUTABLE
- **Solucao**: Remover esse index parcial ou trocar para index simples
- **Arquivo**: `database/migrations/004_api_keys_and_billing.sql` (line 44)
- **Apos corrigir**: Rodar migration no banco de producao

### Fase 3: Onboarding com IA

- Wizard de 5 passos em `/onboarding`
- IA entende a empresa e auto-gera keywords, filtros, prompts
- API route com streaming (Vercel AI SDK)

### Fase 4: Melhorias no RAG

- Chunking semantico (por secoes do edital)
- Busca hibrida (vector + BM25/tsvector)
- Queries dinamicas (LLM gera queries especificas)
- Aumentar top_k de 8 para 12-15

### Fase 5: Gestao de Prompts

- CRUD de prompts no banco com versionamento
- Editor com highlight de variaveis {{ }}
- A/B testing de prompts
- n8n busca prompt do banco ao inves de hardcoded

### Fase 6: SaaS + Billing (parcialmente feito ✅)

- ✅ API Keys com hash SHA-256
- ✅ Rate limiting por minuto/dia
- ✅ Cobranca por chamada com creditos
- ✅ Tabela de precos por endpoint
- ✅ Pagina de gestao de API Keys
- ✅ Middleware de validacao completo
- ✅ Documentacao da API auto-gerada
- ⬜ Integracao com gateway de pagamento (Stripe/Asaas) para compra de creditos
- ⬜ Webhook de pagamento para recarregar creditos
- ⬜ Email de alerta quando creditos estao baixos
- ⬜ Pagina publica bonita para API docs (Swagger-like)

### Melhorias Futuras

- ⬜ Endpoint POST /api/v1/busca (trigger busca via API, 10 creditos)
- ⬜ Endpoint POST /api/v1/analise (trigger analise via API, 20 creditos)
- ⬜ Dashboard de uso da API (graficos de consumo por dia/endpoint)
- ⬜ Super admin panel completo
- ⬜ Middleware de enforcement de planos

## Como Rodar

```bash
cd licitacao-saas
npm install
# Rodar migrations no banco:
# psql DATABASE_URL < database/migrations/001_users_and_auth.sql
# psql DATABASE_URL < database/migrations/004_api_keys_and_billing.sql  # ⚠️ corrigir NOW() primeiro
npm run dev
```

## Convencoes

- SQL raw via `query()` e `queryOne()` de `@/lib/db`
- Toda API route interna valida `auth()` e usa `session.user.tenantId`
- API v1 publica valida via `withApiKey()` de `@/lib/api-key`
- UI usa shadcn/ui + Tailwind dark theme (slate-900/950)
- Cores: indigo (primaria), purple (secundaria), emerald (sucesso), red (erro)
- API Keys geradas como `sk-licitaia-{hex}`, armazenadas como hash SHA-256
- Creditos debitados atomicamente, resposta inclui saldo restante
