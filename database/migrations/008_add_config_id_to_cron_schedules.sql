-- Migration: 008_add_config_id_to_cron_schedules.sql
-- Adiciona config_id aos cron_schedules para vincular agendamento a cada configuração

-- Adicionar coluna config_id
ALTER TABLE cron_schedules ADD COLUMN IF NOT EXISTS config_id INTEGER REFERENCES configuracoes_busca(id) ON DELETE SET NULL;

-- Atualizar schedules existentes para usar a primeira config do tenant
UPDATE cron_schedules cs
SET config_id = (
  SELECT cb.id 
  FROM configuracoes_busca cb 
  WHERE cb.tenant_id = cs.tenant_id 
  ORDER BY cb.created_at ASC 
  LIMIT 1
)
WHERE cs.config_id IS NULL;
