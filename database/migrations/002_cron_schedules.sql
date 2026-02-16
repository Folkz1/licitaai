-- Migration 002: Cron schedules per tenant
-- Each tenant can configure when their searches and analyses run automatically

CREATE TABLE IF NOT EXISTS cron_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL CHECK (workflow IN ('BUSCA_PNCP', 'ANALISE_EDITAIS')),
  enabled BOOLEAN DEFAULT TRUE,
  -- Schedule config (simpler than cron expression for the UI)
  frequency TEXT NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('HOURLY', 'DAILY', 'WEEKLY', 'CUSTOM')),
  hour INT DEFAULT 6 CHECK (hour BETWEEN 0 AND 23),          -- hora do dia (0-23)
  minute INT DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),      -- minuto (0-59)
  days_of_week INT[] DEFAULT '{1,2,3,4,5}',                  -- 0=dom, 1=seg..6=sab
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  -- Workflow params
  params JSONB DEFAULT '{}',  -- { max_licitacoes: 10, force: false }
  -- Tracking
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, workflow)
);

CREATE INDEX IF NOT EXISTS idx_cron_next_run ON cron_schedules(next_run_at) WHERE enabled = TRUE;

-- Seed default schedules for existing tenants
INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
SELECT id, 'BUSCA_PNCP', 'DAILY', 6, 0, '{1,2,3,4,5}', '{"force": false}'
FROM tenants
ON CONFLICT (tenant_id, workflow) DO NOTHING;

INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
SELECT id, 'ANALISE_EDITAIS', 'DAILY', 8, 0, '{1,2,3,4,5}', '{"max_licitacoes": 10}'
FROM tenants
ON CONFLICT (tenant_id, workflow) DO NOTHING;
