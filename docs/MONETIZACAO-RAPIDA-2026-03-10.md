# Plano de Monetizacao Rapida - LicitaAI
Data: 2026-03-10

## Resumo executivo
O LicitaAI ja tem produto suficiente para vender, mas nao tem distribuicao suficiente para esperar que o portal publico pague a conta sozinho no curto prazo.

Hoje o caminho mais rapido para caixa nao e "mais SEO" nem "mais features". E vender uma oferta assistida, com onboarding manual e promessa de ganho operacional real para 3 a 5 clientes pequenos e medios de licitacao.

## Diagnostico real
Dados levantados no codigo, no site publico e no banco de producao em 2026-03-10:

- 5 tenants cadastrados
- 9 usuarios cadastrados
- 2 assinaturas ativas, ambas no plano Starter
- 73.393 licitacoes no portal publico
- 10 UFs publicadas no portal hoje
- 16 licitacoes com sinal de analise por IA no portal
- 5 posts publicados no blog
- 8 page views nos ultimos 30 dias
- 9 buscas publicas nos ultimos 30 dias
- 0 leads capturados
- 0 mensagens de nurturing enviadas

Leitura pratica:

- Ha prova minima de valor: existem 2 assinaturas ativas.
- Ha ativo de produto: portal, blog, precos, analytics, nurturing e dashboard de vendas ja existem.
- Ha um buraco comercial serio: o topo do funil publico ainda esta quase morto.
- Ha uma limitacao de oferta: o portal promete Brasil, mas hoje a base publica esta concentrada em 10 UFs. Isso pede uma venda mais focada por vertical e estado.

## O que isso significa
Nos proximos 30 dias, o portal publico deve ser tratado como ativo de credibilidade e prova, nao como principal motor de receita.

Se voce depender de inbound organico agora, a chance de demorar demais e alta.

O produto precisa virar uma oferta de "operacao assistida de licitacoes com IA", nao apenas um SaaS barato de autoatendimento.

## Benchmark de mercado
Referencias publicas verificadas em 2026-03-10:

- O PNCP mostra volume massivo de mercado: 638.431 contratacoes publicadas e 21,8 milhoes de itens cadastrados.
- O LicitaAI publica hoje planos de R$197, R$397 e R$997 por mes.
- A Effecti, concorrente direta, anuncia entrada a partir de R$329 por mes.

Leitura pratica:

- O problema nao parece ser "preco alto demais".
- O problema parece ser distribuicao fraca, pouca prova comercial e oferta ainda muito parecida com SaaS commodity.
- Existe espaco para ticket maior quando a venda for assistida e orientada a resultado.

## Tese de monetizacao rapida
### Nao vender
- "Software de licitacao barato"
- "API paga por credito"
- "Portal SEO vai trazer clientes logo"

### Vender
- "Radar de licitacoes com IA configurado para o seu segmento"
- "Triagem e priorizacao para a sua equipe parar de perder tempo com edital ruim"
- "Setup rapido por estado, modalidade e palavras-chave"
- "Implantacao assistida com acompanhamento no WhatsApp"

## Oferta recomendada
### Oferta 1 - Implantacao Expressa
Objetivo: gerar caixa imediato.

- Setup inicial: R$1.500 a R$2.500
- Entrega em 3 dias:
  - configuracao do perfil
  - filtros por UF/modalidade/segmento
  - 1 rodada de calibragem
  - treinamento de 45 minutos

### Oferta 2 - Radar Assistido
Objetivo: MRR rapido com pouco suporte.

- Mensalidade: R$1.497/mes
- Ideal para:
  - consultorias pequenas
  - equipes familiares de licitacao
  - distribuidores com 1 a 3 analistas
- Escopo:
  - 1 segmento principal
  - ate 3 usuarios
  - 1 UF principal + Brasil secundario
  - acompanhamento por WhatsApp

### Oferta 3 - Mesa de Licitacoes
Objetivo: ticket maior com mais servico.

- Setup: R$2.500 a R$4.900
- Mensalidade: R$2.500 a R$4.000
- Ideal para:
  - consultorias que operam para terceiros
  - empresas com alto volume de editais
  - times que precisam calibragem semanal
- Escopo:
  - mais de um segmento
  - calibragem semanal
  - apoio na triagem e feedback loop

## Quem atacar primeiro
Ordem recomendada:

1. Consultorias e familias que ja vivem de licitacao
2. Distribuidores de material medico, escritorio, seguranca, limpeza e manutencao
3. Empresas regionais com foco em 1 ou 2 UFs

Por que essa ordem:

- dor clara
- decisao mais rapida
- pouca exigencia de integracao
- valor percebido alto para triagem e monitoramento

## Meta financeira realista
Meta de 14 dias:

