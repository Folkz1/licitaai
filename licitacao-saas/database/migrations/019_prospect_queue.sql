-- Migration 019: Add queue status for batch prospection
-- No schema change needed - prospect_status is TEXT, new values: 'fila', 'erro_envio'
-- Just add a comment for documentation

COMMENT ON COLUMN portal_leads.prospect_status IS 'Prospect funnel: fila -> enviado -> acessou -> ativo -> expirado -> convertido | erro_envio';

-- Index to speed up queue queries
CREATE INDEX IF NOT EXISTS idx_portal_leads_prospect_fila
  ON portal_leads(created_at ASC)
  WHERE source = 'prospeccao' AND prospect_status = 'fila';
