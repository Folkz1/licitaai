import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/admin/cleanup
// Remove licitações NOVA expiradas há mais de X dias (nunca analisadas, sem valor de pipeline)
// Licitações com análise NUNCA são removidas.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.max(1, parseInt(daysParam || "7"));
  const dryRun = req.nextUrl.searchParams.get("dry_run") !== "false";

  // Preview: quantas serão removidas
  const preview = await query(
    `SELECT COUNT(*) as total
     FROM licitacoes l
     LEFT JOIN analises a ON a.licitacao_id = l.id
     WHERE l.review_phase = 'NOVA'
       AND a.id IS NULL
       AND l.data_encerramento_proposta < NOW() - ($1 || ' days')::INTERVAL`,
    [days]
  );
  const total = parseInt((preview[0] as { total: string }).total);

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      would_delete: total,
      criteria: `NOVA + sem análise + expiradas há mais de ${days} dias`,
    });
  }

  // Executa limpeza
  const result = await query(
    `DELETE FROM licitacoes
     WHERE id IN (
       SELECT l.id FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       WHERE l.review_phase = 'NOVA'
         AND a.id IS NULL
         AND l.data_encerramento_proposta < NOW() - ($1 || ' days')::INTERVAL
     )`,
    [days]
  );

  return NextResponse.json({
    deleted: total,
    criteria: `NOVA + sem análise + expiradas há mais de ${days} dias`,
  });
}

// GET /api/admin/cleanup - preview sem deletar
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.max(1, parseInt(daysParam || "7"));

  const [preview, byPhase] = await Promise.all([
    query(
      `SELECT COUNT(*) as nova_expiradas_sem_analise
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       WHERE l.review_phase = 'NOVA'
         AND a.id IS NULL
         AND l.data_encerramento_proposta < NOW() - ($1 || ' days')::INTERVAL`,
      [days]
    ),
    query(
      `SELECT review_phase, COUNT(*) as total,
         COUNT(*) FILTER (WHERE l.data_encerramento_proposta < NOW()) as expiradas
       FROM licitacoes l
       GROUP BY review_phase ORDER BY total DESC`
    ),
  ]);

  return NextResponse.json({
    would_delete: parseInt((preview[0] as { nova_expiradas_sem_analise: string }).nova_expiradas_sem_analise),
    criteria: `NOVA + sem análise + expiradas há mais de ${days} dias`,
    by_phase: byPhase,
  });
}
