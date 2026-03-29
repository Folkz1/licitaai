import { pool } from "@/lib/db";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://licitai.mbest.site";

export const PORTAL_PUBLIC_TENANT_ID =
  process.env.PORTAL_PUBLIC_TENANT_ID ||
  "00000000-0000-0000-0000-000000000099";

export const PORTAL_PUBLIC_TENANT_SLUG = "portal-publico";

export const UF_NAMES = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
} as const;

export type PortalUf = keyof typeof UF_NAMES;

export const PORTAL_UFS = Object.keys(UF_NAMES) as PortalUf[];

export function normalizePortalUf(value: string | null | undefined): PortalUf | null {
  if (!value) {
    return null;
  }

  const upper = value.trim().toUpperCase();
  return upper in UF_NAMES ? (upper as PortalUf) : null;
}

export function isPortalUfSlug(value: string | null | undefined): boolean {
  return normalizePortalUf(value) !== null;
}

export function slugifySegment(value: string, maxLength = 90): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  const safe = normalized || "licitacao";
  return safe.slice(0, maxLength).replace(/-+$/g, "");
}

export function buildPncpSlug(params: {
  numeroControlePncp: string;
  objetoCompra: string;
  dataPublicacao: string | null;
}): string {
  const publicationDate = params.dataPublicacao
    ? new Date(params.dataPublicacao)
    : new Date();
  const month = Number.isNaN(publicationDate.getTime())
    ? "0000-00"
    : publicationDate.toISOString().slice(0, 7);

  const objeto = slugifySegment(params.objetoCompra, 80);
  const numeroControle = slugifySegment(params.numeroControlePncp, 80);

  return `${objeto}-${numeroControle}-${month}`.slice(0, 180);
}

export async function ensurePortalTenant(): Promise<void> {
  await pool.query(
    `INSERT INTO tenants (
      id,
      nome,
      slug,
      segmento,
      ativo,
      plano,
      max_buscas_mes,
      config,
      onboarding_completed,
      ai_config
    )
    VALUES (
      $1,
      'LicitaIA Portal Público',
      $2,
      'Portal Público',
      TRUE,
      'enterprise',
      999999,
      '{"portalPublico": true}'::jsonb,
      TRUE,
      '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING`,
    [PORTAL_PUBLIC_TENANT_ID, PORTAL_PUBLIC_TENANT_SLUG]
  );
}

export async function syncPortalFlywheelMetrics(
  numeroControlesPncp?: string[]
): Promise<void> {
  const cleanedNumeros =
    numeroControlesPncp?.map((item) => item.trim()).filter(Boolean) ?? [];
  const hasFilter = cleanedNumeros.length > 0;

  const filterClause = hasFilter
    ? "AND l.numero_controle_pncp = ANY($1::text[])"
    : "";
  const params: unknown[] = hasFilter ? [cleanedNumeros] : [];

  await pool.query(
    `WITH scoped_numbers AS (
      SELECT DISTINCT l.numero_controle_pncp
      FROM licitacoes l
      WHERE l.numero_controle_pncp IS NOT NULL
        ${filterClause}
    ),
    aggregated AS (
      SELECT
        l.numero_controle_pncp,
        COUNT(*)::INT AS analysis_count,
        AVG(a.score_relevancia) AS avg_score
      FROM analises a
      JOIN licitacoes l ON l.id = a.licitacao_id
      JOIN subscriptions s
        ON s.tenant_id = l.tenant_id
       AND s.status = 'ACTIVE'
      WHERE l.numero_controle_pncp IS NOT NULL
        ${filterClause}
      GROUP BY l.numero_controle_pncp
    )
    UPDATE licitacoes AS target
       SET analysis_count = COALESCE(aggregated.analysis_count, 0),
           avg_score = aggregated.avg_score,
           updated_at = NOW()
      FROM scoped_numbers
      LEFT JOIN aggregated
        ON aggregated.numero_controle_pncp = scoped_numbers.numero_controle_pncp
     WHERE target.numero_controle_pncp = scoped_numbers.numero_controle_pncp`,
    params
  );
}
