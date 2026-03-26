# LicitaAI: Multi-Source + Consultancy Tier

**Data:** 2026-03-26
**Status:** DESIGN APROVADO (Diego pediu, Jarbas projetou autonomamente)
**Objetivo:** Colocar LicitaAI no mapa com dados que ninguem mais tem + feature matadora para consultorias

---

## Contexto

LicitaAI hoje busca licitacoes APENAS do PNCP. Isso cobre ~60-70% do mercado federal mas perde:
- Municipios pequenos que publicam so no DOE local
- Dados de preco historico e fornecedores (ComprasNet)
- Oportunidades que aparecem no DOU antes do PNCP
- Dados de compliance/risco dos TCEs

Mercado de consultorias: 5.000-15.000 firmas no Brasil, cobrando R$500-5.000/mes por cliente. Ferramentas atuais (Alerta Licitacao R$35/mes, ConLicitacao, Licitei) nao tem analise IA. LicitaAI pode dominar esse nicho.

---

## Parte 1: Multi-Source Data Aggregator

### Fontes priorizadas (por valor/esforco)

| # | Fonte | API | Esforco | Dados unicos |
|---|-------|-----|---------|-------------|
| 1 | **ComprasNet** | REST, JSON, sem auth | BAIXO | Fornecedores, precos historicos, catalogo CATMAT/CATSER |
| 2 | **Querido Diario** | REST, sem auth | BAIXO | DOEs municipais (350+ cidades), oportunidades invisiveis ao PNCP |
| 3 | **DOU (INLABS)** | XML mensal + RSS | MEDIO | Publicacoes oficiais ANTES do PNCP processar |
| 4 | **TCE-SP** | REST, JSON | BAIXO | Compliance, irregularidades, risco por orgao |
| 5 | **Portal Transparencia** | REST, API key | BAIXO | Execucao contratual, pagamentos, status real |

### Arquitetura: Source Adapter Pattern

```
                   ┌──────────────┐
                   │ Source Manager│ (orquestra todos os adapters)
                   └──────┬───────┘
          ┌────────┬──────┼──────┬─────────┐
          ▼        ▼      ▼      ▼         ▼
     ┌────────┐ ┌─────┐ ┌───┐ ┌─────┐ ┌──────┐
     │PNCP    │ │Comp │ │QD │ │DOU  │ │TCE   │
     │Adapter │ │rasNet│ │API│ │XML  │ │SP    │
     │(atual) │ │Adapt.│ │Ad.│ │Ad.  │ │Adapt.│
     └────┬───┘ └──┬──┘ └─┬─┘ └──┬──┘ └──┬───┘
          │        │      │      │        │
          ▼        ▼      ▼      ▼        ▼
     ┌────────────────────────────────────────┐
     │         Normalizer (formato unico)     │
     │  → numero_controle, orgao, objeto,     │
     │    valor, uf, modalidade, datas,       │
     │    source_id, source_type              │
     └────────────────┬──────────────────────┘
                      ▼
     ┌────────────────────────────────────────┐
     │         Deduplicator                   │
     │  → match por CNPJ orgao + objeto +    │
     │    valor + data (fuzzy)               │
     │  → merge metadados de fontes          │
     └────────────────┬──────────────────────┘
                      ▼
                 licitacoes table
                 (campo source_type novo)
```

### Schema changes

```sql
-- Migration: 014_multi_source.sql

-- Novo campo na tabela licitacoes
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'pncp';
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS source_id TEXT; -- ID na fonte original
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS source_url TEXT; -- Link direto na fonte
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}'; -- dados extras por fonte

-- Tabela de fontes configuradas
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'pncp', 'comprasnet', 'querido_diario', 'dou', 'tce_sp'
  display_name TEXT NOT NULL,
  api_base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- params especificos da fonte
  last_sync_at TIMESTAMPTZ,
  sync_interval_hours INT DEFAULT 24,
  stats JSONB DEFAULT '{}', -- records_total, last_batch_count, errors
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de sync logs
CREATE TABLE IF NOT EXISTS source_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- running, success, error
  records_fetched INT DEFAULT 0,
  records_new INT DEFAULT 0,
  records_enriched INT DEFAULT 0,
  records_deduplicated INT DEFAULT 0,
  error_message TEXT
);

-- Indice para busca por fonte
CREATE INDEX IF NOT EXISTS idx_licitacoes_source ON licitacoes(source_type);

-- Seed das fontes
INSERT INTO data_sources (name, display_name, api_base_url, is_active, sync_interval_hours) VALUES
  ('pncp', 'PNCP (Portal Nacional)', 'https://pncp.gov.br/api/consulta/v1', true, 12),
  ('comprasnet', 'ComprasNet (Federal)', 'https://compras.dados.gov.br', true, 24),
  ('querido_diario', 'Querido Diario (DOEs Municipais)', 'https://queridodiario.ok.org.br/api', true, 24),
  ('dou', 'DOU (Diario Oficial da Uniao)', 'https://in.gov.br', true, 24),
  ('tce_sp', 'TCE-SP (Tribunal de Contas SP)', 'https://transparencia.tce.sp.gov.br', false, 168)
ON CONFLICT (name) DO NOTHING;
```

