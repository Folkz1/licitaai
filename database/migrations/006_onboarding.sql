-- Migration: 006_onboarding.sql
-- Descrição: Cria tabela de sessões de onboarding e extende tabelas existentes

-- ============================================================
-- 1. Tabela de Sessões de Onboarding
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 1,
  step_1_data JSONB DEFAULT '{}',
  step_2_data JSONB DEFAULT '{}',
  step_3_data JSONB DEFAULT '{}',
  step_4_data JSONB DEFAULT '{}',
  step_5_data JSONB DEFAULT '{}',
  ai_generated_config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON onboarding_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_sessions(status);

-- ============================================================
-- 2. Extensão da tabela configuracoes_busca
-- ============================================================

ALTER TABLE configuracoes_busca ADD COLUMN IF NOT EXISTS valor_minimo NUMERIC DEFAULT 0;
ALTER TABLE configuracoes_busca ADD COLUMN IF NOT EXISTS valor_maximo NUMERIC DEFAULT NULL;
ALTER TABLE configuracoes_busca ADD COLUMN IF NOT EXISTS buscar_srp BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracoes_busca ADD COLUMN IF NOT EXISTS buscar_me_epp BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracoes_busca ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'AI_GENERATED', 'HYBRID'));

-- ============================================================
-- 3. Extensão da tabela palavras_chave
-- ============================================================

ALTER TABLE palavras_chave ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'AI_GENERATED', 'IMPORTED'));
ALTER TABLE palavras_chave ADD COLUMN IF NOT EXISTS variacoes TEXT[] DEFAULT '{}';
ALTER TABLE palavras_chave ADD COLUMN IF NOT EXISTS categoria TEXT;

-- ============================================================
-- 4. Comentários nas colunas
-- ============================================================

COMMENT ON TABLE onboarding_sessions IS 'Sessões de onboarding para configuração inicial de tenants';
COMMENT ON COLUMN onboarding_sessions.step_1_data IS 'Dados da empresa: razao_social, nome_fantasia, cnpj, porte, setor, descricao_livre';
COMMENT ON COLUMN onboarding_sessions.step_2_data IS 'Ramo de atuação: ramo_principal, ramo_secundario, experiencia_pregao, tipos_clientes';
COMMENT ON COLUMN onboarding_sessions.step_3_data IS 'Produtos e serviços: produtos_servicos, palavras_chave_manual, exclusoes';
COMMENT ON COLUMN onboarding_sessions.step_4_data IS 'Preferências de busca: ufs_interesse, municipios_interesse, modalidades, valor_minimo, valor_maximo, dias_retroativos';
COMMENT ON COLUMN onboarding_sessions.step_5_data IS 'Revisão e confirmação: confirmado, ajustes_manuais';
COMMENT ON COLUMN onboarding_sessions.ai_generated_config IS 'Configuração gerada pela IA: keywords_inclusao, keywords_exclusao, filtros_busca, prompt_analise';

COMMENT ON COLUMN tenants.ai_config IS 'Configuração de IA gerada no onboarding: keywords_inclusao, keywords_exclusao, prompt_analise, filtros_recomendados, generated_at, model_version';

-- ============================================================
-- 5. Trigger para atualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_onboarding_updated_at ON onboarding_sessions;
CREATE TRIGGER trigger_onboarding_updated_at
  BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

-- ============================================================
-- 6. Função para completar onboarding
-- ============================================================

CREATE OR REPLACE FUNCTION complete_onboarding(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_config JSONB;
  v_config_id UUID;
BEGIN
  -- Buscar sessão
  SELECT * INTO v_session 
  FROM onboarding_sessions 
  WHERE tenant_id = p_tenant_id AND status = 'IN_PROGRESS'
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active session found');
  END IF;
  
  v_config := v_session.ai_generated_config;
  
  -- Inserir/atualizar configuracoes_busca
  INSERT INTO configuracoes_busca (
    tenant_id, 
    nome, 
    ufs, 
    modalidades_contratacao, 
    dias_retroativos,
    valor_minimo,
    valor_maximo,
    buscar_srp,
    buscar_me_epp,
    source,
    ativo
  ) VALUES (
    p_tenant_id,
    'Configuração Inicial (IA)',
    COALESCE(v_config->'filtros_busca'->'ufs_prioritarias', '[]'::jsonb),
    COALESCE(v_config->'filtros_busca'->'modalidades_recomendadas', '[]'::jsonb),
    COALESCE((v_config->'filtros_busca'->>'dias_retroativos')::int, 15),
    COALESCE((v_config->'filtros_busca'->>'valor_minimo_sugerido')::numeric, 0),
    (v_config->'filtros_busca'->>'valor_maximo_sugerido')::numeric,
    COALESCE((v_config->'filtros_busca'->>'buscar_srp')::boolean, true),
    COALESCE((v_config->'filtros_busca'->>'buscar_me_epp')::boolean, true),
    'AI_GENERATED',
    true
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    ufs = EXCLUDED.ufs,
    modalidades_contratacao = EXCLUDED.modalidades_contratacao,
    dias_retroativos = EXCLUDED.dias_retroativos,
    valor_minimo = EXCLUDED.valor_minimo,
    valor_maximo = EXCLUDED.valor_maximo,
    buscar_srp = EXCLUDED.buscar_srp,
    buscar_me_epp = EXCLUDED.buscar_me_epp,
    source = EXCLUDED.source,
    updated_at = NOW()
  RETURNING id INTO v_config_id;
  
  -- Inserir keywords de inclusão
  INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
  SELECT 
    p_tenant_id,
    kw.value::text,
    'INCLUSAO',
    10,
    'AI_GENERATED',
    'onboarding'
  FROM jsonb_array_elements(v_config->'keywords_inclusao') AS kw
  ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING;
  
  -- Inserir keywords de exclusão
  INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
  SELECT 
    p_tenant_id,
    kw.value::text,
    'EXCLUSAO',
    10,
    'AI_GENERATED',
    'onboarding'
  FROM jsonb_array_elements(v_config->'keywords_exclusao') AS kw
  ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING;
  
  -- Atualizar tenant com ai_config e onboarding_completed
  UPDATE tenants 
  SET 
    ai_config = v_config,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = p_tenant_id;
  
  -- Marcar sessão como completa
  UPDATE onboarding_sessions
  SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    current_step = 5
  WHERE id = v_session.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'config_id', v_config_id,
    'keywords_inclusao', jsonb_array_length(v_config->'keywords_inclusao'),
    'keywords_exclusao', jsonb_array_length(v_config->'keywords_exclusao')
  );
END;
$$ LANGUAGE plpgsql;
