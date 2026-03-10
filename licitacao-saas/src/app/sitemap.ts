import { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID, PORTAL_UFS } from "@/lib/portal";

// Force dynamic rendering - sitemap needs live DB data
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
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
    ...PORTAL_UFS.map((uf) => ({
      url: `${APP_URL}/editais/${uf.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];

  try {
    // Dynamic licitação pages
    const licitacoes = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, COALESCE(updated_at, created_at, NOW()) as updated_at
       FROM licitacoes
       WHERE tenant_id = $1 AND slug IS NOT NULL
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT 50000`,
      [PORTAL_PUBLIC_TENANT_ID]
    );

    const dynamicPages: MetadataRoute.Sitemap = licitacoes.map((lic) => ({
      url: `${APP_URL}/editais/${lic.slug}`,
      lastModified: new Date(lic.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...dynamicPages];
  } catch {
    // If DB unavailable, return static pages only
    return staticPages;
  }
}
