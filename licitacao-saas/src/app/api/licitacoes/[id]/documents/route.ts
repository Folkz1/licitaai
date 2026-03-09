import { getEffectiveTenantId } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function parsePncpNcp(ncp: string) {
  if (!ncp) return null;
  const parts = ncp.match(/^(\d+)-\d+-(\d+)\/(\d+)$/);
  if (!parts) return null;
  return { cnpj: parts[1], sequencial: parts[2], ano: parts[3] };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lic = await queryOne<{ numero_controle_pncp: string }>(
    "SELECT numero_controle_pncp FROM licitacoes WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );

  if (!lic || !lic.numero_controle_pncp) {
    return NextResponse.json({ documents: [] });
  }

  const parsed = parsePncpNcp(lic.numero_controle_pncp);
  if (!parsed) return NextResponse.json({ documents: [] });

  const baseUrl = `https://pncp.gov.br/pncp-api/v1/orgaos/${parsed.cnpj}/compras/${parsed.ano}/${parsed.sequencial}/arquivos`;

  try {
    const res = await fetch(baseUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return NextResponse.json({ documents: [] });

    const files = await res.json();
    if (!Array.isArray(files)) return NextResponse.json({ documents: [] });

    const documents = files
      .filter((f: Record<string, unknown>) => f.statusAtivo !== false)
      .map((f: Record<string, unknown>) => ({
        sequencial: f.sequencialDocumento || 1,
        titulo: f.titulo || "Documento",
        tipo: f.tipoDocumentoNome || "Documento",
        url: f.url || `${baseUrl}/${f.sequencialDocumento || 1}`,
      }));

    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ documents: [] });
  }
}
