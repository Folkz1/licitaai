import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { createTrialPresente } from "@/lib/prospeccao";

const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";
const MAX_DAILY_PROSPECTS = Number(process.env.MAX_DAILY_PROSPECTS || 10);
const DELAY_BETWEEN_SENDS_MS = 30_000; // 30 seconds

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only send Monday-Friday during business hours (9h-17h BRT = 12h-20h UTC)
    const now = new Date();
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;
    const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({ ok: true, message: "Fim de semana. Envios apenas seg-sex.", sent: 0, skipped: true });
    }

    if (brtHour < 9 || brtHour >= 17) {
      return NextResponse.json({ ok: true, message: `Fora do horário comercial (${brtHour}h BRT). Envios das 9h às 17h.`, sent: 0, skipped: true });
    }

    // Check how many were already sent today (prospect_status changed to 'enviado' today)
    const sentToday = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM portal_leads
       WHERE source = 'prospeccao'
         AND prospect_status = 'enviado'
         AND updated_at >= CURRENT_DATE
         AND updated_at < CURRENT_DATE + INTERVAL '1 day'`
    );

    const alreadySent = Number(sentToday?.count || 0);
    const remainingQuota = Math.max(0, MAX_DAILY_PROSPECTS - alreadySent);

    if (remainingQuota === 0) {
      const queueCount = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM portal_leads WHERE source = 'prospeccao' AND prospect_status = 'fila'"
      );

      return NextResponse.json({
        ok: true,
        message: `Limite diário atingido (${MAX_DAILY_PROSPECTS} envios). Tentando novamente amanhã.`,
        sent: 0,
        failed: 0,
        alreadySentToday: alreadySent,
        remaining: Number(queueCount?.count || 0),
      });
    }

    // Fetch queued leads
    const toSend = await query<{
      id: string;
      nome: string;
      email: string;
      telefone: string;
      empresa: string;
      qualification_data: Record<string, unknown> | null;
    }>(
      `SELECT id, nome, email, telefone, empresa, qualification_data
       FROM portal_leads
       WHERE source = 'prospeccao'
         AND prospect_status = 'fila'
       ORDER BY created_at ASC
       LIMIT $1`,
      [remainingQuota]
    );

    if (toSend.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Nenhum prospect na fila.",
        sent: 0,
        failed: 0,
        alreadySentToday: alreadySent,
        remaining: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ nome: string; status: string; error?: string }> = [];

    for (let i = 0; i < toSend.length; i++) {
      const prospect = toSend[i];
      const qualData = prospect.qualification_data || {};
      const segmento = (qualData.segmento as string) || "";
      const uf = (qualData.uf as string) || "";

      if (!prospect.telefone || !prospect.email) {
        await query(
          "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
          [prospect.id]
        );
        failed++;
        results.push({
          nome: prospect.nome,
          status: "erro_envio",
          error: "Dados incompletos (telefone ou email ausente)",
        });
        continue;
      }

      try {
        const result = await createTrialPresente(
          {
            nome: prospect.nome,
            empresa: prospect.empresa,
            segmento,
            uf,
            telefone: prospect.telefone,
            email: prospect.email,
          },
          { createdBy: "cron-prospect-send" }
        );

        if (result.success) {
          // createTrialPresente creates a new portal_lead with prospect_status='enviado'
          // Remove the original queued entry
          await query("DELETE FROM portal_leads WHERE id = $1", [prospect.id]);
          sent++;
          results.push({ nome: prospect.nome, status: "enviado" });
        } else {
          await query(
            "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
            [prospect.id]
          );
          failed++;
          results.push({
            nome: prospect.nome,
            status: "erro_envio",
            error: result.error || "Falha ao criar trial",
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`[PROSPECT-SEND] Erro ao processar ${prospect.nome}:`, err);
        await query(
          "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
          [prospect.id]
        );
        failed++;
        results.push({ nome: prospect.nome, status: "erro_envio", error: errorMsg });
      }

      // Rate limit: 30s between sends (skip delay after last one)
      if (i < toSend.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
      }
    }

    // Count remaining in queue
    const remainingInQueue = await queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM portal_leads WHERE source = 'prospeccao' AND prospect_status = 'fila'"
    );

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      alreadySentToday: alreadySent,
      remaining: Number(remainingInQueue?.count || 0),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[PROSPECT-SEND] Erro no cron:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
