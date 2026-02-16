-- Migration 009: Campos customizados por tenant na análise
-- Permite que cada tenant tenha campos extras específicos do seu segmento

-- 1. Adicionar coluna campos_customizados na tabela analises
ALTER TABLE analises ADD COLUMN IF NOT EXISTS campos_customizados JSONB DEFAULT '{}';

-- 2. A tabela custom_prompts já suporta prompt_type = 'OUTPUT_SCHEMA'
-- Cada tenant pode ter seu próprio schema JSON com campos_customizados
-- que a IA preenche durante a análise e o frontend renderiza automaticamente
