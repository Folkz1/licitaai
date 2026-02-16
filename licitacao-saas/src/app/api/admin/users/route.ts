import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const users = await query(
    `SELECT u.id, u.email, u.nome as name, u.role, u.ativo as is_active, 
            u.ultimo_login as last_login_at, u.created_at,
            u.tenant_id,
            t.nome as tenant_nome
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     ${isSuperAdmin ? "" : "WHERE u.tenant_id = $1"}
     ORDER BY u.created_at DESC`,
    isSuperAdmin ? [] : [session.user.tenantId]
  );

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, name, password, role, tenantId } = await req.json();

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Nome, email e senha são obrigatórios" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
  }

  const targetTenantId = session.user.role === "SUPER_ADMIN" 
    ? (tenantId || session.user.tenantId) 
    : session.user.tenantId;

  // Validate that the tenant exists
  const tenantExists = await queryOne("SELECT id FROM tenants WHERE id = $1", [targetTenantId]);
  if (!tenantExists) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 400 });
  }

  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
  }

  // Non-SUPER_ADMIN can't create SUPER_ADMIN users
  const finalRole = session.user.role !== "SUPER_ADMIN" && role === "SUPER_ADMIN" ? "ADMIN" : (role || "VIEWER");

  const passwordHash = await hash(password, 12);

  const user = await queryOne(
    `INSERT INTO users (email, nome, password_hash, role, tenant_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, nome as name, role`,
    [email, name, passwordHash, finalRole, targetTenantId]
  );

  return NextResponse.json(user);
}

// Update user
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { name, role, password, tenantId } = await req.json();

  // Build dynamic update
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (name) {
    updates.push(`nome = $${paramIdx++}`);
    values.push(name);
  }
  if (role) {
    // Non-SUPER_ADMIN can't promote to SUPER_ADMIN
    const finalRole = session.user.role !== "SUPER_ADMIN" && role === "SUPER_ADMIN" ? "ADMIN" : role;
    updates.push(`role = $${paramIdx++}`);
    values.push(finalRole);
  }
  if (password) {
    const passwordHash = await hash(password, 12);
    updates.push(`password_hash = $${paramIdx++}`);
    values.push(passwordHash);
  }
  if (tenantId && session.user.role === "SUPER_ADMIN") {
    updates.push(`tenant_id = $${paramIdx++}`);
    values.push(tenantId);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  values.push(id);
  const user = await queryOne(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING id, email, nome as name, role`,
    values
  );

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

// Toggle active/inactive
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // Don't allow deactivating yourself
  if (id === session.user.id) {
    return NextResponse.json({ error: "Não é possível desativar seu próprio usuário" }, { status: 400 });
  }

  const { ativo } = await req.json();

  const user = await queryOne(
    `UPDATE users SET ativo = $1 WHERE id = $2 RETURNING id, nome, ativo`,
    [ativo, id]
  );

  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  return NextResponse.json(user);
}
