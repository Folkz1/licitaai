/**
 * Service API — autenticação por SERVICE_API_KEY (sem session cookie)
 * Permite que agentes externos (Jarbas) operem o LicitAI em produção:
 *   - GET  /api/service?action=status&tenant=<slug>   — status workflows
 *   - POST /api/service  { action: "busca", tenant: "<slug>" }   — disparar busca
 *   - POST /api/service  { action: "unlock", tenant: "<slug>" }  — destravar workflows
 *   - POST /api/service  { action: "health" }                    — healthcheck geral
 */

import { query, queryOne } from "@/lib/db";
import { executarBusca } from "@/lib/pncp/search";
import { NextRequest, NextResponse } from "next/server";

function authenticate(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const xKey = req.headers.get("x-service-key");
  // Aceita CRON_SECRET ou SERVICE_API_KEY independentemente
  const validKeys = [process.env.CRON_SECRET, process.env.SERVICE_API_KEY].filter(Boolean) as string[];
  if (validKeys.length === 0) return false;
  if (xKey && validKeys.includes(xKey)) return true;
  if (authHeader && validKeys.some((k) => authHeader === `Bearer ${k}`)) return true;
  return false;
}

async function resolveTenant(slug: string) {
  return queryOne<{ id: string; nome: string }>(
    `SELECT id, nome FROM tenants WHERE slug = $1 OR nome ILIKE $2`,
    [slug, `%${slug}%`]
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Debug temporario: remover apos confirmar vars
  if (searchParams.get("action") === "debug") {
    return NextResponse.json({
      has_cron: !!process.env.CRON_SECRET,
      has_service: !!process.env.SERVICE_API_KEY,
      cron_len: process.env.CRON_SECRET?.length ?? 0,
      service_len: process.env.SERVICE_API_KEY?.length ?? 0,
    });
  }
  if (!authenticate(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const action = searchParams.get("action") || "status";
  const tenantSlug = searchParams.get("tenant");

  if (action === "health") {
    const [row] = await query(`SELECT COUNT(*) as total FROM licitacoes`);
    return NextResponse.json({ ok: true, total_licitacoes: row.total });
  }

  if (action === "status") {
    const tenant = tenantSlug ? await resolveTenant(tenantSlug) : null;
    const where = tenant ? `WHERE tenant_id = '${tenant.id}'` : "";
    const executions = await query(
      `SELECT id, tenant_id, status, current_step, started_at, finished_at, error_message
       FROM workflow_executions ${where}
       ORDER BY started_at DESC LIMIT 10`
    );
    return NextResponse.json({ tenant, executions });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, tenant: tenantSlug } = body;

    if (action === "health") {
      const [row] = await query(`SELECT COUNT(*) as total FROM licitacoes`);
      return NextResponse.json({ ok: true, total_licitacoes: row.total });
    }

    if (action === "unlock") {
      const tenant = tenantSlug ? await resolveTenant(tenantSlug) : null;
      if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

      const unlocked = await query(
        `UPDATE workflow_executions SET status='ERROR', current_step='Destravado via Service API'
         WHERE tenant_id = $1 AND status IN ('RUNNING','PENDING') RETURNING id`,
        [tenant.id]
      );
      return NextResponse.json({ ok: true, tenant: tenant.nome, unlocked: unlocked.length });
    }

    if (action === "busca") {
      const tenant = tenantSlug ? await resolveTenant(tenantSlug) : null;
      if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

      // Verifica se já tem rodando
      const running = await queryOne(
        `SELECT id FROM workflow_executions WHERE tenant_id = $1 AND status IN ('PENDING','RUNNING')`,
        [tenant.id]
      );
      if (running) return NextResponse.json({ error: "Já existe busca em andamento", execution_id: running.id }, { status: 409 });

      // Cria execução (triggered_by é UUID — não passar string aqui)
      const execution = await queryOne<{ id: string }>(
        `INSERT INTO workflow_executions (tenant_id, workflow_type, status, current_step, logs)
         VALUES ($1, 'busca+analise', 'RUNNING', 'Iniciando busca via Service API...', $2)
         RETURNING id`,
        [tenant.id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca disparada via Service API", level: "info" }])]
      );
      const execId = execution?.id;

      // Dispara busca em background (sem await para retornar imediatamente)
      // Nota: executarBusca já atualiza workflow_executions internamente com status correto (SUCCESS/ERROR/WARNING).
      // O .catch() aqui só captura exceções inesperadas que escaparam do try/catch interno.
      executarBusca(tenant.id, execId, async (msg) => {
        await query(`UPDATE workflow_executions SET current_step = $2 WHERE id = $1`, [execId, msg.slice(0, 500)]);
      }).catch(async (err) => {
        await query(
          `UPDATE workflow_executions SET status='ERROR', finished_at=NOW(), current_step=$2 WHERE id=$1`,
          [execId, `Erro inesperado: ${String(err).slice(0, 200)}`]
        );
      });

      return NextResponse.json({ ok: true, tenant: tenant.nome, execution_id: execId, message: "Busca iniciada em background" });
    }

    return NextResponse.json({ error: "Unknown action. Use: health | status | unlock | busca" }, { status: 400 });
  } catch (err) {
    console.error("[Service API POST] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
