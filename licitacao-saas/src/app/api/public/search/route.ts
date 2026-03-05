import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { createHash } from "crypto";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || "";
  const uf = sp.get("uf") || "";
  const modalidade = sp.get("modalidade") || "";
  const valorMin = sp.get("valor_min") || "";
  const valorMax = sp.get("valor_max") || "";
  const dataInicio = sp.get("data_inicio") || "";
  const dataFim = sp.get("data_fim") || "";
  const temAnalise = sp.get("tem_analise") || "";
  const prazoDias = sp.get("prazo_dias") || "";
  const orderBy = sp.get("order_by") || "";
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20")));
  const offset = (page - 1) * limit;

  // Build query
  const conditions: string[] = ["slug IS NOT NULL"];
  const params: unknown[] = [];
  let paramIdx = 0;

  if (q) {
    paramIdx++;
    conditions.push(
      `to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(orgao_nome, '')) @@ plainto_tsquery('portuguese', $${paramIdx})`
    );
    params.push(q);
  }

  if (uf) {
    paramIdx++;
    conditions.push(`uf = $${paramIdx}`);
    params.push(uf);
  }

  if (modalidade) {
    paramIdx++;
    conditions.push(`modalidade_contratacao ILIKE $${paramIdx}`);
    params.push(`%${modalidade}%`);
  }

  if (valorMin) {
    paramIdx++;
    conditions.push(`valor_total_estimado >= $${paramIdx}`);
    params.push(parseFloat(valorMin));
  }

  if (valorMax) {
    paramIdx++;
    conditions.push(`valor_total_estimado <= $${paramIdx}`);
    params.push(parseFloat(valorMax));
  }

  if (dataInicio) {
    paramIdx++;
    conditions.push(`data_publicacao >= $${paramIdx}`);
    params.push(dataInicio);
  }

  if (dataFim) {
    paramIdx++;
    conditions.push(`data_publicacao <= $${paramIdx}`);
    params.push(dataFim);
  }

  if (temAnalise === "sim") {
    conditions.push(`COALESCE(analysis_count, 0) > 0`);
  }

  if (prazoDias) {
    const dias = parseInt(prazoDias);
    if (dias > 0) {
      conditions.push(`data_encerramento_proposta IS NOT NULL AND data_encerramento_proposta >= NOW() AND data_encerramento_proposta <= NOW() + INTERVAL '${dias} days'`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const orderOptions: Record<string, string> = {
    recentes: "data_publicacao DESC NULLS LAST",
    valor: "valor_total_estimado DESC NULLS LAST",
    encerramento: "data_encerramento_proposta ASC NULLS LAST",
    analisadas: "COALESCE(analysis_count, 0) DESC, data_publicacao DESC NULLS LAST",
  };
  const orderClause = orderOptions[orderBy] || orderOptions.recentes;

  // Count
  const countResult = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::TEXT as total FROM licitacoes ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.total || "0");

  // Fetch
  const items = await query<{
    slug: string;
    orgao_nome: string;
    objeto_compra: string;
    valor_total_estimado: number;
    uf: string;
    municipio: string;
    modalidade_contratacao: string;
    data_publicacao: string;
    data_encerramento_proposta: string;
    has_analysis: boolean;
    score_preview: number | null;
  }>(
    `SELECT slug, orgao_nome, objeto_compra, valor_total_estimado, uf, municipio,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta,
            COALESCE(analysis_count, 0) > 0 as has_analysis,
            avg_score as score_preview
     FROM licitacoes
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  // Log search for analytics (fire and forget)
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const filters = { uf, modalidade, valor_min: valorMin, valor_max: valorMax, data_inicio: dataInicio, data_fim: dataFim, tem_analise: temAnalise, prazo_dias: prazoDias, order_by: orderBy };
  query(
    `INSERT INTO portal_searches (query, filters_json, results_count, ip_hash) VALUES ($1, $2, $3, $4)`,
    [q || null, JSON.stringify(filters), total, ipHash]
  ).catch(() => {});

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
