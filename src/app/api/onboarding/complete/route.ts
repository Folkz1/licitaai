import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

// POST - Completar onboarding e salvar configurações
export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar sessão de onboarding
    const onboardingSession = await queryOne<{
      id: string;
      ai_generated_config: Record<string, unknown>;
      step_4_data: Record<string, unknown>;
    }>(
      `SELECT id, ai_generated_config, step_4_data 
       FROM onboarding_sessions 
       WHERE tenant_id = $1 AND status = 'IN_PROGRESS'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [session.user.tenantId]
    );

    if (!onboardingSession) {
      return NextResponse.json(
        { error: 'Sessão de onboarding não encontrada' },
        { status: 404 }
      );
    }

    const config = onboardingSession.ai_generated_config;
    const step4Data = onboardingSession.step_4_data || {};
    
    // Se não tem config da IA, usar dados do step 4 diretamente
    const hasConfig = config && Object.keys(config).length > 0;
    
    // 1. Inserir/atualizar configuracoes_busca
    const filtrosBusca = hasConfig ? (config.filtros_busca as Record<string, unknown>) : {};
    
    // Converter arrays para formato PostgreSQL
    const ufsArray = Array.isArray(filtrosBusca.ufs_prioritarias) 
      ? filtrosBusca.ufs_prioritarias 
      : (step4Data.ufs_interesse as string[]) || [];
    const modalidadesArray = Array.isArray(filtrosBusca.modalidades_recomendadas)
      ? filtrosBusca.modalidades_recomendadas
      : (step4Data.modalidades as number[]) || [];
    
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
        ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT (tenant_id) DO UPDATE SET
        ufs = EXCLUDED.ufs,
        modalidades_contratacao = EXCLUDED.modalidades_contratacao,
        dias_retroativos = EXCLUDED.dias_retroativos,
        valor_minimo = EXCLUDED.valor_minimo,
        valor_maximo = EXCLUDED.valor_maximo,
        buscar_srp = EXCLUDED.buscar_srp,
        buscar_me_epp = EXCLUDED.buscar_me_epp,
        source = EXCLUDED.source,
        updated_at = NOW()`,
      [
        session.user.tenantId,
        'Configuração Inicial (IA)',
        ufsArray,
        modalidadesArray,
        (filtrosBusca.dias_retroativos as number) || (step4Data.dias_retroativos as number) || 15,
        (filtrosBusca.valor_minimo_sugerido as number) || (step4Data.valor_minimo as number) || 0,
        (filtrosBusca.valor_maximo_sugerido as number) || (step4Data.valor_maximo as number) || null,
        (filtrosBusca.buscar_srp as boolean) ?? true,
        (filtrosBusca.buscar_me_epp as boolean) ?? true,
        'AI_GENERATED'
      ]
    );

    // 2. Inserir keywords de inclusão
    const keywordsInclusao = (config.keywords_inclusao as string[]) || [];
    for (const keyword of keywordsInclusao) {
      await query(
        `INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
         VALUES ($1, $2, 'INCLUSAO', 10, 'AI_GENERATED', 'onboarding')
         ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING`,
        [session.user.tenantId, keyword.toLowerCase().trim()]
      );
    }

    // 3. Inserir keywords de exclusão
    const keywordsExclusao = (config.keywords_exclusao as string[]) || [];
    for (const keyword of keywordsExclusao) {
      await query(
        `INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
         VALUES ($1, $2, 'EXCLUSAO', 10, 'AI_GENERATED', 'onboarding')
         ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING`,
        [session.user.tenantId, keyword.toLowerCase().trim()]
      );
    }

    // 4. Atualizar tenant com ai_config e onboarding_completed
    await query(
      `UPDATE tenants 
       SET 
         ai_config = $1,
         onboarding_completed = true,
         updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(config), session.user.tenantId]
    );

    // 5. Marcar sessão como completa
    await query(
      `UPDATE onboarding_sessions
       SET 
         status = 'COMPLETED',
         completed_at = NOW(),
         current_step = 5
       WHERE id = $1`,
      [onboardingSession.id]
    );

    // 6. Criar cron_schedules padrão se não existirem
    const existingSchedules = await queryOne<{ id: string }>(
      `SELECT id FROM cron_schedules WHERE tenant_id = $1 AND workflow = 'BUSCA_PNCP'`,
      [session.user.tenantId]
    );

    if (!existingSchedules) {
      await query(
        `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
         VALUES ($1, 'BUSCA_PNCP', 'DAILY', 6, 0, '{1,2,3,4,5}', '{"force": false}')`,
        [session.user.tenantId]
      );

      await query(
        `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
         VALUES ($1, 'ANALISE_EDITAIS', 'DAILY', 8, 0, '{1,2,3,4,5}', '{"max_licitacoes": 10}')`,
        [session.user.tenantId]
      );
    }

    return NextResponse.json({
      success: true,
      redirect: '/dashboard',
      summary: {
        keywords_inclusao: keywordsInclusao.length,
        keywords_exclusao: keywordsExclusao.length,
        ufs: (filtrosBusca.ufs_prioritarias as string[])?.length || 0,
        modalidades: (filtrosBusca.modalidades_recomendadas as number[])?.length || 0
      }
    });
  } catch (error) {
    console.error('Erro ao completar onboarding:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
