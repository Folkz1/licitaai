# Email rapido para o LicitaAI
Data: 2026-03-10

## Resposta curta
Sim. Se voce tem o dominio e acesso ao DNS, da para colocar email no ar sem montar servidor proprio.

## Caminho mais rapido
### Saida de email transacional
- Provedor: Resend
- Uso: notificacao de lead, confirmacao, alertas internos
- O que precisa:
  - dominio
  - acesso DNS para validar SPF/DKIM
  - conta no Resend

### Entrada de email / caixa simples
- Opcao 1: Cloudflare Email Routing
- Opcao 2: Zoho Mail

## O que ja deixei preparado no codigo
- `licitacao-saas/src/lib/email.ts`
- `licitacao-saas/src/app/api/public/lead/route.ts`
- `.env.example`

Quando `RESEND_API_KEY`, `EMAIL_FROM` e `EMAIL_TO_LEADS` forem configurados:
- cada lead novo passa a gerar notificacao por email automaticamente
- continua chegando no WhatsApp tambem

## Config recomendada
- `contato@seudominio.com` -> remetente do produto
- `vendas@seudominio.com` -> caixa para leads
- `diego@seudominio.com` -> caixa pessoal/comercial

## Env vars
```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=LicitaIA <contato@seudominio.com>
EMAIL_TO_LEADS=vendas@seudominio.com
```

## Ordem de execucao
1. Apontar DNS do dominio no provedor escolhido
2. Validar dominio no Resend
3. Criar os aliases ou caixas de entrada
4. Preencher as env vars
5. Redeploy da aplicacao
6. Testar submit de lead

## Recomendacao objetiva
Para subir rapido:
- Resend para envio
- Cloudflare Email Routing para receber/encaminhar

Se quiser caixa completa com login webmail:
- Resend para envio
- Zoho Mail para inbox

## O que falta para eu concluir de ponta a ponta
- nome do dominio que vamos usar
- acesso DNS ou painel do provedor do dominio
- conta/chave do Resend, ou autorizacao para criar
