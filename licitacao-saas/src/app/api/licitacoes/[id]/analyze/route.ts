import { auth } from "@/lib/auth";
import { getEffectiveTenantId } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import { analyzeOneLicitacao } from "@/lib/pncp/analyze";
import { assertTenantOperationalAccess } from "@/lib/trial";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * POST /api/licitacoes/[id]/analyze
 * Dispara análise de IA para uma licitação específica.
 *
 * Body (JSON): { edital_text?: string }
 * Body (multipart): field "edital_text" OR file "file" (PDF → OCR Supremo)
 *
 * Para entradas manuais: aceita texto colado ou arquivo PDF.
 * Para licitações PNCP: tenta buscar arquivos do PNCP se não houver texto.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: licitacaoId } = await params;

  // Verify ownership
  const lic = await queryOne<{ id: string; numero_controle_pncp: string }>(
    `SELECT id, numero_controle_pncp FROM licitacoes WHERE id = $1 AND tenant_id = $2`,
    [licitacaoId, tenantId]
  );
  if (!lic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await assertTenantOperationalAccess(tenantId, "analysis");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trial indisponivel";
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode || 403)
      : 403;
    return NextResponse.json({ error: message }, { status: statusCode });
  }

  // Extract edital text from request
  let editalText: string | undefined;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // File upload or text field via form
    const formData = await req.formData();
    const textField = formData.get("edital_text");
    const file = formData.get("file");

    if (textField && typeof textField === "string" && textField.length > 10) {
      editalText = textField;
    } else if (file && file instanceof Blob) {
      // Send file to OCR Supreme directly (bypass N8N)
      const OCR_URL = process.env.OCR_SUPREME_URL || "https://ocr-supreme.jz9bd8.easypanel.host";
      const OCR_KEY = process.env.OCR_SUPREME_API_KEY || "";
      try {
        const fileName = (file as File).name || "edital.pdf";
        const formData = new FormData();
        formData.append("file", file, fileName);

        const headers: Record<string, string> = {};
        if (OCR_KEY) headers["X-API-Key"] = OCR_KEY;

        const ocrRes = await fetch(`${OCR_URL}/onlyocr/`, {
          method: "POST",
          headers,
          body: formData,
          signal: AbortSignal.timeout(300000),
        });

        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          editalText = ocrData?.data?.content || extractOcrText(ocrData);
        }
      } catch (ocrErr) {
        console.error("[ANALYZE] OCR falhou:", ocrErr);
        // Continue without text — will analyze by objeto only
      }
    }
  } else if (contentType.includes("application/json")) {
    const body = await req.json();
    editalText = body.edital_text;
  }

  // Run analysis
  const result = await analyzeOneLicitacao(licitacaoId, tenantId, editalText);

  if (!result.success) {
    const errorMessage = result.error || "";
    const status = errorMessage.includes("expirou")
      ? 403
      : errorMessage.includes("trial")
        ? 429
        : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Create persistent notification for P1 priorities
  if (result.prioridade === "P1") {
    await queryOne(
      `INSERT INTO notifications (tenant_id, type, title, message, link)
       VALUES ($1, 'urgent', 'P1 — Licitação de Alta Prioridade!', $2, $3)
       ON CONFLICT DO NOTHING`,
      [tenantId, `Licitação ${lic.numero_controle_pncp} requer ação imediata`, `/licitacoes/${licitacaoId}`]
    ).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    prioridade: result.prioridade,
    review_phase: result.review_phase,
  });
}

function extractOcrText(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(extractOcrText).join("\n");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.text && typeof obj.text === "string") return obj.text;
    if (obj.content && typeof obj.content === "string") return obj.content;
    if (obj.pages) return extractOcrText(obj.pages);
    if (obj.results) return extractOcrText(obj.results);
    return Object.values(obj).map(extractOcrText).join("\n");
  }
  return "";
}
