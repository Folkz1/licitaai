import { auth } from "@/lib/auth";
import { generateBlogPost, type BlogPostType } from "@/lib/blog-generator";
import { NextRequest, NextResponse } from "next/server";

const VALID_TYPES: BlogPostType[] = [
  "resumo_semanal",
  "top_valor",
  "segmento",
  "ranking_cidades",
  "guia",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const type = body.type as BlogPostType;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const post = await generateBlogPost(type);
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    console.error("[BLOG-GENERATE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
