import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { completeOnboardingSetup } from "@/lib/onboarding-completion";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

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
        { error: "Sessao de onboarding nao encontrada" },
        { status: 404 }
      );
    }

    const result = await completeOnboardingSetup({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      onboardingSessionId: onboardingSession.id,
      config: onboardingSession.ai_generated_config || {},
      step4Data: onboardingSession.step_4_data || {},
    });

    return NextResponse.json({
      success: true,
      redirect: "/dashboard",
      busca_triggered: result.buscaTriggered,
      summary: result.summary,
    });
  } catch (error) {
    console.error("Erro ao completar onboarding:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
