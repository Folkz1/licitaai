import { auth } from "@/lib/auth";
import { pool, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|headless|preview|facebookexternalhit|slurp|bingpreview/i;

interface TrackPayload {
  path?: string;
  referrer?: string | null;
  sessionId?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackPayload;
    const userAgent = req.headers.get("user-agent") || "";

    if (BOT_USER_AGENT_REGEX.test(userAgent)) {
      return NextResponse.json({ ignored: true }, { status: 202 });
    }

    const path = body.path?.trim();
    const sessionId = body.sessionId?.trim();

    if (!path || !path.startsWith("/") || !sessionId) {
      return NextResponse.json(
        { error: "path e sessionId são obrigatórios." },
        { status: 400 }
      );
    }

    const duplicate = await queryOne<{ id: number }>(
      `SELECT id
         FROM page_views
        WHERE session_id = $1
          AND path = $2
          AND created_at >= NOW() - INTERVAL '5 minutes'
        LIMIT 1`,
      [sessionId, path]
    );

    if (duplicate) {
      return NextResponse.json({ duplicate: true }, { status: 202 });
    }

    let session:
      | {
          user?: {
            id?: string;
            tenantId?: string;
          };
        }
      | null = null;

    try {
      session = await auth();
    } catch {
      session = null;
    }
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      null;

    await pool.query(
      `INSERT INTO page_views (
        path,
        referrer,
        user_agent,
        ip_hash,
        user_id,
        tenant_id,
        session_id,
        utm_source,
        utm_medium,
        utm_campaign,
        country
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        path.slice(0, 500),
        body.referrer?.slice(0, 1000) || null,
        userAgent.slice(0, 1000),
        ipHash,
        session?.user?.id || null,
        session?.user?.tenantId || null,
        sessionId.slice(0, 200),
        body.utmSource?.slice(0, 120) || null,
        body.utmMedium?.slice(0, 120) || null,
        body.utmCampaign?.slice(0, 180) || null,
        country,
      ]
    );

    console.log(`[TRACK] Page view registrada para ${path}`);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao registrar page view.";

    console.log(`[TRACK] Erro ao registrar page view: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
