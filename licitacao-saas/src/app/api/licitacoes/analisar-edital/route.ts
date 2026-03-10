import { auth } from "@/lib/auth";
import { getEffectiveTenantId } from "@/lib/tenant";
import { queryOne } from "@/lib/db";
import { analyzeOneLicitacao } from "@/lib/pncp/analyze";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const maxDuration = 300;

const OCR_WEBHOOK = "https://n8n-n8n-start.jz9bd8.easypanel.host/webhook/ocr-supremo";

/** Extract text from PDF buffer using pdf-parse */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid build issues
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text || "";
}

/** Check if file is a PDF by name or mime type */
function isPdf(file: File): boolean {
  const name = file.name?.toLowerCase() || "";
  return name.endsWith(".pdf") || file.type === "application/pdf";
}

/** Check if file is a text-based format we can read directly */
function isTextFile(file: File): boolean {
  const name = file.name?.toLowerCase() || "";
  return name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".rtf")
    || file.type.startsWith("text/");
}

/**
 * POST /api/licitacoes/analisar-edital
 *
 * Fluxo simplificado: recebe edital (PDF ou texto) → cria licitação → analisa → retorna resultado.
 * Campos opcionais: orgao_nome, objeto_compra, link_sistema_origem (enviados via FormData).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse FormData (works for both file upload and text)
  let editalText: string | undefined;
  let orgaoNome = "";
  let objetoCompra = "";
  let linkOrigem = "";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    orgaoNome = (formData.get("orgao_nome") as string) || "";
    objetoCompra = (formData.get("objeto_compra") as string) || "";
    linkOrigem = (formData.get("link_sistema_origem") as string) || "";

    const textField = formData.get("edital_text");
    // Support multiple files: "files" (multiple) or legacy "file" (single)
    const allFiles = formData.getAll("files").concat(formData.getAll("file"));
    const validFiles = allFiles.filter(
      (f): f is File => f instanceof Blob && f.size > 0
    );

    if (textField && typeof textField === "string" && textField.length > 50) {
      editalText = textField;
    } else if (validFiles.length > 0) {
      const textParts: string[] = [];
      const ocrFiles: File[] = [];

      // Phase 1: Extract text from PDFs and text files locally
      for (const file of validFiles) {
        try {
          if (isPdf(file)) {
            const arrayBuffer = await file.arrayBuffer();
            const text = await extractPdfText(Buffer.from(arrayBuffer));
            if (text.trim().length > 50) {
              textParts.push(`--- ${file.name} ---\n${text}`);
            } else {
              // Scanned PDF with no text layer — needs OCR
              ocrFiles.push(file);
            }
          } else if (isTextFile(file)) {
            const text = await file.text();
            if (text.trim().length > 10) {
              textParts.push(`--- ${file.name} ---\n${text}`);
            }
          } else {
            // DOC, XLS, RAR, ZIP, etc. — send to OCR Supremo
            ocrFiles.push(file);
          }
        } catch {
          // If pdf-parse fails, fall back to OCR
          ocrFiles.push(file);
        }
      }

      // Phase 2: Send remaining files to OCR Supremo (if any)
      if (ocrFiles.length > 0) {
        try {
          const documents = await Promise.all(
            ocrFiles.map(async (file, idx) => {
              const arrayBuffer = await file.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString("base64");
              const fileName = file.name || `doc_${idx + 1}.pdf`;
              const mimeType = file.type || "application/pdf";
              return {
                url: `data:${mimeType};base64,${base64}`,
                id: `${randomUUID().slice(0, 8)}_${idx}`,
                nome: fileName,
                tipo: idx === 0 && textParts.length === 0 ? "Edital" : "Anexo",
              };
            })
          );

          const ocrRes = await fetch(OCR_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documents }),
            signal: AbortSignal.timeout(240000), // 4 min
          });

          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            const ocrText = extractOcrText(ocrData);
            if (ocrText.trim().length > 10) {
              textParts.push(ocrText);
            }
          }
          // If OCR fails but we already have text from PDFs, continue anyway
        } catch {
          // OCR failed — continue with whatever text we have
        }
      }

      if (textParts.length > 0) {
        editalText = textParts.join("\n\n");
      }
    }
  } else if (contentType.includes("application/json")) {
    const body = await req.json();
    editalText = body.edital_text;
    orgaoNome = body.orgao_nome || "";
    objetoCompra = body.objeto_compra || "";
    linkOrigem = body.link_sistema_origem || "";
  }

  if (!editalText || editalText.length < 50) {
    return NextResponse.json(
      { error: "Envie o edital em PDF ou cole o texto (mínimo 50 caracteres)" },
      { status: 400 }
    );
  }

  // Extract basic info from edital text if not provided
  if (!orgaoNome) {
    orgaoNome = extractOrgao(editalText) || "Órgão não identificado";
  }
  if (!objetoCompra) {
    objetoCompra = extractObjeto(editalText) || "Objeto extraído do edital";
  }

  // 1. Create licitação
  const ncp = `MANUAL-${randomUUID()}`;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO licitacoes (
      tenant_id, numero_controle_pncp, orgao_nome, objeto_compra,
      link_sistema_origem, status, review_phase, passou_pre_triagem
    ) VALUES ($1,$2,$3,$4,$5,'NOVA','NOVA',true)
    RETURNING id`,
    [tenantId, ncp, orgaoNome, objetoCompra.slice(0, 2000), linkOrigem || null]
  );

  if (!row?.id) {
    return NextResponse.json({ error: "Erro ao criar licitação" }, { status: 500 });
  }

  const licitacaoId = row.id;

  // 2. Run analysis with the edital text
  const result = await analyzeOneLicitacao(licitacaoId, tenantId, editalText);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, id: licitacaoId },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    id: licitacaoId,
    prioridade: result.prioridade,
    review_phase: result.review_phase,
  });
}

// --- Helpers ---

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

/** Try to extract orgão name from first lines of edital */
function extractOrgao(text: string): string {
  const lines = text.split("\n").slice(0, 30);
  for (const line of lines) {
    const clean = line.trim();
    // Common patterns: "PREFEITURA MUNICIPAL DE...", "ESTADO DO...", "GOVERNO..."
    if (/^(prefeitura|estado|governo|munic[ií]pio|secretaria|minist[ée]rio|universidade|instituto|funda[çc][ãa]o|hospital|tribunal)/i.test(clean) && clean.length > 10 && clean.length < 200) {
      return clean.slice(0, 200);
    }
  }
  // Fallback: first non-empty line with >10 chars
  for (const line of lines) {
    const clean = line.trim();
    if (clean.length > 10 && clean.length < 200 && !/^(pag|pág|fl\.|folha|\d+)/i.test(clean)) {
      return clean.slice(0, 200);
    }
  }
  return "";
}

/** Try to extract objeto from edital text */
function extractObjeto(text: string): string {
  // Look for "OBJETO:" or "DO OBJETO" section
  const patterns = [
    /(?:OBJETO|DO OBJETO|OBJETO\s*DA\s*LICITA[ÇC][ÃA]O)\s*[:–\-]\s*(.{20,500})/i,
    /(?:tem\s+por\s+objeto|constitui\s+objeto)\s+(?:a\s+)?(.{20,500})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Clean up: take first sentence
      let obj = match[1].trim();
      const periodIdx = obj.indexOf(".");
      if (periodIdx > 20 && periodIdx < 500) {
        obj = obj.slice(0, periodIdx + 1);
      }
      return obj.slice(0, 500);
    }
  }
  return "";
}
