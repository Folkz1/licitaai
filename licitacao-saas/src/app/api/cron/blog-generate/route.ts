import { generateBlogPost, type BlogPostType } from "@/lib/blog-generator";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Monday: resumo_semanal, Wednesday: alternating, Friday: ranking
  const day = new Date().getDay();
  let type: BlogPostType;

  if (day === 1) {
    type = "resumo_semanal";
  } else if (day === 3) {
    // Alternate between top_valor and segmento
    const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    type = weekNum % 2 === 0 ? "top_valor" : "segmento";
  } else if (day === 5) {
    type = "ranking_cidades";
  } else {
    return NextResponse.json({ ok: true, message: "Not a generation day" });
  }

  try {
    const post = await generateBlogPost(type);
    return NextResponse.json({ ok: true, type, post });
  } catch (err) {
    console.error("[BLOG-CRON]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
