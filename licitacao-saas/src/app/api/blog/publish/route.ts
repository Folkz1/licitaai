import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status } = body;

  if (!id || !["published", "draft", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const result = await queryOne<{ id: string; slug: string; status: string }>(
    `UPDATE blog_posts
     SET status = $1,
         published_at = CASE WHEN $1 = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, slug, status`,
    [status, id]
  );

  if (!result) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, post: result });
}
