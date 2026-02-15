import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

// Tipo comum para sessão de onboarding
type OnboardingSession = {
  id: string;
  tenant_id: string;
  current_step: number;
  step_1_data: Record<string, unknown>;
  step_2_data: Record<string, unknown>;
  step_3_data: Record<string, unknown>;
  step_4_data: Record<string, unknown>;
  step_5_data: Record<string, unknown>;
  ai_generated_config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

// GET - Buscar sessão de onboarding atual
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar sessão existente
    let onboardingSession = await queryOne<OnboardingSession>(
      `SELECT * FROM onboarding_sessions 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [session.user.tenantId]
    );

    // Se não existe sessão, criar uma nova
    if (!onboardingSession) {
      onboardingSession = await queryOne<OnboardingSession>(
        `INSERT INTO onboarding_sessions (tenant_id, current_step, status)
         VALUES ($1, 1, 'IN_PROGRESS')
         RETURNING *`,
        [session.user.tenantId]
      );
    }

    // Buscar dados do tenant
    const tenant = await queryOne<{
      nome: string;
      onboarding_completed: boolean;
    }>(
      `SELECT nome, onboarding_completed FROM tenants WHERE id = $1`,
      [session.user.tenantId]
    );

    return NextResponse.json({
      session: onboardingSession,
      tenant,
      isCompleted: tenant?.onboarding_completed || false
    });
  } catch (error) {
    console.error('Erro ao buscar sessão de onboarding:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Salvar dados de um passo
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { step, data } = body;

    if (!step || step < 1 || step > 5) {
      return NextResponse.json(
        { error: 'Passo inválido. Deve ser entre 1 e 5.' },
        { status: 400 }
      );
    }

    // Buscar sessão existente
    let onboardingSession = await queryOne<{ id: string }>(
      `SELECT id FROM onboarding_sessions 
       WHERE tenant_id = $1 AND status = 'IN_PROGRESS'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [session.user.tenantId]
    );

    // Se não existe, criar
    if (!onboardingSession) {
      onboardingSession = await queryOne<{ id: string }>(
        `INSERT INTO onboarding_sessions (tenant_id, current_step, status)
         VALUES ($1, 1, 'IN_PROGRESS')
         RETURNING id`,
        [session.user.tenantId]
      );
    }

    // Atualizar o passo específico
    const stepColumn = `step_${step}_data`;
    const nextStep = step < 5 ? step + 1 : step;

    const updatedSession = await queryOne<{
      id: string;
      current_step: number;
      step_1_data: Record<string, unknown>;
      step_2_data: Record<string, unknown>;
      step_3_data: Record<string, unknown>;
      step_4_data: Record<string, unknown>;
      step_5_data: Record<string, unknown>;
      status: string;
    }>(
      `UPDATE onboarding_sessions 
       SET ${stepColumn} = $1, current_step = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(data), nextStep, onboardingSession!.id]
    );

    return NextResponse.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    console.error('Erro ao salvar passo do onboarding:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
