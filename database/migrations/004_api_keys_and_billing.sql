-- ============================================
-- Migration 004: API Keys + Usage Billing
-- ============================================

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,        -- SHA-256 hash of the key
  key_prefix VARCHAR(12) NOT NULL,             -- First 8 chars for display (sk-xxxx...)
  permissions JSONB DEFAULT '["read"]'::jsonb, -- ["read", "write", "trigger"]
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_day INT DEFAULT 5000,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(tenant_id, is_active) WHERE is_active = TRUE;

-- API Usage / Billing table (per-call tracking)
CREATE TABLE IF NOT EXISTS api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint VARCHAR(200) NOT NULL,              -- e.g. "GET /api/v1/licitacoes"
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  status_code INT NOT NULL DEFAULT 200,
  response_time_ms INT,                        -- latency
  credits_consumed NUMERIC(10,4) DEFAULT 1.0,  -- credits per call (different endpoints may cost different)
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',                 -- extra info (query params, filters used, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_key ON api_usage(api_key_id, created_at DESC);
CREATE INDEX idx_api_usage_tenant ON api_usage(tenant_id, created_at DESC);
CREATE INDEX idx_api_usage_daily ON api_usage(tenant_id, created_at);

-- Credit balance per tenant
CREATE TABLE IF NOT EXISTS api_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  balance NUMERIC(12,4) DEFAULT 0,             -- current credit balance
  total_purchased NUMERIC(12,4) DEFAULT 0,     -- historical total purchased
  total_consumed NUMERIC(12,4) DEFAULT 0,      -- historical total consumed
  free_credits_granted NUMERIC(12,4) DEFAULT 100, -- free trial credits
  alert_threshold NUMERIC(12,4) DEFAULT 50,    -- alert when balance drops below
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_credits_tenant ON api_credits(tenant_id);

-- Credit pricing configuration
CREATE TABLE IF NOT EXISTS api_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern VARCHAR(200) NOT NULL,      -- e.g. "GET /api/v1/licitacoes", "POST /api/v1/busca"
  credits_per_call NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default pricing
INSERT INTO api_pricing (endpoint_pattern, credits_per_call, description) VALUES
  ('GET /api/v1/licitacoes',        1.0,  'Listar licitacoes'),
  ('GET /api/v1/licitacoes/:id',    2.0,  'Detalhes de uma licitacao'),
  ('GET /api/v1/licitacoes/:id/itens', 2.0, 'Itens de uma licitacao'),
  ('GET /api/v1/licitacoes/:id/analise', 5.0, 'Analise completa com IA'),
  ('GET /api/v1/stats',             1.0,  'Estatisticas do tenant'),
  ('POST /api/v1/busca',           10.0,  'Disparar busca no PNCP'),
  ('POST /api/v1/analise',         20.0,  'Disparar analise com IA')
ON CONFLICT DO NOTHING;

-- Function to consume credits atomically
CREATE OR REPLACE FUNCTION consume_api_credits(
  p_tenant_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- Try to update and check balance atomically
  UPDATE api_credits
  SET balance = balance - p_amount,
      total_consumed = total_consumed + p_amount,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND (balance + free_credits_granted - total_consumed) >= p_amount
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RETURN FALSE; -- insufficient credits
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add initial credits when a tenant is created (trigger)
CREATE OR REPLACE FUNCTION grant_initial_api_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_credits (tenant_id, balance, free_credits_granted)
  VALUES (NEW.id, 100, 100)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grant_initial_credits ON tenants;
CREATE TRIGGER trg_grant_initial_credits
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION grant_initial_api_credits();

-- Grant initial credits to existing tenants
INSERT INTO api_credits (tenant_id, balance, free_credits_granted)
SELECT id, 100, 100 FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
