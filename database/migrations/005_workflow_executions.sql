-- ============================================
-- Migration 005: Workflow Executions Tracking
-- ============================================

-- Real-time workflow execution status
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_type VARCHAR(50) NOT NULL,     -- 'busca' | 'analise'
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, SUCCESS, ERROR, CANCELLED
  triggered_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  progress INT DEFAULT 0,                 -- 0-100
  current_step VARCHAR(200),              -- "Buscando no PNCP..." / "Analisando edital 3/10..."
  metrics JSONB DEFAULT '{}',             -- { licitacoes_found: 15, editais_analisados: 10, ... }
  error_message TEXT,
  logs JSONB DEFAULT '[]',                -- [{ time, message, level }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_exec_tenant ON workflow_executions(tenant_id, created_at DESC);
CREATE INDEX idx_workflow_exec_status ON workflow_executions(tenant_id, status) WHERE status IN ('PENDING', 'RUNNING');
