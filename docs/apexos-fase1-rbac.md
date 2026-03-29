# Apex OS Fase 1 - Fundacao RBAC Multi-tenant

Este slice cria a fundacao de controle de acesso do LicitaAI para o Apex OS Fase 1, sem quebrar compatibilidade com o modelo atual baseado em `users.role`.

## Escopo do schema

Migration: `database/migrations/010_apexos_rbac_foundation.sql`

Objetos novos/ajustados:

- `tenants`
  - colunas novas: `slug`, `status`, `metadata`
  - indice unico opcional por `slug` (case-insensitive)
- `roles`
  - papeis globais (`tenant_id IS NULL`) e papeis por tenant (`tenant_id = <uuid>`)
  - seeds globais: `SUPER_ADMIN`, `ADMIN`, `ANALYST`, `VIEWER`
- `memberships`
  - relacionamento `user x tenant x role`
  - `UNIQUE (user_id, tenant_id)` para evitar duplicidade
  - trigger de validacao para impedir role de tenant A ser usada em membership do tenant B
- `vw_user_tenant_roles`
  - visao consolidada para consulta de acesso

## Regras de segregacao por tenant

- Membership sempre pertence a um tenant (`memberships.tenant_id`).
- Um role tenant-scoped so pode ser atribuido a memberships do mesmo tenant.
- Roles globais (`tenant_id IS NULL`) podem ser usados em qualquer tenant.
- Backfill automatico cria membership para usuarios existentes com base em `users.role` + `users.tenant_id`.

## Compatibilidade

- O campo `users.role` continua existindo e sendo usado pelo app atual.
- A migracao apenas adiciona a estrutura nova para evolucao gradual do RBAC.

## Validacao leve de consistencia

Script: `scripts/check_rbac_schema.js`

Validacoes:

- existencia das tabelas `tenants`, `users`, `roles`, `memberships`
- colunas minimas esperadas
- seeds de roles globais
- duplicidade em `memberships (user_id, tenant_id)`
- inconsistencias de tenant entre membership e role
- usuarios com `tenant_id` sem membership correspondente

Execucao:

```bash
node scripts/check_rbac_schema.js
```

Requisitos:

- `DATABASE_URL` (ou `STRING_CONEXAO_BANCO_DADOS`) no ambiente
- sem credenciais hardcoded em arquivos novos
