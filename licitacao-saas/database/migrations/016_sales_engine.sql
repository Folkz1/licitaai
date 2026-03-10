-- Lead nurturing sequences
CREATE TABLE IF NOT EXISTS lead_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  step INTEGER DEFAULT 1,
  channel TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message_text TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_seq_status ON lead_sequences(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_seq_scheduled ON lead_sequences(scheduled_at) WHERE status = 'pending';

-- Lead alerts for matching licitações
CREATE TABLE IF NOT EXISTS lead_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  licitacao_id UUID,
  match_score FLOAT,
  match_reason TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_alerts_status ON lead_alerts(status) WHERE status = 'pending';

-- Enrich portal_leads with sales fields
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'novo';
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 0;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS interest_keywords TEXT[];
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS interest_uf TEXT;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT false;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leads_status ON portal_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON portal_leads(score DESC);
