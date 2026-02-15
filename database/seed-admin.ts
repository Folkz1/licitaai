/**
 * Script para criar o primeiro usuario admin
 * Uso: npx tsx database/seed-admin.ts
 */

import { Pool } from "pg";
import { hash } from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable";

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const tenantResult = await pool.query("SELECT id, nome FROM tenants LIMIT 1");
    const tenant = tenantResult.rows[0];

    if (!tenant) {
      console.log("Nenhum tenant encontrado!");
      return;
    }

    console.log(`Usando tenant: ${tenant.nome} (${tenant.id})`);

    const email = "admin@licitaia.com";
    const password = "admin123";
    const passwordHash = await hash(password, 12);

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log("Usuario admin ja existe! Atualizando senha e role...");
      await pool.query(
        "UPDATE users SET password_hash = $1, role = 'SUPER_ADMIN' WHERE email = $2",
        [passwordHash, email]
      );
    } else {
      await pool.query(
        `INSERT INTO users (tenant_id, email, nome, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenant.id, email, "Administrador", passwordHash, "SUPER_ADMIN"]
      );
    }

    console.log("Sucesso!");
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(`Role: SUPER_ADMIN`);
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await pool.end();
  }
}

seed();
