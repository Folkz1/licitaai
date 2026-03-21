import { MetadataRoute } from "next";

/**
 * Core robots.txt rules. Sitemap references are static here for the main
 * sitemap.xml. The paginated edital sub-sitemaps are listed in the
 * sitemap index served at /api/sitemap-index.
 *
 * NOTE: Google discovers sub-sitemaps via robots.txt Sitemap directives.
 * Since Next.js MetadataRoute.Robots only supports a string or string[]
 * for the sitemap field, we list all expected sub-sitemaps statically.
 * With ~50k editais / 5000 per page = 10 pages, we list up to 20 to
 * handle growth.
 */
export default function robots(): MetadataRoute.Robots {
  const BASE_URL = "https://licitai.mbest.site";

  // Generate sitemap references for paginated edital sitemaps
  // We list up to 20 pages (100k editais capacity) - pages with no data return 404 which is fine
  const maxEditaisPages = 20;
  const sitemaps: string[] = [
    `${BASE_URL}/sitemap.xml`,
  ];
  for (let i = 0; i < maxEditaisPages; i++) {
    sitemaps.push(`${BASE_URL}/sitemap-editais/${i}`);
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/api/",
          "/admin",
          "/pipeline",
          "/configuracoes",
          "/licitacoes",
          "/api-keys",
        ],
      },
    ],
    sitemap: sitemaps,
  };
}
