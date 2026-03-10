import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: "https://licitai.mbest.site/sitemap.xml",
  };
}
