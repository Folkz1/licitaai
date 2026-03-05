-- Migration 012: Portal Público de Licitações (SEO)
-- Adds slug column for SEO-friendly URLs and search analytics table

BEGIN;

-- 1. Add slug column to licitacoes
ALTER TABLE licitacoes ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Generate slugs for existing records: {uf}-{orgao_sanitizado}-{sequencial}-{ano}
UPDATE licitacoes
SET slug = sub.generated_slug
FROM (
  SELECT
    id,
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          CONCAT(
            COALESCE(LOWER(uf), 'br'), '-',
            LEFT(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  TRANSLATE(
                    LOWER(COALESCE(orgao_nome, 'orgao')),
                    'áàâãäéèêëíìîïóòôõöúùûüçñ',
                    'aaaaaeeeeiiiioooooouuuucn'
                  ),
                  '[^a-z0-9\s]', '', 'g'
                ),
                '\s+', '-', 'g'
              ),
              60
            ), '-',
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(uf, 'BR')
              ORDER BY COALESCE(data_publicacao, created_at)
            )::TEXT, '-',
            EXTRACT(YEAR FROM COALESCE(data_publicacao, created_at))::TEXT
          ),
          '-+', '-', 'g'
        ),
        '(^-|-$)', '', 'g'
      )
    ) AS generated_slug
  FROM licitacoes
  WHERE slug IS NULL
) sub
WHERE licitacoes.id = sub.id;

-- 3. Make slug unique and not null
ALTER TABLE licitacoes ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_licitacoes_slug ON licitacoes(slug);

-- 4. Index for portal queries
CREATE INDEX IF NOT EXISTS idx_licitacoes_data_publicacao_desc ON licitacoes(data_publicacao DESC NULLS LAST);

-- 5. Full-text search index
CREATE INDEX IF NOT EXISTS idx_licitacoes_fts ON licitacoes
  USING GIN (to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(orgao_nome, '')));

-- 6. Portal search analytics table
CREATE TABLE IF NOT EXISTS portal_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT,
  filters_json JSONB,
  results_count INTEGER DEFAULT 0,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_searches_created ON portal_searches(created_at DESC);

COMMIT;
