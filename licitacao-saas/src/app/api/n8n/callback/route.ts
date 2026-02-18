import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workflow, tenant_id, status, metrics, llm_usage, execution_id } = body;

  // Log the workflow execution
  await query(
    `INSERT INTO log_execucoes (tenant_id, workflow_nome, status, metricas, data_inicio)
     VALUES ($1, $2, $3, $4, NOW())`,
    [tenant_id, workflow, status, JSON.stringify(metrics)]
  );

  // Update workflow_executions table if execution_id provided
  if (execution_id) {
    const finalStatus = status === "OK" || status === "SUCCESS" ? "SUCCESS" : "ERROR";
    const logEntry = JSON.stringify({
      time: new Date().toISOString(),
      message: finalStatus === "SUCCESS"
        ? `Workflow "${workflow}" concluído com sucesso`
        : `Workflow "${workflow}" finalizou com erro: ${status}`,
      level: finalStatus === "SUCCESS" ? "info" : "error",
    });

    await query(
      `UPDATE workflow_executions 
       SET status = $1, 
           finished_at = NOW(), 
           progress = 100,
           current_step = $2,
           metrics = COALESCE(metrics, '{}'::jsonb) || $3::jsonb,
           logs = COALESCE(logs, '[]'::jsonb) || $4::jsonb
       WHERE id = $5`,
      [
        finalStatus,
        finalStatus === "SUCCESS" ? "Concluído ✓" : `Erro: ${status}`,
        JSON.stringify(metrics || {}),
        `[${logEntry}]`,
        execution_id,
      ]
    );
  }

  // Track LLM usage if provided by n8n callback
  // n8n should send: { llm_usage: [{ model, workflow, input_tokens, output_tokens, licitacao_id? }] }
  if (llm_usage && Array.isArray(llm_usage)) {
    for (const usage of llm_usage) {
      const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
      const costUsd = estimateCost(usage.model, usage.input_tokens || 0, usage.output_tokens || 0);

      await query(
        `INSERT INTO llm_usage (tenant_id, workflow, model, licitacao_id, input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tenant_id,
          usage.workflow || workflow,
          usage.model || "unknown",
          usage.licitacao_id || null,
          usage.input_tokens || 0,
          usage.output_tokens || 0,
          totalTokens,
          costUsd,
          usage.latency_ms || null,
          JSON.stringify(usage.metadata || {}),
        ]
      );
    }
  }

  // Auto-advance review_phase based on analysis results
  // P1/P2 analyzed → PRE_TRIAGEM, PRE_TRIAGEM_REJEITAR → REJEITADA
  if (workflow === "ANALISE_EDITAIS" && (status === "OK" || status === "SUCCESS") && tenant_id) {
    await query(
      `UPDATE licitacoes l
       SET status = 'ANALISADA',
           updated_at = NOW()
       FROM analises a
       WHERE a.licitacao_id = l.id
         AND l.tenant_id = $1
         AND l.status <> 'ANALISADA'`,
      [tenant_id]
    );
    await query(
      `UPDATE licitacoes l
       SET review_phase = 'PRE_TRIAGEM',
           updated_at = NOW()
       FROM analises a
       WHERE a.licitacao_id = l.id
         AND l.tenant_id = $1
         AND l.review_phase = 'NOVA'
         AND a.prioridade IN ('P1', 'P2')
         AND (a.tipo_oportunidade IS NULL OR a.tipo_oportunidade <> 'PRE_TRIAGEM_REJEITAR')`,
      [tenant_id]
    );
    await query(
      `UPDATE licitacoes l
       SET review_phase = 'REJEITADA',
           updated_at = NOW()
       FROM analises a
       WHERE a.licitacao_id = l.id
         AND l.tenant_id = $1
         AND l.review_phase = 'NOVA'
         AND a.tipo_oportunidade = 'PRE_TRIAGEM_REJEITAR'`,
      [tenant_id]
    );
  }

  return NextResponse.json({ received: true });
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gemini-3-pro-preview": { input: 1.25, output: 10 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ||
    Object.entries(MODEL_COSTS).find(([k]) => model?.includes(k))?.[1] ||
    { input: 1, output: 4 };
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}
