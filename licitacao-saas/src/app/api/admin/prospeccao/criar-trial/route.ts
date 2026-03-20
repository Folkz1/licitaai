import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { normalizePhone } from "@/lib/trial";
import { createTrialPresente } from "@/lib/prospeccao";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    // Auth: must be SUPER_ADMIN
    const session = await auth();
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const nome = cleanString(body.nome);
    const empresa = cleanString(body.empresa);
    const segmento = cleanString(body.segmento);
    const uf = cleanString(body.uf).toUpperCase();
    const telefone = cleanString(body.telefone);
    const email = cleanString(body.email).toLowerCase();

    // Validation
    if (!nome) {
      return NextResponse.json({ error: "Campo 'nome' é obrigatório." }, { status: 400 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "Campo 'empresa' é obrigatório." }, { status: 400 });
    }
    if (!segmento) {
      return NextResponse.json({ error: "Campo 'segmento' é obrigatório." }, { status: 400 });
    }
    if (!uf || uf.length !== 2) {
      return NextResponse.json({ error: "Campo 'uf' deve ser a sigla do estado (ex: SP, RJ)." }, { status: 400 });
    }
    if (!telefone) {
      return NextResponse.json({ error: "Campo 'telefone' é obrigatório para envio via WhatsApp." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Campo 'email' inválido." }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(telefone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: "Telefone inválido. Use formato brasileiro (DDD + número)." }, { status: 400 });
    }

    const result = await createTrialPresente(
      { nome, empresa, segmento, uf, telefone, email },
      { createdBy: session?.user?.id || "admin" }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao criar trial" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      prospect: {
        leadId: result.leadId,
        tenantId: result.tenantId,
        userId: result.userId,
        nome,
        empresa,
        segmento,
        uf,
        email,
        telefone: normalizedPhone,
      },
      accessLink: result.accessLink,
      whatsappSent: result.whatsappSent,
      nurturingSteps: [
        { step: 1, scheduledAt: "agora", status: result.whatsappSent ? "sent" : "pending" },
        { step: 2, scheduledAt: "dia 5", status: "pending" },
        { step: 3, scheduledAt: "dia 7", status: "pending" },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("[PROSPECCAO] Erro ao criar trial:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
