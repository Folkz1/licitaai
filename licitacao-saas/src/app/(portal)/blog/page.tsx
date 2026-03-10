import { query, queryOne } from "@/lib/db";
import { APP_URL } from "@/lib/portal";
import { Calendar, Clock, Eye, ArrowRight, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const CATEGORY_LABELS: Record<string, string> = {
  resumo: "Resumo",
  analise: "Análise",
  guia: "Guia",
  mercado: "Mercado",
  dica: "Dica",
};

const CATEGORY_COLORS: Record<string, string> = {
  resumo: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  analise: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  guia: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  mercado: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  dica: "bg-pink-500/10 text-pink-300 border-pink-500/30",
};

export const metadata: Metadata = {
  title: "Blog - Inteligência em Licitações Públicas | LicitaIA",
  description:
    "Resumos semanais, análises de mercado, guias e rankings de licitações públicas. Dados reais do PNCP analisados por IA.",
  openGraph: {
    title: "Blog LicitaIA - Inteligência em Licitações",
    description: "Análises, resumos e guias sobre licitações públicas no Brasil.",
    type: "website",
    url: `${APP_URL}/blog`,
  },
};

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  read_time_minutes: number;
  view_count: number;
  published_at: string;
}

interface Props {
  searchParams?: Promise<{ page?: string; category?: string }>;
}

export default async function BlogListPage({ searchParams }: Props) {
  const sp = (await searchParams) || {};
  const currentPage = Math.max(1, Number(sp.page || "1"));
  const category = sp.category || null;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const conditions = ["status = 'published'"];
  const params: unknown[] = [];

  if (category && Object.keys(CATEGORY_LABELS).includes(category)) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [posts, countRow] = await Promise.all([
    query<BlogPost>(
      `SELECT id, slug, title, description, category, tags, read_time_minutes, view_count, published_at
       FROM blog_posts ${where}
       ORDER BY published_at DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      params
    ),
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::TEXT as total FROM blog_posts ${where}`,
      params
    ),
  ]);

  const total = Number(countRow?.total || "0");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categories = Object.entries(CATEGORY_LABELS);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300 transition-colors">Início</Link>
        <span>/</span>
        <span className="text-slate-300">Blog</span>
      </nav>

      <section className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Blog LicitaIA
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Análises semanais, rankings de oportunidades e guias práticos sobre licitações
          públicas — tudo gerado a partir de dados reais do PNCP.
        </p>
      </section>

      {/* Category Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/blog"
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            !category
              ? "bg-indigo-500 text-white"
              : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
          }`}
        >
          Todos
        </Link>
        {categories.map(([key, label]) => (
          <Link
            key={key}
            href={`/blog?category=${key}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              category === key
                ? "bg-indigo-500 text-white"
                : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-12 text-center">
          <p className="text-slate-400">Nenhum post encontrado.</p>
          <Link
            href="/blog"
            className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
          >
            Ver todos os posts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-slate-700"
              >
                <Badge
                  className={`${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.dica} border`}
                >
                  {CATEGORY_LABELS[post.category] || post.category}
                </Badge>

                <h2 className="mt-4 text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>

                {post.description && (
                  <p className="mt-2 text-sm text-slate-400 line-clamp-3">
                    {post.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.published_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {post.read_time_minutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {post.view_count}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/blog?page=${Math.max(1, currentPage - 1)}${category ? `&category=${category}` : ""}`}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${
                    currentPage > 1
                      ? "border-slate-700 hover:border-slate-500"
                      : "pointer-events-none border-slate-800 text-slate-600"
                  }`}
                >
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </Link>
                <Link
                  href={`/blog?page=${Math.min(totalPages, currentPage + 1)}${category ? `&category=${category}` : ""}`}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${
                    currentPage < totalPages
                      ? "border-slate-700 hover:border-slate-500"
                      : "pointer-events-none border-slate-800 text-slate-600"
                  }`}
                >
                  Próxima <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
