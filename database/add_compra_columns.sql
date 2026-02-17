-- Adicionar colunas ano_compra e sequencial_compra na tabela licitacoes
-- Esses campos são necessários para construir a URL de download do edital

-- 1. Adicionar coluna ano_compra (INTEGER)
ALTER TABLE licitacoes 
ADD COLUMN IF NOT EXISTS ano_compra INTEGER;

-- 2. Adicionar coluna sequencial_compra (INTEGER)
ALTER TABLE licitacoes 
ADD COLUMN IF NOT EXISTS sequencial_compra INTEGER;

-- 3. Criar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_licitacoes_compra 
ON licitacoes (cnpj_orgao, ano_compra, sequencial_compra);

-- 4. Comentários para documentação
COMMENT ON COLUMN licitacoes.ano_compra IS 'Ano da compra no PNCP (ex: 2025)';
COMMENT ON COLUMN licitacoes.sequencial_compra IS 'Número sequencial da compra no PNCP (ex: 34)';

-- 5. (Opcional) Atualizar view vw_licitacoes_pendentes se necessário
-- A view provavelmente usa SELECT * ou já inclui esses campos

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'licitacoes' 
AND column_name IN ('ano_compra', 'sequencial_compra');