### Adapter interface (TypeScript)

```typescript
// src/lib/sources/types.ts
export interface SourceAdapter {
  name: string;
  fetchLatest(params: FetchParams): Promise<RawRecord[]>;
  normalize(raw: RawRecord): NormalizedLicitacao;
  enrichExisting?(licitacaoId: string, raw: RawRecord): Promise<EnrichmentData>;
}

export interface FetchParams {
  dateFrom: Date;
  dateTo: Date;
  ufs?: string[];
  keywords?: string[];
  tenantId?: string; // para buscas personalizadas
}

export interface NormalizedLicitacao {
  numero_controle_pncp?: string;
  orgao_nome: string;
  orgao_cnpj?: string;
  objeto_compra: string;
  valor_total_estimado?: number;
  modalidade_contratacao?: string;
  uf: string;
  municipio?: string;
  data_publicacao: Date;
  data_encerramento_proposta?: Date;
  source_type: string;
  source_id: string;
  source_url?: string;
  enrichment_data?: Record<string, unknown>;
}
```

### Implementacao por fonte

**ComprasNet (Prioridade 1):**
- Endpoint: `GET compras.dados.gov.br/licitacoes/v1/licitacoes.json`
- Filtros: `data_abertura_de`, `data_abertura_ate`, `uf`, `modalidade`
- Enriquecimento: fornecedores participantes, precos praticados, resultado do certame
- Cron: a cada 24h

**Querido Diario (Prioridade 1):**
- Endpoint: `GET queridodiario.ok.org.br/api/gazettes`
- Filtros: `territory_ids`, `since`, `until`, `querystring` (keywords)
- Parse: full-text search por termos de licitacao no conteudo do DOE
- Regex para extrair: numero processo, valor estimado, data abertura, orgao
- Cron: a cada 24h

**DOU INLABS (Prioridade 2):**
- Download: XML mensal via INLABS ou RSS diario
- Parse: secao 3 do DOU (contratos e licitacoes)
- Keywords: "pregao", "licitacao", "edital", "concorrencia", "tomada de preco"
- Cron: diario (RSS) ou mensal (XML bulk)

### Deduplicacao

Estrategia de match (em ordem de confianca):
1. `numero_controle_pncp` exato (100% confianca)
2. `orgao_cnpj` + `objeto_compra` similarity > 0.85 + `valor` delta < 5%
3. `orgao_nome` fuzzy + `data_publicacao` mesmo dia + `valor` exato

Quando match encontrado: merge `enrichment_data` de ambas as fontes, manter o registro mais completo como principal.

---

## Parte 2: Tier Consultoria

### Conceito

Consultorias gerenciam 10-50 clientes simultaneamente. Precisam de:
- Dashboard multi-cliente (ver todas as oportunidades de todos os clientes num lugar)
- Configuracao independente por cliente (keywords, UFs, modalidades diferentes)
- Relatorios por cliente (para justificar o fee mensal)
- White-label basico (logo da consultoria nos relatorios)

### Modelo de dados

```sql
-- Migration: 015_consultancy_tier.sql

-- Tipo de tenant: empresa ou consultoria
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_type TEXT DEFAULT 'empresa';
-- 'empresa' = usuario final
-- 'consultoria' = gerencia multiplos clientes

-- Relacao consultoria -> clientes
CREATE TABLE IF NOT EXISTS consultancy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_tenant_id UUID NOT NULL REFERENCES tenants(id), -- a consultoria
  client_tenant_id UUID NOT NULL REFERENCES tenants(id), -- o cliente
  status TEXT DEFAULT 'active', -- active, paused, churned
  contract_type TEXT, -- retainer, per_process, success_fee, hybrid
  monthly_fee_cents INT, -- valor mensal em centavos
  success_fee_percent NUMERIC(5,2), -- % sobre contratos ganhos
  notes TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE(consultancy_tenant_id, client_tenant_id)
);

-- Relatorio mensal por cliente
CREATE TABLE IF NOT EXISTS consultancy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultancy_tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_tenant_id UUID NOT NULL REFERENCES tenants(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL, -- oportunidades_encontradas, analisadas, pipeline_valor, ganhas, perdidas
  generated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ, -- quando enviou pro cliente
  UNIQUE(consultancy_tenant_id, client_tenant_id, period_start)
);

-- Indice
CREATE INDEX IF NOT EXISTS idx_consultancy_clients_consultancy ON consultancy_clients(consultancy_tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultancy_clients_client ON consultancy_clients(client_tenant_id);
```

