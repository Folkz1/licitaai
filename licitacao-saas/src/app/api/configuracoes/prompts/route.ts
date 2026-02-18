import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET - List custom prompts
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompts = await query(
    "SELECT * FROM custom_prompts WHERE tenant_id = $1 AND is_active = true",
    [tenantId]
  );

  const promptsByType = (prompts as Array<{ prompt_type: string; content: string }>).reduce((acc, p) => {
    acc[p.prompt_type] = p.content;
    return acc;
  }, {} as Record<string, string>);

  return NextResponse.json(promptsByType);
}

// PUT - Update prompt
export async function PUT(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt_type, content } = await req.json();

  if (!prompt_type || !content) {
    return NextResponse.json({ error: "prompt_type e content são obrigatórios" }, { status: 400 });
  }

  await query(
    `INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
    [tenantId, prompt_type, content]
  );

  return NextResponse.json({ success: true });
}
