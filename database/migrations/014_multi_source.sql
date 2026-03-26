-- Migration 014: Multi-Source Data Aggregator
-- Adds support for multiple data sources beyond PNCP
-- Sources: ComprasNet, Querido Diario (DOEs), DOU, TCE-SP, Portal Transparencia
-- All changes are additive (no DROP)

-- 1. Add source columns to licitacoes
DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN source_type TEXT DEFAULT 'pncp';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN source_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN source_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN enrichment_data JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Data sources registry
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  sync_interval_hours INT DEFAULT 24,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Sync operation logs
CREATE TABLE IF NOT EXISTS source_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  records_fetched INT DEFAULT 0,
  records_new INT DEFAULT 0,
  records_enriched INT DEFAULT 0,
  records_deduplicated INT DEFAULT 0,
  error_message TEXT
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_licitacoes_source_type ON licitacoes(source_type);
CREATE INDEX IF NOT EXISTS idx_licitacoes_source_id ON licitacoes(source_id);
CREATE INDEX IF NOT EXISTS idx_source_sync_logs_source ON source_sync_logs(source_name);
CREATE INDEX IF NOT EXISTS idx_source_sync_logs_tenant ON source_sync_logs(tenant_id);

-- 5. Seed data sources
INSERT INTO data_sources (name, display_name, api_base_url, is_active, sync_interval_hours, config) VALUES
  ('pncp', 'PNCP (Portal Nacional)', 'https://pncp.gov.br/api/consulta/v1', true, 6, '{"page_size": 50, "delay_ms": 550}'),
  ('comprasnet', 'ComprasNet (Federal)', 'https://compras.dados.gov.br', true, 12, '{"modules": ["licitacoes", "fornecedores"]}'),
  ('querido_diario', 'Querido Diario (DOEs Municipais)', 'https://queridodiario.ok.org.br/api', true, 24, '{"territory_count": 350}'),
  ('dou', 'DOU (Diario Oficial da Uniao)', 'https://in.gov.br', true, 24, '{"sections": [3], "keywords": ["pregao","licitacao","edital","concorrencia"]}'),
  ('tce_sp', 'TCE-SP (Tribunal de Contas SP)', 'https://transparencia.tce.sp.gov.br', false, 168, '{"data_type": "compliance"}')
ON CONFLICT (name) DO NOTHING;
