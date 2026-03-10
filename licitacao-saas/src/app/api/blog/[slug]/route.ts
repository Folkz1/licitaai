import { queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const post = await queryOne(
    `UPDATE blog_posts
     SET view_count = view_count + 1
     WHERE slug = $1 AND status = 'published'
     RETURNING id, slug, title, description, content, category, tags, author,
       seo_title, seo_description, read_time_minutes, view_count,
       published_at, created_at`,
    [slug]
  );

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}
