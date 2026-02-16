import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { generatePrompts } from '@/lib/prompts';

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
      step_1_data: Record<string, unknown>;
      step_2_data: Record<string, unknown>;
      step_3_data: Record<string, unknown>;
      step_4_data: Record<string, unknown>;
    }>(
      `SELECT id, ai_generated_config, step_1_data, step_2_data, step_3_data, step_4_data 
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
    const step1Data = onboardingSession.step_1_data || {};
    const step2Data = onboardingSession.step_2_data || {};
    const step3Data = onboardingSession.step_3_data || {};
    const step4Data = onboardingSession.step_4_data || {};
    
    // Se não tem config da IA, usar dados do step 4 diretamente
    const hasConfig = config && Object.keys(config).length > 0;
    
    // Keywords da IA ou fallback para keywords manuais do step 3
    const keywordsInclusao = (config.keywords_inclusao as string[]) || (step3Data.palavras_chave_manual as string[]) || [];
    const keywordsExclusao = (config.keywords_exclusao as string[]) || [];
    
    // Se não tem keywords de IA, gerar do step 3 (produtos_servicos)
    const finalKeywordsInclusao = keywordsInclusao.length > 0 ? keywordsInclusao : 
      ((step3Data.produtos_servicos as string) || '').toLowerCase()
        .split(/[,\n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 2)
        .slice(0, 20);
    
    // Gerar keywords de exclusão do step 3 se não houver
    const finalKeywordsExclusao = keywordsExclusao.length > 0 ? keywordsExclusao :
      ((step3Data.exclusoes as string) || '').toLowerCase()
        .split(/[,\n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 2)
        .slice(0, 10);
    
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
    for (const keyword of finalKeywordsInclusao) {
      await query(
        `INSERT INTO palavras_chave (tenant_id, palavra, tipo, peso, source, categoria)
         VALUES ($1, $2, 'INCLUSAO', 10, 'AI_GENERATED', 'onboarding')
         ON CONFLICT (tenant_id, palavra, tipo) DO NOTHING`,
        [session.user.tenantId, keyword.toLowerCase().trim()]
      );
    }

    // 3. Inserir keywords de exclusão
    for (const keyword of finalKeywordsExclusao) {
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

    // 7. Gerar e salvar prompts personalizados
    const promptContext = {
      empresa: {
        razao_social: (step1Data.razao_social as string) || '',
        nome_fantasia: (step1Data.nome_fantasia as string) || '',
        porte: (step1Data.porte as string) || '',
        setor: (step1Data.setor as string) || '',
        descricao: (step1Data.descricao_livre as string) || ''
      },
      ramo: {
        principal: (step2Data.ramo_principal as string) || '',
        secundario: (step2Data.ramo_secundario as string[]) || [],
        experiencia_pregao: (step2Data.experiencia_pregao as boolean) || false,
        tipos_clientes: (step2Data.tipos_clientes as string[]) || []
      },
      produtos: {
        lista: (step3Data.produtos_servicos as string) || '',
        palavras_chave_manual: (step3Data.palavras_chave_manual as string[]) || [],
        exclusoes: (step3Data.exclusoes as string) || ''
      },
      preferencias: {
        ufs: (step4Data.ufs_interesse as string[]) || [],
        modalidades: ((step4Data.modalidades as number[]) || []).map(m => ({ codigo: String(m), nome: `Modalidade ${m}` })),
        valor_minimo: (step4Data.valor_minimo as number) || 0,
        valor_maximo: (step4Data.valor_maximo as number) || null
      }
    };

    const prompts = generatePrompts(promptContext);

    // Salvar prompts no banco
    await query(
      `INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
       VALUES ($1, 'PRE_TRIAGEM', $2, true)
       ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, is_active = true, updated_at = NOW()`,
      [session.user.tenantId, prompts.PRE_TRIAGEM]
    );

    await query(
      `INSERT INTO custom_prompts (tenant_id, prompt_type, content, is_active)
       VALUES ($1, 'ANALISE_COMPLETA', $2, true)
       ON CONFLICT (tenant_id, prompt_type) DO UPDATE SET content = EXCLUDED.content, is_active = true, updated_at = NOW()`,
      [session.user.tenantId, prompts.ANALISE_COMPLETA]
    );

    return NextResponse.json({
      success: true,
      redirect: '/dashboard',
      summary: {
        keywords_inclusao: finalKeywordsInclusao.length,
        keywords_exclusao: finalKeywordsExclusao.length,
        ufs: (filtrosBusca.ufs_prioritarias as string[])?.length || (step4Data.ufs_interesse as string[])?.length || 0,
        modalidades: (filtrosBusca.modalidades_recomendadas as number[])?.length || (step4Data.modalidades as number[])?.length || 0
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
