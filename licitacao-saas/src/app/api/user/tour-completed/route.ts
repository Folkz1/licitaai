import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Add metadata column if it doesn't exist yet
    await query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`
    );
    await query(
      `UPDATE users SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"tour_completed": true}'::jsonb WHERE id = $1`,
      [session.user.id]
    );
  } catch {
    // Non-critical: localStorage is the primary storage for tour state
    console.log("[TOUR] Could not persist tour_completed to DB, localStorage used as fallback");
  }

  return NextResponse.json({ ok: true });
}
