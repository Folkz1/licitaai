-- Trial growth engine: WhatsApp qualification + assisted trial + autologin

INSERT INTO plans (
  name,
  display_name,
  max_licitacoes_per_month,
  max_users,
  max_searches_per_day,
  features,
  price_monthly_cents,
  is_active,
  max_tokens_per_month
)
VALUES (
  'trial_7d',
  'Trial 7 Dias',
  50,
  1,
  5,
  '{
    "trial_days": 7,
    "daily_analysis_limit": 5,
    "enforce_trial": true,
    "show_trial_banner": true,
    "allow_batch_analysis": true,
    "channel": "whatsapp"
  }'::jsonb,
  0,
  false,
  200000
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  max_licitacoes_per_month = EXCLUDED.max_licitacoes_per_month,
  max_users = EXCLUDED.max_users,
  max_searches_per_day = EXCLUDED.max_searches_per_day,
  features = EXCLUDED.features,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  is_active = EXCLUDED.is_active,
  max_tokens_per_month = EXCLUDED.max_tokens_per_month;

CREATE TABLE IF NOT EXISTS access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'AUTOLOGIN' CHECK (kind IN ('AUTOLOGIN')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_tenant ON access_tokens(tenant_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_tokens_user ON access_tokens(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS tenant_daily_usage (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  metric TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, usage_date, metric)
);

CREATE INDEX IF NOT EXISTS idx_tenant_daily_usage_metric ON tenant_daily_usage(metric, usage_date DESC);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES portal_leads(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL DEFAULT 'new',
  status TEXT NOT NULL DEFAULT 'active',
  collected_data JSONB DEFAULT '{}'::jsonb,
  last_inbound_at TIMESTAMPTZ DEFAULT NOW(),
  last_outbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_stage ON whatsapp_conversations(current_stage, updated_at DESC);

ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS trial_status TEXT;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS qualification_channel TEXT DEFAULT 'portal';
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS qualification_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE portal_leads ADD COLUMN IF NOT EXISTS access_token_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_portal_leads_trial_status ON portal_leads(trial_status);
CREATE INDEX IF NOT EXISTS idx_portal_leads_tenant_id ON portal_leads(tenant_id);
