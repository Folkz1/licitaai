# LicitaAI Roadmap V2 - Plataforma Inteligente de Licitacoes
Atualizado: 2026-03-05

## Visao
Busca inteligente baseada no perfil da empresa.
Saida da IA totalmente configuravel pelo cliente.
Multi-usuario com niveis de acesso por organizacao.
Pipeline migrando de N8N para code (melhor debug, versionamento, feedback loop).

## Cliente Piloto: Erikson (Zapia Brasil)
- Ramo: papelaria/materiais escritorio
- Foco: Minas Gerais (prioridade), Brasil (secundario)
- Tipo: credenciamentos + pregoes
- Feedback: quer parceria, familia inteira em licitacoes

---

## FASE 1 - Bugs Criticos (ATUAL)
Status: EM ANDAMENTO

### B1 - IA rejeitando licitacoes validas (falso negativo)
- **Problema**: Licitacao R$965k com 20+ itens de PAPEL rejeitada como "nao enquadra no core business"
- **Causa provavel**: prompt da IA nao recebe os itens do edital, ou recebe resumo incompleto
- **Fix**: investigar fluxo de analise - o que exatamente a IA recebe como input
- **Validacao**: re-analisar essa licitacao especifica e confirmar score > 7

### B2 - Licitacao sem analise (fantasma)
- **Problema**: Santa Barbara R$1M+ aparece como "analisada/nova" mas SEM analise e SEM itens
- **Causa provavel**: callback do N8N marcou status mas analise falhou silenciosamente
- **Fix**: verificar callback route - garantir que so marca "analisada" se tem conteudo real
- **Validacao**: query no banco por licitacoes com status analisada mas sem analise

### B3 - Resultados do Brasil inteiro (filtro UF quebrado)
- **Problema**: busca trazendo licitacoes de todo Brasil, gastando creditos IA
- **Causa provavel**: workflow N8N sem filtro de estado ou filtro removido
- **Fix**: adicionar filtro UF na config + aplicar na busca PNCP
- **Validacao**: proxima busca trazer so MG

### B4 - Paginacao nao preserva pagina ao voltar
- **Problema**: usuario na pagina 5, clica em licitacao, volta = pagina 1
- **Fix**: preservar query params (page) no link de voltar, ou usar router state
- **Validacao**: navegar pra pagina 3+, entrar em licitacao, voltar = mesma pagina

### B5 - Page size fixo em 36
- **Problema**: cliente quer 100 itens por pagina
- **Fix**: aumentar default para 50, permitir 100, adicionar seletor de page size
- **Validacao**: confirmar que 100 itens carrega rapido (< 2s)

---

## FASE 2 - Migracao N8N para Code
Status: PLANEJADO

### Objetivo
Substituir workflows N8N (busca + analise) por API routes/scripts Node.
Motivo: melhor debug, versionamento git, testes, feedback loop IA.

### 2.1 - Migrar Busca PNCP
- [ ] Criar src/lib/pncp/search.ts - fetch API PNCP com filtros (UF, modalidade, periodo)
- [ ] Criar API route POST /api/jobs/busca-pncp - dispara busca com params do tenant
- [ ] Integrar com configuracoes_busca + palavras_chave do banco
- [ ] Filtro por estado (UF) configuravel por tenant (F2)
- [ ] Cron configuravel: dias da semana + weekend opcional (F4)
- [ ] Testes com dados reais

### 2.2 - Migrar Analise Editais
- [ ] Criar src/lib/analysis/analyze.ts - pipeline OCR + RAG + LLM
- [ ] Criar API route POST /api/jobs/analise-editais - analisa batch de licitacoes
- [ ] Output da IA TOTALMENTE CONFIGURAVEL pelo cliente:
  - Campos de saida selecionaveis (score, justificativa, itens relevantes, garantias, etc)
  - Prompt template editavel com variaveis {{ empresa }}, {{ keywords }}, {{ historico }}
  - Peso dos criterios ajustavel (relevancia itens, valor, localidade, modalidade)
- [ ] Feedback loop: rejeicoes alimentam prompt futuro (F1)
- [ ] Regra credenciamentos: antigos (>6 meses) = P2 automatico, exceto valor alto (F3)
- [ ] Testes com licitacoes reais (incluindo os casos B1 e B2)

### 2.3 - Feedback Loop (F1)
- [ ] Criar tabela feedback_rules ou usar review_actions
- [ ] Ao rejeitar P1/P2: modal pede justificativa (obrigatorio)
- [ ] Justificativas acumulam como "regras negativas" no prompt
- [ ] IA recebe top-10 rejeicoes recentes como contexto
- [ ] Metricas: taxa de acerto antes/depois do feedback

---

## FASE 3 - Multi-usuario e Perfil Inteligente
Status: PLANEJADO

### 3.1 - Perfil da Empresa (Company Profile)
- [ ] Criar tabela tenant_profile ou expandir tenants:
  - cnae_codes[] - CNAEs da empresa
  - products[] - produtos/servicos oferecidos
  - regions[] - estados/municipios de interesse
  - modalities[] - modalidades preferidas (pregao, credenciamento, etc)
  - min_value / max_value - faixa de valor
  - exclusions[] - termos para excluir sempre
  - custom_rules[] - regras especificas do cliente
- [ ] Wizard de setup do perfil (onboarding)
- [ ] IA usa perfil como contexto primario na analise
- [ ] Score considera match com perfil (nao so keywords)

### 3.2 - Saida IA Configuravel
- [ ] Template de output editavel pelo admin do tenant
- [ ] Campos padrao: score, justificativa, itens_relevantes, riscos, recomendacao
- [ ] Campos customizaveis: o cliente define o que quer ver
- [ ] Formato exportavel (PDF, Excel) com layout customizado
- [ ] Historico de versoes do template

### 3.3 - Multi-usuario com Niveis
- [ ] Expandir roles alem de SUPER_ADMIN/ADMIN/ANALYST/VIEWER:
  - OWNER: dono da organizacao (billing, config, usuarios)
  - MANAGER: gerencia equipe, ve tudo do tenant
  - ANALYST: analisa licitacoes, categoriza, anota
  - VIEWER: so visualiza (read-only)
- [ ] Convite por email (link com token)
- [ ] Dashboard do OWNER: ver atividade de cada usuario
- [ ] Permissoes granulares: quem pode editar prompt, quem pode rejeitar, etc
- [ ] Audit log: quem fez o que, quando
- [ ] Limite de usuarios por plano (starter=3, pro=10, enterprise=ilimitado)

### 3.4 - Workspace / Organizacao
- [ ] Conceito de "workspace" = tenant com identidade visual
- [ ] Cada usuario pode pertencer a multiplos workspaces
- [ ] Switch de workspace no header
- [ ] Notificacoes por workspace (email digest, WhatsApp)

---

## Decisoes Tecnicas
- Stack: Next.js 16 + raw pg (manter atual)
- IA: OpenRouter (Gemini/GPT-4o) - manter flexivel
- OCR: manter OCR Supremo ou migrar pra Gemini Vision
- Cron: Node cron interno (create-schedules.mjs) substitui N8N scheduler
- Feedback: tabela propria, embeddings opcionais pro futuro
- Multi-tenant: ja existe, expandir com profiles e roles

## Metricas de Sucesso
- Taxa de acerto IA > 85% (medida por feedback do usuario)
- Tempo de analise < 30s por licitacao
- Zero falso negativo em licitacoes P1
- Cliente consegue configurar perfil sem suporte
