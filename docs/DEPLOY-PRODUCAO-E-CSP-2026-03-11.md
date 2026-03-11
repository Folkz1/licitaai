# Deploy Producao e CSP

Data: 11 de marco de 2026

## Diagnostico

O alerta de CSP sobre `unsafe-eval` nao e o erro principal do onboarding.

O codigo atual do app local:

- nao envia `Content-Security-Policy` pelo Next.js
- nao depende de `eval()` no fluxo do onboarding
- conclui o onboarding localmente com `200`

O problema real encontrado no dominio publicado foi este:

- `POST /api/onboarding/complete` retorna `500`
- o mesmo fluxo local retorna `200`

Isso indica deploy desatualizado ou runtime diferente do codigo atual.

## O que usar em producao

Nao rode o app com `next dev` em producao.

Use um destes caminhos:

1. Dockerfile da pasta `licitacao-saas`
2. Build + standalone:

```bash
npm run build
npm run start:standalone
```

ou, se preferir manter o start tradicional:

```bash
npm run build
npm run start
```

O caminho recomendado para EasyPanel e o `Dockerfile`, porque ele ja sobe o build `standalone` com `node server.js`.

## Smoke test apos deploy

Rode:

```bash
cd licitacao-saas
DATABASE_URL="sua-string" npm run smoke:onboarding -- --url=https://licitai.mbest.site
```

Se o deploy estiver certo, o esperado e:

```text
session=200
step1=200
step2=200
step3=200
step4=200
generate=200
complete=200
```

Se `complete` voltar `500`, a producao ainda nao recebeu o codigo corrigido.

## Observacao sobre CSP

Se o proxy/CDN estiver injetando CSP manualmente, nao adicione `unsafe-eval` por padrao.

Primeiro valide:

- se a aplicacao esta rodando build de producao
- se o dominio publicado aponta para o container/app corretos
- se o onboarding smoke test acima fecha com `200`

So considere alterar CSP se existir uma politica externa realmente aplicada pelo proxy.
