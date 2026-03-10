import { query, queryOne } from "@/lib/db";
import { APP_URL } from "@/lib/portal";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, Eye, ArrowRight, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LeadCaptureForm from "@/components/portal/LeadCaptureForm";
import BlogContent from "@/components/blog/BlogContent";

export const dynamic = "force-dynamic";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  category: string;
  tags: string[];
  author: string;
  seo_title: string | null;
  seo_description: string | null;
  read_time_minutes: number;
  view_count: number;
  published_at: string;
  created_at: string;
}

interface Props {
  params: Promise<{ slug: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  resumo: "Resumo Semanal",
  analise: "Análise",
  guia: "Guia",
  mercado: "Mercado",
  dica: "Dica",
};

async function getPost(slug: string) {
  // Increment view and return
  return queryOne<BlogPost>(
    `UPDATE blog_posts
     SET view_count = view_count + 1, updated_at = NOW()
     WHERE slug = $1 AND status = 'published'
     RETURNING id, slug, title, description, content, category, tags, author,
       seo_title, seo_description, read_time_minutes, view_count, published_at, created_at`,
    [slug]
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await queryOne<{ title: string; seo_title: string | null; seo_description: string | null; description: string | null }>(
    `SELECT title, seo_title, seo_description, description FROM blog_posts WHERE slug = $1 AND status = 'published'`,
    [slug]
  );

  if (!post) return { title: "Post não encontrado | LicitaIA" };

  const title = post.seo_title || post.title;
  const description = post.seo_description || post.description || "";

  return {
    title: `${title} | Blog LicitaIA`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_URL}/blog/${slug}`,
      siteName: "LicitaIA",
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const related = await query<{ slug: string; title: string; category: string; published_at: string }>(
    `SELECT slug, title, category, published_at FROM blog_posts
     WHERE status = 'published' AND category = $1 AND slug != $2
     ORDER BY published_at DESC LIMIT 5`,
    [post.category, slug]
  );

  const categories = await query<{ category: string; total: string }>(
    `SELECT category, COUNT(*)::TEXT as total FROM blog_posts WHERE status = 'published' GROUP BY category ORDER BY COUNT(*) DESC`
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    author: { "@type": "Organization", name: post.author || "LicitaIA" },
    publisher: { "@type": "Organization", name: "LicitaIA" },
    datePublished: post.published_at,
    dateModified: post.published_at,
    mainEntityOfPage: `${APP_URL}/blog/${slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors">Início</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-slate-300 transition-colors">Blog</Link>
          <span>/</span>
          <Link href={`/blog?category=${post.category}`} className="hover:text-slate-300 transition-colors">
            {CATEGORY_LABELS[post.category] || post.category}
          </Link>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-[200px]">{post.title.slice(0, 40)}...</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <article className="space-y-6">
            <header>
              <Badge className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {CATEGORY_LABELS[post.category] || post.category}
              </Badge>
              <h1 className="mt-4 text-3xl font-bold text-white leading-tight sm:text-4xl">
                {post.title}
              </h1>
              {post.description && (
                <p className="mt-3 text-base text-slate-400 leading-relaxed">{post.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.published_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {post.read_time_minutes} min de leitura
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {post.view_count} visualizações
                </span>
              </div>
            </header>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <BlogContent content={post.content} />
            </div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-slate-500" />
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-slate-700 text-slate-400">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-slate-950/50 p-8 text-center">
              <h2 className="text-xl font-semibold text-white">
                Monitore licitações com inteligência artificial
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Cadastre-se grátis no LicitaIA e receba alertas personalizados de oportunidades.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                >
                  Começar grátis <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/editais"
                  className="inline-flex items-center rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  Ver editais abertos
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-4">
            <LeadCaptureForm compact sourceSlug={`blog-${post.slug}`} />

            {related.length > 0 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Posts Relacionados</h3>
                <div className="space-y-3">
                  {related.map((r) => (
                    <Link key={r.slug} href={`/blog/${r.slug}`} className="block group">
                      <p className="text-sm text-slate-400 line-clamp-2 group-hover:text-white transition-colors">
                        {r.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(r.published_at).toLocaleDateString("pt-BR")}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Categorias</h3>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.category}
                    href={`/blog?category=${cat.category}`}
                    className="flex items-center justify-between text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <span>{CATEGORY_LABELS[cat.category] || cat.category}</span>
                    <span className="text-slate-600">{cat.total}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Mais do LicitaIA</h3>
              <div className="space-y-2 text-sm">
                <Link href="/editais" className="block text-slate-400 hover:text-white transition-colors">
                  Portal de Editais
                </Link>
                <Link href="/precos" className="block text-slate-400 hover:text-white transition-colors">
                  Planos e Preços
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
