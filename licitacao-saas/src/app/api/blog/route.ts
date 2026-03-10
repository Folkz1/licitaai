import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "12")));
  const category = searchParams.get("category");
  const offset = (page - 1) * limit;

  const conditions = ["status = 'published'"];
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [posts, countRow] = await Promise.all([
    query(
      `SELECT id, slug, title, description, category, tags, author, read_time_minutes, published_at, view_count
       FROM blog_posts ${where}
       ORDER BY published_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::TEXT as total FROM blog_posts ${where}`,
      params
    ),
  ]);

  return NextResponse.json({
    posts,
    total: Number(countRow?.total || "0"),
    page,
    totalPages: Math.ceil(Number(countRow?.total || "0") / limit),
  });
}
