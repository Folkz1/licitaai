#!/usr/bin/env node
/**
 * PNCP Backfill Script — Standalone
 * Runs the PNCP scraper for the last N days across all 27 UFs.
 * Usage: DATABASE_URL="postgres://..." node scripts/backfill-pncp.mjs [--days 90] [--uf SP]
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution';

const pool = new Pool({ connectionString: DATABASE_URL });

const PNCP_API = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
const PNCP_PAGE_SIZE = 50;
const PNCP_REQUEST_DELAY_MS = 550;
const PORTAL_TENANT_ID = '00000000-0000-0000-0000-000000000099';
const MODALIDADE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const ALL_UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

let lastRequestAt = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < PNCP_REQUEST_DELAY_MS) {
    await new Promise(r => setTimeout(r, PNCP_REQUEST_DELAY_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

function formatDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function slugify(value, maxLength = 90) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return (normalized || 'licitacao').slice(0, maxLength).replace(/-+$/g, '');
}

function buildSlug(ncp, objeto, dataPub) {
  const d = dataPub ? new Date(dataPub) : new Date();
  const month = isNaN(d.getTime()) ? '0000-00' : d.toISOString().slice(0, 7);
  const obj = slugify(objeto, 80);
  const num = slugify(ncp, 80);
  return `${obj}-${num}-${month}`.slice(0, 180);
}

async function fetchPage(uf, modalidadeId, dataInicial, dataFinal, pagina) {
  await rateLimit();

  const url = new URL(PNCP_API);
  url.searchParams.set('dataInicial', dataInicial);
  url.searchParams.set('dataFinal', dataFinal);
  url.searchParams.set('pagina', String(pagina));
  url.searchParams.set('tamanhoPagina', String(PNCP_PAGE_SIZE));
  url.searchParams.set('codigoModalidadeContratacao', String(modalidadeId));
  url.searchParams.set('uf', uf);

  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  });

  if (res.status === 204) {
    return { data: [], totalPaginas: 0, totalRegistros: 0 };
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PNCP ${res.status} ${uf}/mod${modalidadeId}/p${pagina}: ${txt.slice(0, 200)}`);
  }

  return await res.json();
}

async function upsertBatch(items) {
  if (items.length === 0) return 0;

  const columns = [
    'tenant_id', 'numero_controle_pncp', 'ano_compra', 'sequencial_compra',
    'cnpj_orgao', 'orgao_nome', 'objeto_compra', 'valor_total_estimado',
    'modalidade_contratacao', 'modalidade_codigo',
    'data_publicacao', 'data_abertura_proposta', 'data_encerramento_proposta',
    'uf', 'municipio', 'link_edital_pncp', 'link_sistema_origem',
    'status', 'data_coleta', 'slug', 'passou_pre_triagem',
  ];

  const values = [];
  const placeholders = items.map((item, i) => {
    const obj = item.objetoCompra || '';
    const dataPub = item.dataPublicacaoPncp || null;
    const uf = item.ufSigla || item.unidadeOrgao?.ufSigla || null;
    const mun = item.municipioNome || item.unidadeOrgao?.municipioNome || null;

    values.push(
      PORTAL_TENANT_ID,
      item.numeroControlePNCP,
      item.anoCompra || null,
      item.sequencialCompra || null,
      item.orgaoEntidade?.cnpj || null,
      item.orgaoEntidade?.razaoSocial || null,
      obj,
      item.valorTotalEstimado || null,
      item.modalidadeNome || null,
      item.modalidadeId || null,
      dataPub,
      item.dataAberturaProposta || null,
      item.dataEncerramentoProposta || null,
      uf,
      mun,
      item.linkProcessoEletronico || item.linkProcesso || item.linkSistemaOrigem || null,
      item.linkSistemaOrigem || null,
      'NOVA', // PNCP status mapped to internal workflow status
      new Date().toISOString(),
      buildSlug(item.numeroControlePNCP, obj, dataPub),
      false,
    );

    const base = i * columns.length;
    return `(${columns.map((_, ci) => `$${base + ci + 1}`).join(', ')})`;
  }).join(', ');

  const result = await pool.query(
    `INSERT INTO licitacoes (${columns.join(', ')})
     VALUES ${placeholders}
     ON CONFLICT (tenant_id, numero_controle_pncp) DO UPDATE SET
       ano_compra = EXCLUDED.ano_compra,
       sequencial_compra = EXCLUDED.sequencial_compra,
       cnpj_orgao = EXCLUDED.cnpj_orgao,
       orgao_nome = EXCLUDED.orgao_nome,
       objeto_compra = EXCLUDED.objeto_compra,
       valor_total_estimado = EXCLUDED.valor_total_estimado,
       modalidade_contratacao = EXCLUDED.modalidade_contratacao,
       modalidade_codigo = EXCLUDED.modalidade_codigo,
       data_publicacao = EXCLUDED.data_publicacao,
       data_abertura_proposta = EXCLUDED.data_abertura_proposta,
       data_encerramento_proposta = EXCLUDED.data_encerramento_proposta,
       uf = EXCLUDED.uf,
       municipio = EXCLUDED.municipio,
       link_edital_pncp = EXCLUDED.link_edital_pncp,
       link_sistema_origem = EXCLUDED.link_sistema_origem,
       status = EXCLUDED.status,
       data_coleta = EXCLUDED.data_coleta,
       slug = EXCLUDED.slug
    `,
    values
  );

  return result.rowCount || 0;
}

async function ensurePortalTenant() {
  await pool.query(
    `INSERT INTO tenants (id, nome, slug, segmento, ativo, plano, max_buscas_mes, config, onboarding_completed, ai_config)
     VALUES ($1, 'LicitaIA Portal Público', 'portal-publico', 'Portal Público', TRUE, 'enterprise', 999999, '{"portalPublico": true}'::jsonb, TRUE, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [PORTAL_TENANT_ID]
  );
}

// Parse CLI args
const args = process.argv.slice(2);
let days = 90;
let filterUf = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--days' && args[i + 1]) { days = parseInt(args[i + 1]); i++; }
  if (args[i] === '--uf' && args[i + 1]) { filterUf = args[i + 1].toUpperCase(); i++; }
}

const now = new Date();
const dataFinal = formatDate(now);
const start = new Date(now);
start.setDate(start.getDate() - days);
const dataInicial = formatDate(start);

const ufs = filterUf ? [filterUf] : ALL_UFS;

console.log(`[PNCP-BACKFILL] Período: ${dataInicial} → ${dataFinal} (${days} dias)`);
console.log(`[PNCP-BACKFILL] UFs: ${ufs.join(', ')}`);
console.log(`[PNCP-BACKFILL] Modalidades: ${MODALIDADE_IDS.length}`);

await ensurePortalTenant();

let totalInserted = 0;
let totalFetched = 0;
let totalErrors = 0;

for (const uf of ufs) {
  let ufInserted = 0;

  for (const modId of MODALIDADE_IDS) {
    try {
      // Fetch first page to get total
      const first = await fetchPage(uf, modId, dataInicial, dataFinal, 1);

      if (!first.data || first.data.length === 0) continue;

      const inserted = await upsertBatch(first.data);
      ufInserted += inserted;
      totalFetched += first.data.length;

      const totalPages = first.totalPaginas || 1;

      // Fetch remaining pages
      for (let p = 2; p <= totalPages; p++) {
        try {
          const page = await fetchPage(uf, modId, dataInicial, dataFinal, p);
          if (page.data && page.data.length > 0) {
            const ins = await upsertBatch(page.data);
            ufInserted += ins;
            totalFetched += page.data.length;
          }
        } catch (err) {
          console.error(`[PNCP-BACKFILL] Erro ${uf}/mod${modId}/p${p}: ${err.message}`);
          totalErrors++;
        }
      }

      if (first.totalRegistros > 0) {
        console.log(`[PNCP-BACKFILL] ${uf}/mod${modId}: ${first.totalRegistros} registros, ${totalPages} páginas`);
      }
    } catch (err) {
      console.error(`[PNCP-BACKFILL] Erro ${uf}/mod${modId}: ${err.message}`);
      totalErrors++;
    }
  }

  totalInserted += ufInserted;
  console.log(`[PNCP-BACKFILL] ${uf} concluído: +${ufInserted} inseridos (total acumulado: ${totalInserted})`);
}

// Final count
const { rows } = await pool.query(
  `SELECT COUNT(*)::TEXT as total FROM licitacoes WHERE tenant_id = $1`,
  [PORTAL_TENANT_ID]
);

console.log(`\n[PNCP-BACKFILL] === CONCLUÍDO ===`);
console.log(`[PNCP-BACKFILL] Buscados: ${totalFetched}`);
console.log(`[PNCP-BACKFILL] Inseridos/atualizados: ${totalInserted}`);
console.log(`[PNCP-BACKFILL] Erros: ${totalErrors}`);
console.log(`[PNCP-BACKFILL] Total no portal: ${rows[0]?.total || 0}`);

await pool.end();
process.exit(0);
