import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [config, keywords] = await Promise.all([
    queryOne(
      "SELECT * FROM configuracoes_busca WHERE tenant_id = $1 LIMIT 1",
      [tenantId]
    ),
    query(
      "SELECT * FROM palavras_chave WHERE tenant_id = $1 ORDER BY tipo, palavra",
      [tenantId]
    ),
  ]);

  return NextResponse.json({ config, keywords });
}
