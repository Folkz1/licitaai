#!/usr/bin/env node

let Client;
try {
  ({ Client } = require("pg"));
} catch {
  console.error(
    "[FAIL] Dependencia 'pg' nao encontrada. Rode 'npm install' antes do check."
  );
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL || process.env.STRING_CONEXAO_BANCO_DADOS;

const REQUIRED_TABLES = ["tenants", "users", "roles", "memberships"];
const REQUIRED_COLUMNS = {
  tenants: ["id", "status"],
  users: ["id", "tenant_id", "role"],
  roles: ["id", "tenant_id", "code", "name", "level", "is_system", "is_active"],
  memberships: ["id", "user_id", "tenant_id", "role_id", "status", "is_primary"],
};
const REQUIRED_SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "ANALYST", "VIEWER"];

async function getSet(client, sql, params = []) {
  const result = await client.query(sql, params);
  return new Set(result.rows.map((row) => Object.values(row)[0]));
}

function fail(messages, message) {
  messages.push(message);
  console.error(`[FAIL] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

async function run() {
  if (!connectionString) {
    console.error(
      "[FAIL] Defina DATABASE_URL (ou STRING_CONEXAO_BANCO_DADOS) antes de rodar o check."
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });
  const failures = [];

  try {
    await client.connect();
    console.log("RBAC schema check started...\n");

    const existingTables = await getSet(
      client,
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [REQUIRED_TABLES]
    );

    for (const table of REQUIRED_TABLES) {
      if (!existingTables.has(table)) {
        fail(failures, `Tabela obrigatoria ausente: ${table}`);
      } else {
        ok(`Tabela encontrada: ${table}`);
      }
    }

    if (failures.length === 0) {
      for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const existingColumns = await getSet(
          client,
          `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          `,
          [table]
        );

        for (const column of columns) {
          if (!existingColumns.has(column)) {
            fail(failures, `Coluna obrigatoria ausente: ${table}.${column}`);
          }
        }

        if (columns.every((column) => existingColumns.has(column))) {
          ok(`Colunas minimas validadas em ${table}`);
        }
      }

      const systemRolesResult = await client.query(
        `
        SELECT code
        FROM roles
        WHERE tenant_id IS NULL
        `
      );
      const systemRoles = new Set(systemRolesResult.rows.map((row) => row.code));

      for (const roleCode of REQUIRED_SYSTEM_ROLES) {
        if (!systemRoles.has(roleCode)) {
          fail(failures, `Role global nao encontrado: ${roleCode}`);
        }
      }

      if (REQUIRED_SYSTEM_ROLES.every((roleCode) => systemRoles.has(roleCode))) {
        ok("Roles globais padrao encontrados");
      }

      const duplicateMemberships = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT user_id, tenant_id
          FROM memberships
          GROUP BY user_id, tenant_id
          HAVING COUNT(*) > 1
        ) duplicates
        `
      );

      if (duplicateMemberships.rows[0].total > 0) {
        fail(
          failures,
          `Existem duplicidades em memberships (user_id, tenant_id): ${duplicateMemberships.rows[0].total}`
        );
      } else {
        ok("Nao ha duplicidades em memberships (user_id, tenant_id)");
      }

      const crossTenantRoleViolations = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM memberships m
        JOIN roles r ON r.id = m.role_id
        WHERE r.tenant_id IS NOT NULL
          AND r.tenant_id <> m.tenant_id
        `
      );

      if (crossTenantRoleViolations.rows[0].total > 0) {
        fail(
          failures,
          `Encontradas memberships usando role de outro tenant: ${crossTenantRoleViolations.rows[0].total}`
        );
      } else {
        ok("Segregacao tenant x role consistente");
      }

      const usersWithoutMembership = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM users u
        WHERE u.tenant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM memberships m
            WHERE m.user_id = u.id
              AND m.tenant_id = u.tenant_id
          )
        `
      );

      if (usersWithoutMembership.rows[0].total > 0) {
        fail(
          failures,
          `Usuarios sem membership primaria no proprio tenant: ${usersWithoutMembership.rows[0].total}`
        );
      } else {
        ok("Todos os usuarios com tenant possuem membership");
      }
    }

    if (failures.length > 0) {
      console.error(`\nRBAC schema check finished with ${failures.length} falha(s).`);
      process.exit(1);
    }

    console.log("\nRBAC schema check finished successfully.");
  } catch (error) {
    console.error("[FAIL] Erro ao validar schema RBAC:", error.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
