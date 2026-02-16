-- Migration: 009_custom_prompts.sql
-- Tabela para armazenar prompts personalizados por empresa

CREATE TABLE IF NOT EXISTS custom_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_type VARCHAR(50) NOT NULL CHECK (prompt_type IN ('PRE_TRIAGEM', 'ANALISE_COMPLETA', 'BUSCA')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, prompt_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_custom_prompts_tenant ON custom_prompts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_prompts_type ON custom_prompts(prompt_type);

COMMENT ON TABLE custom_prompts IS 'Prompts personalizados por empresa para IA';
COMMENT ON COLUMN custom_prompts.prompt_type IS 'Tipo: PRE_TRIAGEM, ANALISE_COMPLETA, BUSCA';
