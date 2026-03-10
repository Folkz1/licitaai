import { createNurturingSequence } from "@/lib/nurturing";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leadId } = body;

  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  try {
    await createNurturingSequence(leadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[LEADS-ENRICH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
