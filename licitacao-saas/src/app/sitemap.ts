import { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID, PORTAL_UFS } from "@/lib/portal";

// Force dynamic rendering - sitemap needs live DB data
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${APP_URL}/editais`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/precos`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    // Pillar pages (guias SEO)
    {
      url: `${APP_URL}/guia/como-participar-de-licitacoes`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/guia/como-vender-para-o-governo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/guia/nova-lei-14133-licitacoes`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // UF pages (27 states)
    ...PORTAL_UFS.map((uf) => ({
      url: `${APP_URL}/editais/${uf.toLowerCase()}`,
      lastModified: new Date(),
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
        priority: 0.6,
      });
    }
  } catch {
    // Blog table may not exist yet
  }

  // Licitações (max 49k to stay under 50k limit)
  try {
    const licitacoes = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, COALESCE(updated_at, created_at, NOW()) as updated_at
       FROM licitacoes
       WHERE tenant_id = $1 AND slug IS NOT NULL
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT 49000`,
      [PORTAL_PUBLIC_TENANT_ID]
    );
    for (const lic of licitacoes) {
      pages.push({
        url: `${APP_URL}/editais/${lic.slug}`,
        lastModified: new Date(lic.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // DB may not be available at build time
  }

  return pages;
}
