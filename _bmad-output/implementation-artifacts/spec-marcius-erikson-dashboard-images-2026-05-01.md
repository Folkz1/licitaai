# LicitaAI — feedback Marcius/Erikson: busca, imagens e dashboard diário

Data: 2026-05-01
Escopo: ajustes seguros no dashboard/listagem e consolidação das imagens enviadas por Erikson na Orquestra.

## Call Marcius localizada
- Gravação encontrada: `Call Marcius - 2026-04-29 (78min)`
- ID Orquestra: `26a9004a-f82b-4060-9270-83b32d544168`
- Observação: a transcrição disponível nessa call fala principalmente de contrato/parceria/Marcius.IA/Trello/Hostinger. Não encontrei nela o trecho direto de LicitaAI/dashboard diário. A ideia operacional veio do pedido do Diego nesta tarefa: cards/contadores diários no dashboard devem filtrar a listagem ao clicar.

## Imagens do Erikson transcritas/extraídas
Contato Orquestra: `𝘌𝘳𝘪𝘬𝘴𝘰𝘯` (`848b4d7c-c453-4d0c-811f-a135f476698c`).

### 2026-03-07 — tela LicitaAI com 746 licitações
- Imagem: `7639c861-9251-490a-b5c0-f8c5ee2a9d89`
- Já havia OCR/síntese na Orquestra.
- Feedback por áudio associado:
  - prompt estava errado: sistema falava em serviços gráficos, mas foco real é materiais de escritório/papelaria.
  - cliente quer ver a **plataforma/fonte** na listagem e no detalhe.
  - ordenação por **data de publicação** é importante.
  - datas no detalhe devem aparecer como `dd/mm/aaaa hh:mm`, sem segundos/T ISO.
  - ME/EPP precisa indicar quais itens são exclusivos, não só observação genérica.
  - agendamento de buscas estava pausado; cliente quer entender se pode acionar atualização para validação.

### 2026-04-29 18:36 — busca por órgão
- Imagem: `c71a105b-5a78-41aa-be94-6722583b681c`
- Tela LicitaAI, busca digitada aparentemente `amaq`/órgão.
- Resultado: 1 licitação encontrada.
- Resultado visível: Consórcio Público CIMAG, Caxambu/MG, objeto de materiais de expediente e escolares, fonte `Licitar`, pregão eletrônico, publicação 27/04/2026.
- Texto do Erikson: “Quando busquei pelo Órgão, deu certo.”
- Impacto: busca precisa cobrir mais campos reais da listagem, não só objeto/órgão.

### 2026-04-29 19:00 — documento Ibiraci/MG
- Imagem: `f4ab2706-04c2-4eb4-a591-831ce2d44654`
- Documento: `PREÇO MÉDIO DA PROPOSTA DE PREÇOS CONSOLIDADO`
- Pesquisa: `000072/2026`, processo `000070/2026`, data `01/04/2026`.
- Objeto: aquisição de papel A3 e A4 para secretarias do Município de Ibiraci-MG.
- Itens:
  - Papel sulfite A4, qtd 5.140, valor médio 21,670, total 111.383,80.
  - Papel sulfite A3 branco, qtd 30, valor médio 52,210, total 1.566,30.
- Valor total: 112.950,10.
- Impacto: reforça necessidade de busca por item interno (`papel`) e cuidado com OCR/valores.

### 2026-04-29 19:21 — PNCP Lagoa da Prata/MG
- Imagem: `6aaa5f4f-ec87-40c1-ade9-5f175a3f9e8e`
- Edital nº 13/2026.
- Órgão: Município de Lagoa da Prata.
- Objeto: materiais de limpeza e higienização.
- ID PNCP: `18318618000160-1-000111/2026`.
- Fonte: Licitar Digital.
- Fim propostas: 11/05/2026 08:30.
- Valor estimado: `SIGILOSO`; valor homologado: `R$ 0,00`.
- Impacto: valor estimado sigiloso não deve virar zero.

### 2026-04-29 19:22 — PNCP Carmo do Cajuru/MG
- Imagem: `29aafd4b-1d40-45f3-8cbc-aaa04ecd7d9c`
- Edital nº PRE 15/2026.
- Órgão: Município de Carmo do Cajuru.
- Unidade: Educação e Cultura.
- Objeto: material de limpeza, higienização, copa/cozinha e outros.
- ID PNCP: `18291377000102-1-000067/2026`.
- Fonte: IPM Sistemas.
- Valor estimado: `R$ 1.319.561,45`.
- Fim propostas: 04/05/2026 08:45.
- Impacto: exemplo que deveria aparecer para busca por materiais de limpeza/papel higiênico.

### 2026-04-29 19:24 — PNCP Mutum/MG
- Imagem: `acc0607c-d4e1-4e14-bd43-ec8d94a79601`
- Edital nº 011/2026.
- Órgão: Município de Mutum.
- Objeto: materiais de limpeza, descartáveis e utensílios.
- ID PNCP: `18348086000103-1-000020/2026`.
- Fonte: Licitar Digital.
- Fim propostas: 05/05/2026 09:00.
- Valor estimado: `SIGILOSO`; valor homologado: `R$ 0,00`.
- Impacto: mesmo caso de valor sigiloso e necessidade de captura por itens/objeto de limpeza.

## Ajustes implementados nesta etapa

### Dashboard diário clicável
Arquivo: `licitacao-saas/src/app/(dashboard)/dashboard/page.tsx`

- Card `novas hoje` agora é link para:
  - `/licitacoes?period=today&analyzed=false&only_relevant=false&sort_by=publicacao`
- Card `analisadas hoje` agora é link para:
  - `/licitacoes?period=today&analyzed=true&only_relevant=false&sort_by=publicacao`
- Badges P1/P2/P3/rejeitadas hoje agora linkam para a listagem filtrada por prioridade/analisadas hoje.

### API da listagem alinhada ao dashboard
Arquivo: `licitacao-saas/src/app/api/licitacoes/route.ts`

- `period=today&analyzed=true` agora filtra por `analises.updated_at` no dia atual em `America/Sao_Paulo`, para bater com o contador “analisadas hoje”.
- `period=today&analyzed=false` mantém licitações criadas hoje e sem análise.
- Busca textual ampliada para cobrir:
  - objeto
  - órgão
  - município
  - UF
  - número PNCP
  - modalidade
  - fonte/link sistema origem

## Fora do escopo imediato
- Deploy/push sem aprovação explícita do Diego.
- Correção completa de ME/EPP por item.
- Tratamento persistente de valor `SIGILOSO` se exigir mudança de schema/ingestão.
- Reprocessar PNCP em produção.
