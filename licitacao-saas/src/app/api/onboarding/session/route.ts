import { NextRequest, NextResponse } from "next/server";
import {
  applyPublicOnboardingCookie,
  resolveOnboardingContext,
} from "@/lib/public-onboarding";
import { queryOne } from "@/lib/db";

type PersistedSession = {
  id: string;
  current_step: number;
  step_1_data: Record<string, unknown>;
  step_2_data: Record<string, unknown>;
  step_3_data: Record<string, unknown>;
  step_4_data: Record<string, unknown>;
  step_5_data: Record<string, unknown>;
  ai_generated_config: Record<string, unknown>;
  status: string;
};

function buildViewer(context: Awaited<ReturnType<typeof resolveOnboardingContext>>) {
  return {
    mode: context?.mode || "public",
    isAuthenticated: context?.mode === "authenticated",
  };
}

export async function GET() {
  try {
    const context = await resolveOnboardingContext({ createIfMissing: true });

    if (!context) {
      return NextResponse.json({ error: "Nao foi possivel iniciar o onboarding." }, { status: 500 });
    }

    const response = NextResponse.json({
      session: context.session,
      tenant: context.tenant,
      isCompleted: context.isCompleted,
      viewer: buildViewer(context),
    });

    return applyPublicOnboardingCookie(response, context.cookieValue);
  } catch (error) {
    console.error("Erro ao buscar sessao de onboarding:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveOnboardingContext({ createIfMissing: true });

    if (!context) {
      return NextResponse.json({ error: "Nao foi possivel iniciar o onboarding." }, { status: 500 });
    }

    const body = await request.json();
    const step = Number(body?.step);
    const data = body?.data;

    if (!step || step < 1 || step > 5) {
      return NextResponse.json(
        { error: "Passo invalido. Deve ser entre 1 e 5." },
        { status: 400 }
      );
    }

    const stepColumn = `step_${step}_data`;
    const nextStep = step < 5 ? step + 1 : step;

    const updatedSession = await queryOne<PersistedSession>(
      `UPDATE onboarding_sessions
       SET ${stepColumn} = $1, current_step = GREATEST(current_step, $2), updated_at = NOW()
       WHERE id = $3
       RETURNING id, current_step, step_1_data, step_2_data, step_3_data, step_4_data, step_5_data, ai_generated_config, status`,
      [JSON.stringify(data || {}), nextStep, context.session.id]
    );

    if (!updatedSession) {
      return NextResponse.json(
        { error: "Sessao de onboarding nao encontrada." },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      session: updatedSession,
      viewer: buildViewer(context),
    });

    return applyPublicOnboardingCookie(response, context.cookieValue);
  } catch (error) {
    console.error("Erro ao salvar passo do onboarding:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
