import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 5000;

/**
 * Generates a paginated sitemap XML for edital (licitacao) pages.
 * Each page contains up to 5000 URLs.
 *
 * GET /sitemap-editais/0 -> first 5000 editais
 * GET /sitemap-editais/1 -> next 5000 editais
 * ...
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);

  if (isNaN(page) || page < 0) {
    return new NextResponse("Invalid page number", { status: 400 });
  }

  const offset = page * PAGE_SIZE;

  try {
    const licitacoes = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, COALESCE(updated_at, created_at, NOW()) as updated_at
       FROM licitacoes
       WHERE tenant_id = $1 AND slug IS NOT NULL
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [PORTAL_PUBLIC_TENANT_ID, PAGE_SIZE, offset]
    );

    if (licitacoes.length === 0) {
      return new NextResponse("Sitemap page not found", { status: 404 });
    }

    const urls = licitacoes
      .map((lic) => {
        const lastmod = new Date(lic.updated_at).toISOString().split("T")[0];
        return `  <url>
    <loc>${APP_URL}/editais/${encodeURI(lic.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[SITEMAP-EDITAIS] Error generating sitemap page", page, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
