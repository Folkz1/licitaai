import { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { APP_URL, PORTAL_UFS } from "@/lib/portal";

// Force dynamic rendering - sitemap needs live DB data
export const dynamic = "force-dynamic";

/**
 * Main sitemap.xml - core pages, UF state pages, and blog posts only.
 * Edital pages (~49K URLs) are served via paginated sub-sitemaps at
 * /sitemap-editais/[page] and referenced in robots.txt.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: APP_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    // Main listing pages
    {
      url: `${APP_URL}/editais`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/precos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    // Pillar pages (guias SEO)
    {
      url: `${APP_URL}/guia/como-participar-de-licitacoes`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/guia/como-vender-para-o-governo`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/guia/nova-lei-14133-licitacoes`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // UF pages (27 states)
    ...PORTAL_UFS.map((uf) => ({
      url: `${APP_URL}/editais/${uf.toLowerCase()}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];

  // Blog posts
  try {
    const blogPosts = await query<{ slug: string; published_at: string }>(
      `SELECT slug, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 500`
    );
    for (const post of blogPosts) {
      pages.push({
        url: `${APP_URL}/blog/${post.slug}`,
        lastModified: new Date(post.published_at),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Blog table may not exist yet
  }

  return pages;
}
