-- Migration 008: Suporte a múltiplas configurações de busca por tenant
-- Permite que cada tenant tenha várias configs de busca com UFs/retroativos diferentes

-- 1. Remover constraint UNIQUE em tenant_id (permite múltiplas configs)
ALTER TABLE configuracoes_busca DROP CONSTRAINT IF EXISTS configuracoes_busca_tenant_id_unique;

-- 2. Criar índice não-único para performance
CREATE INDEX IF NOT EXISTS idx_configuracoes_busca_tenant_id ON configuracoes_busca(tenant_id);

-- 3. Garantir que configs existentes tenham nome
UPDATE configuracoes_busca SET nome = 'Configuração Principal' WHERE nome IS NULL OR nome = '';
