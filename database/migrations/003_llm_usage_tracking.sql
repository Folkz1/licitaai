-- Migration 003: LLM usage tracking and cost management

CREATE TABLE IF NOT EXISTS llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL,            -- 'PRE_TRIAGEM', 'ANALISE_COMPLETA', 'EMBEDDINGS', 'ONBOARDING'
  model TEXT NOT NULL,               -- 'gemini-3-pro-preview', 'text-embedding-3-small', etc.
  licitacao_id UUID,                 -- optional: which licitacao triggered this
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,  -- estimated cost in USD
  latency_ms INT,
  success BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant ON llm_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_month ON llm_usage(tenant_id, created_at);

-- Monthly aggregation view for fast dashboard queries
CREATE OR REPLACE VIEW vw_llm_costs_monthly AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) as month,
  workflow,
  model,
  COUNT(*) as call_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(latency_ms)::INT as avg_latency_ms
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('month', created_at), workflow, model;

-- Daily aggregation for charts
CREATE OR REPLACE VIEW vw_llm_costs_daily AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at)::date as day,
  COUNT(*) as call_count,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- Add cost limit to plans
DO $$ BEGIN
  ALTER TABLE plans ADD COLUMN max_tokens_per_month BIGINT DEFAULT 1000000;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update plan limits
UPDATE plans SET max_tokens_per_month = 500000 WHERE name = 'starter';
UPDATE plans SET max_tokens_per_month = 5000000 WHERE name = 'pro';
UPDATE plans SET max_tokens_per_month = 50000000 WHERE name = 'enterprise';
