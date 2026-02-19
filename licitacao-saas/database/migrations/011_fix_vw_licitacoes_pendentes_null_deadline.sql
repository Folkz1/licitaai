-- Include tenders without deadline in pending view.
-- Some PNCP records arrive with data_encerramento_proposta NULL and must still be analyzed.
CREATE OR REPLACE VIEW public.vw_licitacoes_pendentes AS
SELECT
  l.id,
  l.tenant_id,
  l.numero_controle_pncp,
  l.cnpj_orgao,
  l.ano,
  l.sequencial,
  l.ano_compra,
  l.sequencial_compra,
  l.orgao_nome,
  l.objeto_compra,
  l.informacao_complementar,
  l.valor_total_estimado,
  l.modalidade_contratacao,
  l.modalidade_codigo,
  l.modo_disputa,
  l.modo_disputa_codigo,
  l.tipo_participacao,
  l.valor_confidencial,
  l.data_publicacao,
  l.data_encerramento_proposta,
  l.data_abertura_proposta,
  l.uf,
  l.municipio,
  l.link_edital_pncp,
  l.link_sistema_origem,
  l.status,
  l.passou_pre_triagem,
  l.motivo_filtro,
  l.tentativas_download,
  l.tentativas_ocr,
  l.data_coleta,
  l.created_at,
  l.updated_at,
  l.esfera,
  CASE
    WHEN l.data_encerramento_proposta IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (l.data_encerramento_proposta - NOW()))
  END AS dias_restantes,
  CASE
    WHEN l.uf = 'MG' THEN 1
    ELSE 2
  END AS prioridade_uf
FROM licitacoes l
WHERE l.passou_pre_triagem = TRUE
  AND l.status = 'NOVA'
  AND (l.data_encerramento_proposta > NOW() OR l.data_encerramento_proposta IS NULL)
ORDER BY
  CASE WHEN l.uf = 'MG' THEN 1 ELSE 2 END,
  l.data_encerramento_proposta ASC NULLS LAST;
