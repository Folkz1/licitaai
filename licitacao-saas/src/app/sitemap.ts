import { MetadataRoute } from "next";
import { query } from "@/lib/db";

// Force dynamic rendering - sitemap needs live DB data
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: appUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${appUrl}/editais`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    // Dynamic licitação pages
    const licitacoes = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, COALESCE(updated_at, created_at, NOW()) as updated_at
       FROM licitacoes
       WHERE slug IS NOT NULL
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT 50000`
    );

    const dynamicPages: MetadataRoute.Sitemap = licitacoes.map((lic) => ({
      url: `${appUrl}/editais/${lic.slug}`,
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
