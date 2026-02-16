import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await query(
    `SELECT t.id, t.nome, t.segmento, t.ativo, t.config, t.onboarding_completed, t.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
            (SELECT COUNT(*) FROM licitacoes l WHERE l.tenant_id = t.id) as licitacao_count,
            s.status as subscription_status,
            p.display_name as plan_name
     FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id
     LEFT JOIN plans p ON p.id = s.plan_id
     ORDER BY t.created_at DESC`
  );

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { nome, segmento, config } = await req.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    // Generate slug from nome
    const slug = nome
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
      .replace(/\s+/g, "-")            // spaces to hyphens
      .replace(/-+/g, "-")             // collapse multiple hyphens
      .replace(/^-|-$/g, "");          // trim hyphens

    // Check slug uniqueness
    const existingSlug = await queryOne("SELECT id FROM tenants WHERE slug = $1", [slug]);
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const tenant = await queryOne(
      `INSERT INTO tenants (nome, slug, segmento, config) VALUES ($1, $2, $3, $4) RETURNING id, nome`,
      [nome.trim(), finalSlug, segmento || null, JSON.stringify(config || {})]
    );

    // Create default subscription (starter plan)
    const starterPlan = await queryOne<{ id: string }>(
      "SELECT id FROM plans WHERE name = 'starter' LIMIT 1"
    );
    if (starterPlan && tenant) {
      await query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status) VALUES ($1, $2, 'ACTIVE')`,
        [(tenant as { id: string }).id, starterPlan.id]
      );
    }

    return NextResponse.json(tenant);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar tenant";
    console.error("POST /api/admin/tenants error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Update tenant
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { nome, segmento } = await req.json();
  if (!nome || !nome.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const tenant = await queryOne(
    `UPDATE tenants SET nome = $1, segmento = $2 WHERE id = $3 RETURNING id, nome`,
    [nome.trim(), segmento || null, id]
  );

  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  return NextResponse.json(tenant);
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

  const { ativo } = await req.json();

  // Check if column exists, add if not
  try {
    await query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE`);
  } catch { /* column might already exist */ }

  const tenant = await queryOne(
    `UPDATE tenants SET ativo = $1 WHERE id = $2 RETURNING id, nome, ativo`,
    [ativo, id]
  );

  if (!tenant) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  return NextResponse.json(tenant);
}

// Delete tenant
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Apenas SUPER_ADMIN pode excluir tenants" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // Don't allow deleting the tenant the admin belongs to
  if (id === session.user.tenantId) {
    return NextResponse.json({ error: "Não é possível excluir seu próprio tenant" }, { status: 400 });
  }

  await query(`DELETE FROM tenants WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
