import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
<<<<<<< HEAD
import { NextResponse } from "next/server";

// GET - List all configs
=======
import { NextRequest, NextResponse } from "next/server";

>>>>>>> master
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

<<<<<<< HEAD
  const configs = await query(
    "SELECT * FROM configuracoes_busca WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantId]
  );

  return NextResponse.json({ config: configs });
}

// POST - Create new config
export async function POST() {
=======
  const [config, keywords, prompts] = await Promise.all([
    queryOne(
      "SELECT * FROM configuracoes_busca WHERE tenant_id = $1 LIMIT 1",
      [tenantId]
    ),
    query(
      "SELECT * FROM palavras_chave WHERE tenant_id = $1 ORDER BY tipo, palavra",
      [tenantId]
    ),
    query(
      "SELECT id, prompt_type, content, is_active, updated_at FROM custom_prompts WHERE tenant_id = $1 ORDER BY prompt_type",
      [tenantId]
    ),
  ]);

  return NextResponse.json({ config, keywords, prompts });
}

export async function PUT(req: NextRequest) {
>>>>>>> master
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

<<<<<<< HEAD
  // This endpoint is now handled by the specific route
  return NextResponse.json({ error: "Use /api/configuracoes/search to create" }, { status: 400 });
=======
  const body = await req.json();
  const { prompt_type, content } = body;

  if (!prompt_type || !content) {
    return NextResponse.json({ error: "prompt_type e content são obrigatórios" }, { status: 400 });
  }

  await query(
    `INSERT INTO custom_prompts (tenant_id, prompt_type, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
    [tenantId, prompt_type, content]
  );

  return NextResponse.json({ success: true });
>>>>>>> master
}
