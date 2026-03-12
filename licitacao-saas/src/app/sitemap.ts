import { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID, PORTAL_UFS } from "@/lib/portal";

// Force dynamic rendering - sitemap needs live DB data
export const dynamic = "force-dynamic";

// Each chunk has at most this many licitação URLs
const CHUNK_SIZE = 10_000;

// id=0 → static pages + UF pages + blog posts
// id=1+ → licitações paginated in chunks of CHUNK_SIZE
export async function generateSitemaps() {
  try {
    const result = await query<{ total: string }>(
      `SELECT COUNT(*)::TEXT as total
       FROM licitacoes
       WHERE tenant_id = $1 AND slug IS NOT NULL`,
      [PORTAL_PUBLIC_TENANT_ID]
    );
    const total = parseInt(result[0]?.total || "0");
    const licChunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));

    // id=0 is the static chunk; ids 1..licChunks are licitação chunks
    return Array.from({ length: licChunks + 1 }, (_, i) => ({ id: i }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  // Chunk 0: static pages + UF pages + blog
  if (id === 0) {
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
      {
        url: `${APP_URL}/blog`,
        lastModified: new Date(),
        changeFrequency: "daily",
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
      const blogPosts = await query<{ slug: string; published_at: string }>(
        `SELECT slug, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 500`
      );
      for (const post of blogPosts) {
        staticPages.push({
          url: `${APP_URL}/blog/${post.slug}`,
          lastModified: new Date(post.published_at),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    } catch {
      // Blog table may not exist yet
    }

    return staticPages;
  }

  // Chunks 1+: licitações paginated
  const chunkIndex = id - 1; // 0-based index for OFFSET
  const offset = chunkIndex * CHUNK_SIZE;

  try {
    const licitacoes = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, COALESCE(updated_at, created_at, NOW()) as updated_at
       FROM licitacoes
       WHERE tenant_id = $1 AND slug IS NOT NULL
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [PORTAL_PUBLIC_TENANT_ID, CHUNK_SIZE, offset]
    );

    return licitacoes.map((lic) => ({
      url: `${APP_URL}/editais/${lic.slug}`,
      lastModified: new Date(lic.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}
