import LeadCaptureForm from "@/components/portal/LeadCaptureForm";
import { Badge } from "@/components/ui/badge";
import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import {
  APP_URL,
  PORTAL_PUBLIC_TENANT_ID,
  UF_NAMES,
  type PortalUf,
} from "@/lib/portal";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Flame,
  MapPin,
  Search,
  Star,
} from "lucide-react";

const PAGE_SIZE = 50;

interface StateFilters {
  cidade?: string;
  modalidade?: string;
  valor_min?: string;
  valor_max?: string;
  prazo_dias?: string;
  page?: string;
}

interface PortalStateLicitacao {
  id: string;
  slug: string;
  orgao_nome: string | null;
  objeto_compra: string | null;
  valor_total_estimado: number | null;
  modalidade_contratacao: string | null;
  data_publicacao: string | null;
  data_encerramento_proposta: string | null;
  uf: string | null;
  municipio: string | null;
  analysis_count: number;
  avg_score: number | null;
}

function buildStateUrl(uf: PortalUf, filters: StateFilters): string {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString
    ? `/editais/${uf.toLowerCase()}?${queryString}`
    : `/editais/${uf.toLowerCase()}`;
}

function companyLabel(value: number): string {
  return value === 1 ? "empresa" : "empresas";
}

export default async function StatePortalPage({
  uf,
  filters,
}: {
  uf: PortalUf;
  filters: StateFilters;
}) {
  const stateName = UF_NAMES[uf];
  const currentPage = Math.max(1, Number(filters.page || "1") || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const conditions: string[] = ["tenant_id = $1", "slug IS NOT NULL", "UPPER(uf) = $2"];
  const params: unknown[] = [PORTAL_PUBLIC_TENANT_ID, uf];
  let paramIndex = params.length;

  if (filters.cidade) {
    paramIndex += 1;
    conditions.push(`municipio = $${paramIndex}`);
    params.push(filters.cidade);
  }

  if (filters.modalidade) {
    paramIndex += 1;
    conditions.push(`modalidade_contratacao ILIKE $${paramIndex}`);
    params.push(`%${filters.modalidade}%`);
  }

  if (filters.valor_min) {
    paramIndex += 1;
    conditions.push(`valor_total_estimado >= $${paramIndex}`);
    params.push(Number(filters.valor_min));
  }

  if (filters.valor_max) {
    paramIndex += 1;
    conditions.push(`valor_total_estimado <= $${paramIndex}`);
    params.push(Number(filters.valor_max));
  }

  if (filters.prazo_dias) {
    const prazo = Number(filters.prazo_dias);
    if (prazo > 0) {
      conditions.push(
        `data_encerramento_proposta IS NOT NULL AND data_encerramento_proposta >= NOW() AND data_encerramento_proposta <= NOW() + INTERVAL '${prazo} days'`
      );
    }
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [stats, totalRows, licitacoes, cidades, modalidades] = await Promise.all([
    queryOne<{
      total: string;
      valor_total: string;
      cidades: string;
      modalidades: string;
    }>(
      `SELECT
        COUNT(*)::TEXT AS total,
        COALESCE(SUM(valor_total_estimado), 0)::TEXT AS valor_total,
        COUNT(DISTINCT municipio)::TEXT AS cidades,
        COUNT(DISTINCT modalidade_contratacao)::TEXT AS modalidades
       FROM licitacoes
       WHERE tenant_id = $1
         AND UPPER(uf) = $2`,
      [PORTAL_PUBLIC_TENANT_ID, uf]
    ),
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::TEXT AS total FROM licitacoes ${whereClause}`,
      params
    ),
    query<PortalStateLicitacao>(
      `SELECT
        id,
        slug,
        orgao_nome,
        objeto_compra,
        valor_total_estimado,
        modalidade_contratacao,
        data_publicacao,
        data_encerramento_proposta,
        uf,
        municipio,
        COALESCE(analysis_count, 0)::INT AS analysis_count,
        avg_score::FLOAT AS avg_score
       FROM licitacoes
       ${whereClause}
       ORDER BY data_publicacao DESC NULLS LAST
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      params
    ),
    query<{ municipio: string; total: string }>(
      `SELECT municipio, COUNT(*)::TEXT AS total
       FROM licitacoes
       WHERE tenant_id = $1 AND UPPER(uf) = $2 AND municipio IS NOT NULL
       GROUP BY municipio
       ORDER BY COUNT(*) DESC, municipio ASC
       LIMIT 200`,
      [PORTAL_PUBLIC_TENANT_ID, uf]
    ),
    query<{ modalidade_contratacao: string }>(
      `SELECT DISTINCT modalidade_contratacao
       FROM licitacoes
       WHERE tenant_id = $1 AND UPPER(uf) = $2 AND modalidade_contratacao IS NOT NULL
       ORDER BY modalidade_contratacao ASC
       LIMIT 100`,
      [PORTAL_PUBLIC_TENANT_ID, uf]
    ),
  ]);

  const total = Number(totalRows?.total || "0");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentFilters: StateFilters = {
    cidade: filters.cidade,
    modalidade: filters.modalidade,
    valor_min: filters.valor_min,
    valor_max: filters.valor_max,
    prazo_dias: filters.prazo_dias,
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "GovernmentService",
      name: `Licitações abertas em ${stateName}`,
      description: `${Number(stats?.total || "0").toLocaleString("pt-BR")} licitações abertas em ${stateName}, com filtros públicos e sinais de análise por IA.`,
      areaServed: {
        "@type": "AdministrativeArea",
        name: stateName,
      },
      provider: {
        "@type": "Organization",
        name: "LicitaIA",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: APP_URL },
        { "@type": "ListItem", position: 2, name: "Editais", item: `${APP_URL}/editais` },
        {
          "@type": "ListItem",
          position: 3,
          name: stateName,
          item: `${APP_URL}/editais/${uf.toLowerCase()}`,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors">Início</Link>
          <span>/</span>
          <Link href="/editais" className="hover:text-slate-300 transition-colors">Editais</Link>
          <span>/</span>
          <span className="text-slate-300">{stateName}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-8">
              <Badge className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">{uf}</Badge>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Licitações Abertas em {stateName}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {Number(stats?.total || "0").toLocaleString("pt-BR")} licitações públicas disponíveis neste estado, com sinais de demanda gerados pelo uso da plataforma.
              </p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total" value={Number(stats?.total || "0")} />
              <StatCard label="Valor total" value={stats?.valor_total ? formatCurrency(Number(stats.valor_total)) : "R$ 0,00"} />
              <StatCard label="Cidades ativas" value={Number(stats?.cidades || "0")} />
              <StatCard label="Modalidades" value={Number(stats?.modalidades || "0")} />
            </div>

            <form action={`/editais/${uf.toLowerCase()}`} method="GET" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Search className="h-4 w-4 text-indigo-300" />
                Filtros do estado
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select name="cidade" defaultValue={filters.cidade || ""} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200">
                  <option value="">Todas as cidades</option>
                  {cidades.map((cidade) => <option key={cidade.municipio} value={cidade.municipio}>{cidade.municipio} ({cidade.total})</option>)}
                </select>
                <select name="modalidade" defaultValue={filters.modalidade || ""} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200">
                  <option value="">Todas as modalidades</option>
                  {modalidades.map((modalidade) => <option key={modalidade.modalidade_contratacao} value={modalidade.modalidade_contratacao}>{modalidade.modalidade_contratacao}</option>)}
                </select>
                <input type="number" min="0" name="valor_min" defaultValue={filters.valor_min || ""} placeholder="Valor mínimo" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500" />
                <input type="number" min="0" name="valor_max" defaultValue={filters.valor_max || ""} placeholder="Valor máximo" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500" />
                <select name="prazo_dias" defaultValue={filters.prazo_dias || ""} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200">
                  <option value="">Qualquer prazo</option>
                  <option value="7">Encerra em 7 dias</option>
                  <option value="15">Encerra em 15 dias</option>
                  <option value="30">Encerra em 30 dias</option>
                </select>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">Aplicar filtros</button>
                <Link href={`/editais/${uf.toLowerCase()}`} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500">Limpar</Link>
              </div>
            </form>

            <div className="space-y-4">
              {licitacoes.map((licitacao) => (
                <article key={licitacao.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {licitacao.modalidade_contratacao && <Badge variant="outline" className="border-slate-700 text-slate-400">{licitacao.modalidade_contratacao}</Badge>}
                    {licitacao.analysis_count > 0 && <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-300"><Flame className="mr-1 h-3.5 w-3.5" />Analisada por {licitacao.analysis_count} {companyLabel(licitacao.analysis_count)}</Badge>}
                    {licitacao.avg_score != null && licitacao.avg_score > 7 && <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><Star className="mr-1 h-3.5 w-3.5" />Alta relevância segundo IA</Badge>}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white"><Link href={`/editais/${licitacao.slug}`} className="hover:text-indigo-300">{licitacao.objeto_compra}</Link></h2>
                  <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                    <Info icon={<Building2 className="h-4 w-4" />} label="Órgão" value={licitacao.orgao_nome || "Não informado"} />
                    <Info icon={<MapPin className="h-4 w-4" />} label="Cidade" value={licitacao.municipio || "Não informada"} />
                    <Info icon={<Calendar className="h-4 w-4" />} label="Publicação" value={licitacao.data_publicacao ? new Date(licitacao.data_publicacao).toLocaleDateString("pt-BR") : "Não informada"} />
                    <Info icon={<Clock className="h-4 w-4" />} label="Encerramento" value={licitacao.data_encerramento_proposta ? new Date(licitacao.data_encerramento_proposta).toLocaleDateString("pt-BR") : "Não informado"} />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-lg font-semibold text-emerald-300">{licitacao.valor_total_estimado ? formatCurrency(licitacao.valor_total_estimado) : "Valor não informado"}</span>
                    <Link href={`/editais/${licitacao.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">Ver detalhes <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </article>
              ))}

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                  <span>Página {currentPage} de {totalPages}</span>
                  <div className="flex gap-2">
                    <Link href={buildStateUrl(uf, { ...currentFilters, page: currentPage > 1 ? String(currentPage - 1) : undefined })} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${currentPage > 1 ? "border-slate-700 hover:border-slate-500" : "pointer-events-none border-slate-800 text-slate-600"}`}><ArrowLeft className="h-4 w-4" />Anterior</Link>
                    <Link href={buildStateUrl(uf, { ...currentFilters, page: currentPage < totalPages ? String(currentPage + 1) : undefined })} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${currentPage < totalPages ? "border-slate-700 hover:border-slate-500" : "pointer-events-none border-slate-800 text-slate-600"}`}>Próxima<ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-white">Capte esse estado com IA</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Receba alertas, análises e pipeline dos editais mais relevantes da sua região.</p>
            </div>
            <LeadCaptureForm compact sourceSlug={uf.toLowerCase()} sourceUrl={`${APP_URL}/editais/${uf.toLowerCase()}`} />
          </aside>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p></div>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 text-indigo-300">{icon}</div><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-200">{value}</p></div></div>;
}
