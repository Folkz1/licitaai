-- Migration 018: Prospecção - tracking de prospects com trial gifted
-- Adiciona colunas para rastrear origem e status de prospects no portal_leads

-- Origem do lead: organic (portal), prospeccao (admin), whatsapp (bot), etc.
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'organic';

-- Status do prospect no funil de prospecção
-- Valores: enviado, acessou, ativo, expirado, convertido
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS prospect_status TEXT DEFAULT NULL;

-- Rastreamento de acessos do prospect
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS first_access_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Indices para consultas de prospecção
CREATE INDEX IF NOT EXISTS idx_portal_leads_source ON portal_leads(source);
CREATE INDEX IF NOT EXISTS idx_portal_leads_prospect_status ON portal_leads(prospect_status) WHERE prospect_status IS NOT NULL;
