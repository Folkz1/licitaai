import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

<<<<<<< HEAD
// GET - List all keywords
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keywords = await query(
    "SELECT * FROM palavras_chave WHERE tenant_id = $1 ORDER BY tipo, palavra",
    [tenantId]
  );

  return NextResponse.json(keywords);
}

// POST - Add keyword
=======
>>>>>>> master
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { palavra, tipo } = await req.json();

  await query(
<<<<<<< HEAD
    "INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso) VALUES ($1, $2, $3, 10) ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING",
=======
    "INSERT INTO palavras_chave (tenant_id, palavra, tipo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
>>>>>>> master
    [tenantId, palavra.toLowerCase().trim(), tipo]
  );

  return NextResponse.json({ success: true });
}

<<<<<<< HEAD
// DELETE - Remove keyword
=======
>>>>>>> master
export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");

  await query(
    "DELETE FROM palavras_chave WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );

  return NextResponse.json({ success: true });
}