- 2 clientes de setup pago
- 2 contratos mensais assistidos
- caixa inicial entre R$3.000 e R$5.000
- novo MRR entre R$2.994 e R$8.000

Meta de 30 dias:

- 5 clientes ativos
- MRR entre R$7.500 e R$15.000

## P0 - O que mudar no produto em 48h
Estas mudancas tem impacto comercial direto.

### 1. Consertar a captura de lead
Hoje o formulario envia nome, email e telefone, mas nao envia empresa nem interesse. So que o backend aceita esses campos e o nurturing depende deles para personalizar a mensagem.

Impacto:

- lead entra "cego"
- sequencia perde contexto
- WhatsApp sai genérico

Arquivos envolvidos:

- `src/components/portal/LeadCaptureForm.tsx`
- `src/app/api/public/lead/route.ts`
- `src/lib/nurturing.ts`

### 2. Trocar CTA de "comecar gratis" por CTA comercial
No curto prazo, a CTA principal deve empurrar para:

- WhatsApp
- diagnostico rapido
- demo de 15 minutos

Nao para uma jornada self-serve longa.

Arquivos envolvidos:

- `src/app/(portal)/page.tsx`
- `src/app/(portal)/precos/page.tsx`
- `src/app/(portal)/editais/[slug]/page.tsx`
- `src/components/portal/StatePortalPage.tsx`

### 3. Subir prova comercial na home
Mostrar de forma mais agressiva:

- 73 mil+ licitacoes na base publica
- 10 estados ja monitorados
- analise por IA
- 2 empresas ativas na plataforma

### 4. Fechar o funil em WhatsApp humano
Todo lead novo deve cair em:

- notificacao imediata
- resposta humana em ate 10 minutos
- tentativa de demo no mesmo dia

O automacao entra para aquecer. O fechamento, por enquanto, tem que ser humano.

## P1 - O que vender nos proximos 7 dias
### Script simples
"Nos configuramos um radar de licitacoes com IA para o seu segmento e sua regiao. Em vez de perder horas filtrando edital ruim, voce recebe so o que faz sentido para o seu negocio. Implantacao em 3 dias. Posso te mostrar em 15 minutos?"

### Oferta de entrada
"Fecho um piloto assistido de 14 dias. Se fizer sentido, voce continua no mensal. Se nao fizer, voce pelo menos sai com a configuracao pronta e aprende onde esta perdendo oportunidade."

### Regra de fechamento
Nao vender plano de R$197 como oferta principal.
Usar o Starter como ancora de entrada no site, mas vender setup + acompanhamento como produto principal.

## Plano de ataque de 14 dias
### Dias 1 e 2
- ajustar copy e CTA comercial
- consertar formulario de lead
- preparar lista de 50 prospects
- montar mensagem curta de outreach

### Dias 3 a 5
- disparar 20 a 30 contatos por dia
- agendar 5 a 10 demos
- usar o portal publico e as paginas por estado como prova

### Dias 6 a 10
- fechar 2 pilotos
- configurar 1 vertical por cliente
- coletar feedback real de relevancia

### Dias 11 a 14
- transformar pilotos em mensalidade
- registrar depoimentos e print de resultados
- subir 1 estudo de caso simples no site

## O que nao fazer agora
- nao gastar energia com billing automatico antes dos proximos 2 clientes
- nao abrir frente grande de API monetizada agora
- nao disputar preco baixo com concorrente maduro
- nao prometer "todo Brasil" antes de completar cobertura com qualidade

## Sinais de que o plano esta funcionando
- pelo menos 1 lead qualificado por dia vindo de outreach
- 5 demos em 7 dias
- 2 setups pagos em 14 dias
- 1 depoimento real ate o fim do primeiro ciclo

## Sinais de que precisa corrigir rota
- lead chegando mas sem demo marcada
- demo acontecendo mas sem setup fechado
- cliente pedindo servico demais para ticket baixo

Se isso acontecer:

- subir ticket
- reduzir escopo
- focar em um nicho so

## Proxima prioridade tecnica depois do P0
1. Capturar empresa, interesse e UF no lead form
2. Levar o usuario para WhatsApp imediatamente apos cadastro
3. Criar bloco de prova social/case na home e em `/precos`
4. Criar landing especifica por nicho: medicos, papelaria, seguranca, manutencao
5. Instrumentar meta de demo agendada e resposta no WhatsApp

## Fontes usadas
- Site publico do LicitaAI: https://licitai.mbest.site/
- Pagina de precos do LicitaAI: https://licitai.mbest.site/precos
- Portal oficial do PNCP: https://pncp.gov.br/app/editais
- Pagina de planos da Effecti: https://site.effecti.com.br/planos/
- Banco de producao do LicitaAI consultado diretamente em 2026-03-10
