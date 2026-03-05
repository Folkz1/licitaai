-- 013_leads_and_enrichment.sql
-- Portal leads capture + flywheel intelligence columns

-- Table: portal_leads (captures visitors who fill lead form)
CREATE TABLE IF NOT EXISTS portal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  empresa TEXT,
  interesse TEXT,
  source_url TEXT,
  source_slug TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_leads_created_at ON portal_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_leads_email ON portal_leads (email);

-- Add flywheel columns to licitacoes
DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN analysis_count INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN avg_score NUMERIC;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add public preview flag to analises
DO $$ BEGIN
  ALTER TABLE analises ADD COLUMN is_public_preview BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Index for portal queries filtering by analysis
CREATE INDEX IF NOT EXISTS idx_licitacoes_analysis_count ON licitacoes (analysis_count) WHERE analysis_count > 0;
