-- Seed OUTPUT_SCHEMA for papel (Clear) client
-- Tenant ID: 00000000-0000-0000-0000-000000000001

INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'OUTPUT_SCHEMA',
  '{
  "itens": [],
  "resumo": {
    "data_realizacao_certame": null,
    "numero_pregao_extraido": null,
    "total_itens": 0,
    "itens_graficos": 0,
    "valor_total_licitacao": 0,
    "valor_itens_relevantes": 0,
    "percentual_relevante": 0
  },
  "analise": {
    "prioridade": null,
    "justificativa": null,
    "pontos_positivos": [],
    "pontos_atencao": [],
    "recomendacao": null,
    "amostra_exigida": null,
    "amostra_evidencia": null
  },
  "documentos_necessarios": [],
  "prazos_importantes": {
    "data_abertura_propostas": null,
    "data_realizacao_certame": null,
    "prazo_entrega_dias": 0,
    "prazo_pagamento_dias": 0,
    "prazo_vigencia_meses": 0,
    "validade_proposta_dias": 0,
    "data_limite_envio_propostas": null,
    "prazo_esclarecimentos": null,
    "prazo_impugnacao": null
  },
  "requisitos_tecnicos": [],
  "analise_riscos": [],
  "preferencias_me_epp": {
    "exclusivo_me_epp": null,
    "margem_preferencia_percentual": null,
    "limite_valor_exclusivo": null,
    "observacoes": null
  },
  "garantias": {
    "garantia_proposta_percentual": 0,
    "garantia_contratual_percentual": 0,
    "tipo_garantia_aceita": [],
    "valor_estimado_garantia": 0
  },
  "forma_fornecimento": {
    "tipo": null,
    "quantidade_minima_pedido": 0,
    "frequencia_entregas": null,
    "locais_entrega": [],
    "frete": null
  },
  "campos_customizados": {
    "valor_itens_acima_80k": 0,
    "tipos_papel_exigidos": "",
    "gramaturas_especificadas": "",
    "formatos_impressao": "",
    "acabamentos_especiais": "",
    "tiragem_total_estimada": 0,
    "exige_certificacao_fsc": false,
    "exige_iso_9001": false,
    "prazo_entrega_critico": false,
    "tipo_encadernacao": "",
    "cores_impressao": "",
    "itens_personalizacao": ""
  }
}',
  true
)
ON CONFLICT (tenant_id, prompt_type)
DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();

-- Also seed PRE_TRIAGEM prompt for papel client
INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PRE_TRIAGEM',
  'SOBRE A EMPRESA:
A Clear é uma gráfica e editora especializada em produtos gráficos e impressos.

PRODUTOS/SERVIÇOS OFERECIDOS:
- Impressão offset e digital (livros, revistas, catálogos, folders, cartazes)
- Materiais de papelaria (blocos, cadernos, fichas, formulários)
- Materiais de sinalização e comunicação visual
- Encadernação e acabamento gráfico
- Envelopes, pastas e embalagens em papel/cartão
- Materiais educacionais e didáticos impressos

CRITÉRIOS DE RELEVÂNCIA:
- Licitações com itens de impressão, gráfica, papel, material impresso
- Valor mínimo relevante por item: R$80.000,00
- Priorizar licitações com tiragens altas e prazos viáveis
- Produtos gráficos, editoriais e de papelaria são o core business

CRITÉRIOS DE EXCLUSÃO:
- Itens puramente digitais (software, licenças, equipamentos de TI)
- Materiais de escritório genéricos sem componente gráfico (canetas, clips, etc.)
- Serviços de consultoria, assessoria ou mão de obra
- Equipamentos e maquinário',
  true
)
ON CONFLICT (tenant_id, prompt_type)
DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();

-- Also seed ANALISE_COMPLETA prompt for papel client
INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ANALISE_COMPLETA',
  'CONTEXTO DA EMPRESA PARA ANÁLISE DETALHADA:

A Clear é uma gráfica e editora com foco em licitações públicas para fornecimento de material gráfico e impresso.

CAPACIDADES DE PRODUÇÃO:
- Impressão offset (grandes tiragens)
- Impressão digital (pequenas e médias tiragens)
- Acabamento: laminação, verniz UV, hot stamping, corte e vinco
- Encadernação: lombada quadrada, espiral, wire-o, brochura
- Formatos: até SRA2 (640x450mm)

AO ANALISAR CADA EDITAL, CONSIDERE:
1. CLASSIFICAÇÃO DE ITENS: Identifique quais itens são produtos gráficos/impressos e quais não são
2. VALOR RELEVANTE: Some APENAS itens gráficos com valor >= R$80.000,00 cada
3. VIABILIDADE TÉCNICA: Verifique se os requisitos técnicos (gramatura, formato, acabamento) são compatíveis
4. PRAZO: Avalie se o prazo de entrega é exequível para a tiragem solicitada
5. AMOSTRA: Identifique se há exigência de amostra e qual o prazo
6. CERTIFICAÇÕES: Verifique se exige FSC, ISO 9001, ou outras certificações
7. CAMPOS CUSTOMIZADOS: Preencha os campos_customizados com dados específicos do segmento gráfico:
   - valor_itens_acima_80k: soma dos itens gráficos >= R$80k
   - tipos_papel_exigidos: tipos de papel mencionados
   - gramaturas_especificadas: gramaturas exigidas
   - formatos_impressao: formatos de impressão requeridos
   - acabamentos_especiais: acabamentos especiais exigidos
   - tiragem_total_estimada: quantidade total estimada
   - exige_certificacao_fsc: se exige certificação FSC
   - exige_iso_9001: se exige ISO 9001
   - prazo_entrega_critico: se o prazo é apertado
   - tipo_encadernacao: tipo de encadernação exigido
   - cores_impressao: especificação de cores (4x4, 4x0, etc.)
   - itens_personalizacao: itens que requerem personalização',
  true
)
ON CONFLICT (tenant_id, prompt_type)
DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();
