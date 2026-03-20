import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prospects = await query<{
    id: string;
    nome: string;
    empresa: string | null;
    telefone: string | null;
    email: string;
    interesse: string | null;
    status: string;
    trial_status: string | null;
    trial_started_at: string | null;
    trial_expires_at: string | null;
    trial_days_left: number | null;
    trial_expired: boolean;
    access_token_last_sent_at: string | null;
    qualification_data: Record<string, unknown> | null;
    tenant_id: string | null;
    created_at: string;
    updated_at: string | null;
    first_access_at: string | null;
    last_access_at: string | null;
    access_count: number;
    prospect_status: string;
  }>(
    `SELECT
      pl.id,
      pl.nome,
      pl.empresa,
      pl.telefone,
      pl.email,
      pl.interesse,
      COALESCE(pl.status, 'novo') AS status,
      pl.trial_status,
      pl.trial_started_at,
      pl.trial_expires_at,
      CASE
        WHEN pl.trial_expires_at IS NULL THEN NULL
        ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (pl.trial_expires_at - NOW())) / 86400.0))::INT
      END AS trial_days_left,
      CASE
        WHEN pl.trial_expires_at IS NOT NULL AND pl.trial_expires_at < NOW() THEN true
        ELSE false
      END AS trial_expired,
      pl.access_token_last_sent_at,
      pl.qualification_data,
      pl.tenant_id,
      pl.created_at,
      pl.updated_at,
      pl.first_access_at,
      pl.last_access_at,
      COALESCE(pl.access_count, 0)::INT AS access_count,
      CASE
        WHEN COALESCE(pl.status, 'novo') = 'convertido'
          OR COALESCE(pl.prospect_status, '') = 'convertido'
          THEN 'convertido'
        WHEN pl.trial_expires_at IS NOT NULL AND pl.trial_expires_at < NOW() THEN 'expirado'
        WHEN pl.last_access_at IS NOT NULL AND pl.last_access_at >= NOW() - INTERVAL '3 days' THEN 'ativo'
        WHEN COALESCE(pl.access_count, 0) > 0 THEN 'acessou'
        ELSE 'enviado'
      END AS prospect_status
    FROM portal_leads pl
    WHERE pl.source = 'prospeccao'
       OR pl.qualification_channel = 'prospeccao'
    ORDER BY pl.created_at DESC
    LIMIT 200`
  );

  const stats = {
    total: prospects.length,
    acessaram: prospects.filter((p) => p.access_count > 0).length,
    ativos: prospects.filter((p) => p.prospect_status === "ativo").length,
    expirados: prospects.filter((p) => p.prospect_status === "expirado").length,
    convertidos: prospects.filter((p) => p.prospect_status === "convertido").length,
  };

  return NextResponse.json({ prospects, stats });
}