### Plano de precos (novo tier)

| Plano | Preco | Clientes | Buscas/dia | Usuarios | Features |
|-------|-------|----------|-----------|----------|----------|
| Starter | R$197/mes | 1 empresa | 5 | 2 | PNCP only |
| Pro | R$397/mes | 1 empresa | 20 | 5 | Multi-source, AI analysis |
| **Consultoria** | **R$997/mes** | **ate 10 clientes** | **100** | **10** | **Multi-source, AI, dashboard multi-cliente, relatorios** |
| Enterprise | R$1.997/mes | ilimitado | ilimitado | 50 | Tudo + API + white-label |

### Features da pagina /consultoria (dashboard multi-cliente)

1. **Overview**: cards com metricas agregadas de todos os clientes
   - Total oportunidades no periodo
   - Valor total pipeline (soma de todos os clientes)
   - Clientes ativos vs inativos
   - Top 3 oportunidades cross-client

2. **Client list**: tabela com cada cliente
   - Nome, status, oportunidades novas, pipeline R$, ultima busca
   - Click para ver dashboard individual do cliente

3. **Cross-client search**: busca unificada em todos os clientes
   - "Mostra todas as licitacoes de hospitais de todos os meus clientes"
   - Filtro por cliente, UF, valor, prazo

4. **Relatorio mensal**: geracao automatica por cliente
   - Oportunidades encontradas, analisadas, rejeitadas
   - Valor total pipeline
   - Status por fase (kanban agregado)
   - Export PDF para enviar ao cliente

5. **Gestao de clientes**: CRUD
   - Adicionar cliente (cria tenant vinculado)
   - Configurar busca por cliente (keywords, UFs, modalidades)
   - Pausar/reativar cliente
   - Historico de contrato (valor, tipo)

---

## Parte 3: Sequencia de Implementacao

### Sprint 1 (esta semana): Source Adapter Framework + ComprasNet
- Migration 014_multi_source.sql
- Source adapter interface (`src/lib/sources/types.ts`)
- PNCP adapter (refactor do scraper atual)
- ComprasNet adapter (REST, JSON, sem auth)
- Source Manager (orquestra adapters)
- Cron route `/api/cron/sync-sources`
- Dashboard: badge de fonte em cada licitacao

### Sprint 2: Querido Diario + DOU
- Querido Diario adapter (REST API, parse full-text)
- DOU adapter (XML parse, secao 3)
- Deduplicator (match por CNPJ + objeto + valor)
- Dashboard: filtro por fonte
- Config: toggle de fontes por tenant

### Sprint 3: Consultancy Tier
- Migration 015_consultancy_tier.sql
- Tenant type selection no onboarding
- Dashboard `/consultoria` (multi-client overview)
- Client management CRUD
- Cross-client search
- Relatorio mensal (auto-generate + PDF export)

### Sprint 4: TCE + Transparencia + Polish
- TCE-SP adapter (compliance/risco)
- Portal Transparencia adapter (execucao contratual)
- Risk score por orgao (baseado em TCE data)
- Onboarding para consultorias (wizard especifico)
- Landing page `/para-consultorias`

---

## Decisoes tecnicas

1. **Adapters como modulos isolados**: cada fonte em `src/lib/sources/{nome}.ts`, interface unica
2. **Deduplicacao lazy**: primeiro insere com `source_type`, depois roda dedup em batch (nao bloqueia ingestao)
3. **Sem ORM**: manter pg Pool direto (padrao do projeto)
4. **Multi-tenant para consultorias**: consultoria e um tenant normal que "possui" outros tenants via `consultancy_clients`
5. **Crons internos**: manter decisao arquitetural de zero N8N, tudo via `/api/cron/`
6. **Enrichment incremental**: ComprasNet e TCE enriquecem licitacoes existentes, nao criam duplicatas

## Metricas de sucesso

- **Cobertura**: de ~60% (PNCP only) para ~85%+ (multi-source)
- **Oportunidades unicas**: >20% das licitacoes vindas de fontes nao-PNCP
- **Consultoria MRR**: 5 consultorias pagando = R$5.000/mes
- **Retencao**: consultorias tem churn muito mais baixo que usuarios finais (contrato B2B)
