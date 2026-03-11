import type { GeneratedOnboardingConfig } from "@/lib/onboarding-config";
import { query, queryOne } from "@/lib/db";
import { triggerBusca } from "@/lib/n8n/client";

export interface OnboardingCompletionParams {
  tenantId: string;
  userId: string;
  onboardingSessionId: string;
  config: GeneratedOnboardingConfig | Record<string, unknown>;
  step4Data?: Record<string, unknown>;
}

export interface OnboardingCompletionResult {
  buscaTriggered: boolean;
  summary: {
    keywords_inclusao: number;
    keywords_exclusao: number;
    ufs: number;
    modalidades: number;
  };
}

export async function completeOnboardingSetup(
  params: OnboardingCompletionParams
): Promise<OnboardingCompletionResult> {
  const step4Data = params.step4Data || {};
  const config = params.config || {};
  const filtrosBusca = (config.filtros_busca as Record<string, unknown>) || {};

  const ufsArray = Array.isArray(filtrosBusca.ufs_prioritarias)
    ? (filtrosBusca.ufs_prioritarias as string[])
    : ((step4Data.ufs_interesse as string[]) || []);
  const modalidadesArray = Array.isArray(filtrosBusca.modalidades_recomendadas)
    ? (filtrosBusca.modalidades_recomendadas as number[])
    : ((step4Data.modalidades as number[]) || []);

  const configNome = "Configuracao Inicial (IA)";
  const configPayload = {
    ufs: ufsArray,
    modalidades: modalidadesArray,
    diasRetroativos:
      (filtrosBusca.dias_retroativos as number) ||
      (step4Data.dias_retroativos as number) ||
      15,
    valorMinimo:
      (filtrosBusca.valor_minimo_sugerido as number) ||
      (step4Data.valor_minimo as number) ||
      0,
    valorMaximo:
      (filtrosBusca.valor_maximo_sugerido as number) ||
      (step4Data.valor_maximo as number) ||
      null,
    buscarSrp: (filtrosBusca.buscar_srp as boolean) ?? true,
    buscarMeEpp: (filtrosBusca.buscar_me_epp as boolean) ?? true,
    source: "AI_GENERATED",
  };

  const existingConfig = await queryOne<{ id: string }>(
    `SELECT id
     FROM configuracoes_busca
     WHERE tenant_id = $1 AND (nome = $2 OR source = 'AI_GENERATED')
     ORDER BY created_at ASC
     LIMIT 1`,
    [params.tenantId, configNome]
  );

  if (existingConfig) {
    await query(
      `UPDATE configuracoes_busca
       SET
         ufs = $2,
         modalidades_contratacao = $3,
         dias_retroativos = $4,
         valor_minimo = $5,
         valor_maximo = $6,
         buscar_srp = $7,
         buscar_me_epp = $8,
         source = $9,
         ativa = true,
         ativo = true,
         updated_at = NOW()
       WHERE id = $1`,
      [
        existingConfig.id,
        configPayload.ufs,
        configPayload.modalidades,
        configPayload.diasRetroativos,
        configPayload.valorMinimo,
        configPayload.valorMaximo,
        configPayload.buscarSrp,
        configPayload.buscarMeEpp,
        configPayload.source,
      ]
    );
  } else {
    await query(
      `INSERT INTO configuracoes_busca (
        tenant_id,
        nome,
        ufs,
        modalidades_contratacao,
        dias_retroativos,
        valor_minimo,
        valor_maximo,
        buscar_srp,
        buscar_me_epp,
        source,
        ativa,
        ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true)`,
      [
        params.tenantId,
        configNome,
        configPayload.ufs,
        configPayload.modalidades,
        configPayload.diasRetroativos,
        configPayload.valorMinimo,
        configPayload.valorMaximo,
        configPayload.buscarSrp,
        configPayload.buscarMeEpp,
        configPayload.source,
      ]
    );
  }

  const keywordsInclusao = (config.keywords_inclusao as string[]) || [];
  for (const keyword of keywordsInclusao) {
    await query(
      `INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
       VALUES ($1, $2, 'INCLUSAO', 10, 'AI_GENERATED', 'onboarding')
       ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING`,
      [params.tenantId, keyword.toLowerCase().trim()]
    );
  }

  const keywordsExclusao = (config.keywords_exclusao as string[]) || [];
  for (const keyword of keywordsExclusao) {
    await query(
      `INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
       VALUES ($1, $2, 'EXCLUSAO', 10, 'AI_GENERATED', 'onboarding')
       ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING`,
      [params.tenantId, keyword.toLowerCase().trim()]
    );
  }

  await query(
    `UPDATE tenants
     SET
       ai_config = $1,
       onboarding_completed = true,
       updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(config), params.tenantId]
  );

  await query(
    `UPDATE onboarding_sessions
     SET
       status = 'COMPLETED',
       completed_at = NOW(),
       current_step = 5
     WHERE id = $1`,
    [params.onboardingSessionId]
  );

  const promptPreTriagem = (config.prompt_pre_triagem as string) || null;
  const promptAnalise = (config.prompt_analise as string) || null;

  if (promptPreTriagem) {
    await query(
      `INSERT INTO custom_prompts (tenant_id, prompt_type, content)
       VALUES ($1, 'PRE_TRIAGEM', $2)
       ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [params.tenantId, promptPreTriagem]
    );
  }

  if (promptAnalise) {
    await query(
      `INSERT INTO custom_prompts (tenant_id, prompt_type, content)
       VALUES ($1, 'ANALISE_COMPLETA', $2)
       ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [params.tenantId, promptAnalise]
    );
  }

  const existingSchedules = await queryOne<{ id: string }>(
    `SELECT id FROM cron_schedules WHERE tenant_id = $1 AND workflow = 'BUSCA_PNCP'`,
    [params.tenantId]
  );

  if (!existingSchedules) {
    await query(
      `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
       VALUES ($1, 'BUSCA_PNCP', 'DAILY', 6, 0, '{1,2,3,4,5}', '{"force": false}')`,
      [params.tenantId]
    );

    await query(
      `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
       VALUES ($1, 'ANALISE_EDITAIS', 'DAILY', 8, 0, '{1,2,3,4,5}', '{"max_licitacoes": 10}')`,
      [params.tenantId]
    );
  }

  let buscaTriggered = false;
  try {
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'busca', 'PENDING', $2, 'Busca inicial pos-onboarding...', $3)
       RETURNING id`,
      [
        params.tenantId,
        params.userId,
        JSON.stringify([
          {
            time: new Date().toISOString(),
            message: "Busca automatica pos-onboarding",
            level: "info",
          },
        ]),
      ]
    );

    await triggerBusca(params.tenantId, execution?.id);

    await query(
      `UPDATE workflow_executions SET status = 'RUNNING', current_step = 'Conectando ao PNCP...' WHERE id = $1`,
      [execution?.id]
    );

    buscaTriggered = true;
  } catch (error) {
    console.error("Erro ao disparar busca automatica pos-onboarding:", error);
  }

  return {
    buscaTriggered,
    summary: {
      keywords_inclusao: keywordsInclusao.length,
      keywords_exclusao: keywordsExclusao.length,
      ufs: (filtrosBusca.ufs_prioritarias as string[])?.length || 0,
      modalidades: (filtrosBusca.modalidades_recomendadas as number[])?.length || 0,
    },
  };
}
