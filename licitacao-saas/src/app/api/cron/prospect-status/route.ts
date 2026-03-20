import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark as 'ativo' if accessed within last 3 days and trial not expired
  const activated = await query(
    `UPDATE portal_leads
     SET prospect_status = 'ativo',
         updated_at = NOW()
     WHERE prospect_status IN ('acessou', 'enviado')
       AND last_access_at >= NOW() - INTERVAL '3 days'
       AND (trial_expires_at IS NULL OR trial_expires_at >= NOW())
     RETURNING id`
  );

  // Mark as 'expirado' if trial expired (never touch 'convertido')
  const expired = await query(
    `UPDATE portal_leads
     SET prospect_status = 'expirado',
         updated_at = NOW()
     WHERE prospect_status NOT IN ('convertido', 'expirado')
       AND trial_expires_at IS NOT NULL
       AND trial_expires_at < NOW()
     RETURNING id`
  );

  return NextResponse.json({
    ok: true,
    activated: activated.length,
    expired: expired.length,
  });
}
