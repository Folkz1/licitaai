import { pool, queryOne } from "@/lib/db";
import {
  buildPncpSlug,
  ensurePortalTenant,
  normalizePortalUf,
  PORTAL_PUBLIC_TENANT_ID,
  PORTAL_UFS,
  syncPortalFlywheelMetrics,
  type PortalUf,
} from "@/lib/portal";

const PNCP_API =
  "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const PNCP_PAGE_SIZE = 50;
const PNCP_REQUEST_DELAY_MS = 550;
const PNCP_MODALIDADE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
];

let lastPncpRequestAt = 0;

interface PncpOrgaoEntidade {
  cnpj: string | null;
  razaoSocial: string | null;
  esferaId: string | null;
}

interface PncpUnidadeOrgao {
  ufNome: string | null;
  ufSigla: string | null;
  municipioNome: string | null;
}

interface PncpPublicacao {
  orgaoEntidade: PncpOrgaoEntidade | null;
  unidadeOrgao: PncpUnidadeOrgao | null;
  anoCompra: number | null;
  sequencialCompra: number | null;
  numeroControlePNCP: string;
  objetoCompra: string | null;
  informacaoComplementar?: string | null;
  valorTotalEstimado: number | null;
  modalidadeId?: number | null;
  modalidadeNome: string | null;
  ufNome?: string | null;
  ufSigla?: string | null;
  municipioNome?: string | null;
  dataPublicacaoPncp: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  linkSistemaOrigem: string | null;
  linkProcesso?: string | null;
  linkProcessoEletronico?: string | null;
  situacaoCompraId: number | null;
  situacaoCompraNome: string | null;
  modoDisputaId?: number | null;
  modoDisputaNome?: string | null;
  srp?: boolean | null;
}

interface PncpPublicacaoResponse {
  data: PncpPublicacao[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  empty?: boolean;
}

interface WorkflowExecutionRow {
  id: string;
}

type WorkflowLogLevel = "info" | "warn" | "error";

export interface PncpScrapeStats {
  executionId?: string;
  dataInicial: string;
  dataFinal: string;
  ufs: PortalUf[];
  requestsMade: number;
  combinationsProcessed: number;
  statesProcessed: number;
  pagesProcessed: number;
  recordsReceived: number;
  recordsUpserted: number;
  errors: number;
  startedAt: string;
  finishedAt?: string;
}

export interface PncpScrapeOptions {
  dataInicial?: string;
  dataFinal?: string;
  uf?: string | null;
  ufs?: string[];
  executionId?: string;
  triggeredBy?: string | null;
  workflowType?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatPncpDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function defaultDateRange(daysBack: number): { dataInicial: string; dataFinal: string } {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);

  return {
    dataInicial: formatPncpDate(start),
    dataFinal: formatPncpDate(end),
  };
}

function assertPncpDate(value: string, field: string): void {
  if (!/^\d{8}$/.test(value)) {
    throw new Error(`${field} deve estar no formato AAAAMMDD.`);
  }
}

function parseRequestedUfs(options: PncpScrapeOptions): PortalUf[] {
  const source = options.ufs?.length
    ? options.ufs
    : options.uf
      ? [options.uf]
      : PORTAL_UFS;

  const normalized = source
    .map((item) => normalizePortalUf(item))
    .filter((item): item is PortalUf => item !== null);

  if (normalized.length === 0) {
    throw new Error("Nenhuma UF válida foi informada para o scraper PNCP.");
  }

  return Array.from(new Set(normalized));
}

function buildWorkflowMetrics(stats: PncpScrapeStats) {
  return {
    data_inicial: stats.dataInicial,
    data_final: stats.dataFinal,
    ufs: stats.ufs,
    requests_made: stats.requestsMade,
    combinations_processed: stats.combinationsProcessed,
    states_processed: stats.statesProcessed,
    pages_processed: stats.pagesProcessed,
    records_received: stats.recordsReceived,
    records_upserted: stats.recordsUpserted,
    errors: stats.errors,
  };
}

async function waitForPncpRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastPncpRequestAt;
  const waitMs = PNCP_REQUEST_DELAY_MS - elapsed;

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastPncpRequestAt = Date.now();
}

async function appendWorkflowLog(
  executionId: string | undefined,
  message: string,
  level: WorkflowLogLevel = "info"
): Promise<void> {
  console.log(`[PNCP-SCRAPER] ${message}`);

  if (!executionId) {
    return;
  }

  const logEntry = JSON.stringify([
    {
      time: new Date().toISOString(),
      level,
      message,
    },
  ]);

  await pool.query(
    `UPDATE workflow_executions
        SET logs = COALESCE(logs, '[]'::jsonb) || $2::jsonb
      WHERE id = $1`,
    [executionId, logEntry]
  );
}

async function updateWorkflowExecution(
  executionId: string | undefined,
  stats: PncpScrapeStats,
  currentStep: string,
  progress: number
): Promise<void> {
  if (!executionId) {
    return;
  }

  await pool.query(
    `UPDATE workflow_executions
        SET progress = $2,
            current_step = $3,
            metrics = $4::jsonb
      WHERE id = $1`,
    [executionId, progress, currentStep, JSON.stringify(buildWorkflowMetrics(stats))]
  );
}

async function markWorkflowError(
  executionId: string | undefined,
  stats: PncpScrapeStats,
  errorMessage: string
): Promise<void> {
  if (!executionId) {
    return;
  }

  await pool.query(
    `UPDATE workflow_executions
        SET status = 'ERROR',
            finished_at = NOW(),
            error_message = $2,
            current_step = 'Erro no scraper PNCP',
            metrics = $3::jsonb
      WHERE id = $1`,
    [executionId, errorMessage, JSON.stringify(buildWorkflowMetrics(stats))]
  );
}

async function markWorkflowSuccess(
  executionId: string | undefined,
  stats: PncpScrapeStats
): Promise<void> {
  if (!executionId) {
    return;
  }

  await pool.query(
    `UPDATE workflow_executions
        SET status = 'SUCCESS',
            finished_at = NOW(),
            progress = 100,
            current_step = 'Scraper PNCP concluído',
            metrics = $2::jsonb
      WHERE id = $1`,
    [executionId, JSON.stringify(buildWorkflowMetrics(stats))]
  );
}

async function fetchPncpPage(params: {
  dataInicial: string;
  dataFinal: string;
  uf: PortalUf;
  modalidadeId: number;
  pagina: number;
}): Promise<PncpPublicacaoResponse> {
  await waitForPncpRateLimit();

  const url = new URL(PNCP_API);
  url.searchParams.set("dataInicial", params.dataInicial);
  url.searchParams.set("dataFinal", params.dataFinal);
  url.searchParams.set("pagina", String(params.pagina));
  url.searchParams.set("tamanhoPagina", String(PNCP_PAGE_SIZE));
  url.searchParams.set(
    "codigoModalidadeContratacao",
    String(params.modalidadeId)
  );
  url.searchParams.set("uf", params.uf);

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(120_000),
  });

  if (response.status === 204) {
    return {
      data: [],
      totalPaginas: 0,
      totalRegistros: 0,
      numeroPagina: params.pagina,
      paginasRestantes: 0,
      empty: true,
    };
  }

  if (!response.ok) {
    throw new Error(
      `PNCP ${response.status} ao buscar ${params.uf}/modalidade ${params.modalidadeId}/página ${params.pagina}: ${await response.text()}`
    );
  }

  return (await response.json()) as PncpPublicacaoResponse;
}

function mapTipoParticipacao(item: PncpPublicacao): string {
  if (item.srp) {
    return "SRP";
  }

  return "AMPLA";
}

function mapPncpRow(item: PncpPublicacao) {
  const objetoCompra =
    item.objetoCompra?.trim() || `Licitacao ${item.numeroControlePNCP}`;
  const dataPublicacao = item.dataPublicacaoPncp || null;

  return {
    tenant_id: PORTAL_PUBLIC_TENANT_ID,
    numero_controle_pncp: item.numeroControlePNCP,
    ano: item.anoCompra,
    sequencial: item.sequencialCompra,
    ano_compra: item.anoCompra,
    sequencial_compra: item.sequencialCompra,
    cnpj_orgao: item.orgaoEntidade?.cnpj || null,
    orgao_nome: item.orgaoEntidade?.razaoSocial || null,
    objeto_compra: objetoCompra,
    informacao_complementar: item.informacaoComplementar || null,
    valor_total_estimado: item.valorTotalEstimado,
    modalidade_contratacao: item.modalidadeNome || null,
    modalidade_codigo: item.modalidadeId || null,
    modo_disputa: item.modoDisputaNome || null,
    modo_disputa_codigo: item.modoDisputaId || null,
    tipo_participacao: mapTipoParticipacao(item),
    valor_confidencial: false,
    data_publicacao: dataPublicacao,
    data_abertura_proposta: item.dataAberturaProposta || null,
    data_encerramento_proposta: item.dataEncerramentoProposta || null,
    uf:
      item.ufSigla ||
      item.unidadeOrgao?.ufSigla ||
      null,
    municipio:
      item.municipioNome ||
      item.unidadeOrgao?.municipioNome ||
      null,
    link_edital_pncp:
      item.linkProcessoEletronico ||
      item.linkProcesso ||
      item.linkSistemaOrigem ||
      null,
    link_sistema_origem: item.linkSistemaOrigem || null,
    status: "NOVA", // PNCP situacaoCompraNome mapped to internal workflow status
    data_coleta: new Date().toISOString(),
    esfera: item.orgaoEntidade?.esferaId || null,
    slug: buildPncpSlug({
      numeroControlePncp: item.numeroControlePNCP,
      objetoCompra,
      dataPublicacao,
    }),
  };
}

async function upsertPncpBatch(items: PncpPublicacao[]): Promise<number> {
  if (items.length === 0) {
    return 0;
  }

  const rows = items.map(mapPncpRow);
  const columns = [
    "tenant_id",
    "numero_controle_pncp",
    "ano",
    "sequencial",
    "ano_compra",
    "sequencial_compra",
    "cnpj_orgao",
    "orgao_nome",
    "objeto_compra",
    "informacao_complementar",
    "valor_total_estimado",
    "modalidade_contratacao",
    "modalidade_codigo",
    "modo_disputa",
    "modo_disputa_codigo",
    "tipo_participacao",
    "valor_confidencial",
    "data_publicacao",
    "data_abertura_proposta",
    "data_encerramento_proposta",
    "uf",
    "municipio",
    "link_edital_pncp",
    "link_sistema_origem",
    "status",
    "data_coleta",
    "esfera",
    "slug",
    "passou_pre_triagem",
  ] as const;

  const values: unknown[] = [];
  const placeholders = rows
    .map((row, rowIndex) => {
      const baseIndex = rowIndex * columns.length;
      values.push(
        row.tenant_id,
        row.numero_controle_pncp,
        row.ano,
        row.sequencial,
        row.ano_compra,
        row.sequencial_compra,
        row.cnpj_orgao,
        row.orgao_nome,
        row.objeto_compra,
        row.informacao_complementar,
        row.valor_total_estimado,
        row.modalidade_contratacao,
        row.modalidade_codigo,
        row.modo_disputa,
        row.modo_disputa_codigo,
        row.tipo_participacao,
        row.valor_confidencial,
        row.data_publicacao,
        row.data_abertura_proposta,
        row.data_encerramento_proposta,
        row.uf,
        row.municipio,
        row.link_edital_pncp,
        row.link_sistema_origem,
        row.status,
        row.data_coleta,
        row.esfera,
        row.slug,
        false
      );

      return `(${columns
        .map((_, columnIndex) => `$${baseIndex + columnIndex + 1}`)
        .join(", ")})`;
    })
    .join(", ");

  const result = await pool.query(
    `INSERT INTO licitacoes (${columns.join(", ")})
     VALUES ${placeholders}
     ON CONFLICT (tenant_id, numero_controle_pncp) DO UPDATE SET
       ano = EXCLUDED.ano,
       sequencial = EXCLUDED.sequencial,
       ano_compra = EXCLUDED.ano_compra,
       sequencial_compra = EXCLUDED.sequencial_compra,
       cnpj_orgao = EXCLUDED.cnpj_orgao,
       orgao_nome = EXCLUDED.orgao_nome,
       objeto_compra = EXCLUDED.objeto_compra,
       informacao_complementar = EXCLUDED.informacao_complementar,
       valor_total_estimado = EXCLUDED.valor_total_estimado,
       modalidade_contratacao = EXCLUDED.modalidade_contratacao,
       modalidade_codigo = EXCLUDED.modalidade_codigo,
       modo_disputa = EXCLUDED.modo_disputa,
       modo_disputa_codigo = EXCLUDED.modo_disputa_codigo,
       tipo_participacao = EXCLUDED.tipo_participacao,
       valor_confidencial = EXCLUDED.valor_confidencial,
       data_publicacao = EXCLUDED.data_publicacao,
       data_abertura_proposta = EXCLUDED.data_abertura_proposta,
       data_encerramento_proposta = EXCLUDED.data_encerramento_proposta,
       uf = EXCLUDED.uf,
       municipio = EXCLUDED.municipio,
       link_edital_pncp = EXCLUDED.link_edital_pncp,
       link_sistema_origem = EXCLUDED.link_sistema_origem,
       status = EXCLUDED.status,
       data_coleta = EXCLUDED.data_coleta,
       esfera = EXCLUDED.esfera,
       slug = COALESCE(licitacoes.slug, EXCLUDED.slug),
       updated_at = NOW()`,
    values
  );

  return result.rowCount ?? items.length;
}

export async function createPncpScrapeExecution(params: {
  dataInicial: string;
  dataFinal: string;
  ufs: PortalUf[];
  triggeredBy?: string | null;
  workflowType?: string;
}): Promise<string> {
  await ensurePortalTenant();

  const execution = await queryOne<WorkflowExecutionRow>(
    `INSERT INTO workflow_executions (
      tenant_id,
      workflow_type,
      status,
      triggered_by,
      current_step,
      metrics,
      logs
    )
    VALUES (
      $1,
      $2,
      'RUNNING',
      $3,
      'Inicializando scraper PNCP...',
      $4::jsonb,
      $5::jsonb
    )
    RETURNING id`,
    [
      PORTAL_PUBLIC_TENANT_ID,
      params.workflowType || "scrape-pncp",
      params.triggeredBy || null,
      JSON.stringify({
        data_inicial: params.dataInicial,
        data_final: params.dataFinal,
        ufs: params.ufs,
      }),
      JSON.stringify([
        {
          time: new Date().toISOString(),
          level: "info",
          message: `Scraper PNCP iniciado para ${params.ufs.join(", ")} (${params.dataInicial} até ${params.dataFinal})`,
        },
      ]),
    ]
  );

  if (!execution?.id) {
    throw new Error("Não foi possível criar a execução do scraper PNCP.");
  }

  return execution.id;
}

export async function scrapeAllStates(
  options: PncpScrapeOptions = {}
): Promise<PncpScrapeStats> {
  const defaults = defaultDateRange(30);
  const dataInicial = options.dataInicial || defaults.dataInicial;
  const dataFinal = options.dataFinal || defaults.dataFinal;
  const ufs = parseRequestedUfs(options);

  assertPncpDate(dataInicial, "dataInicial");
  assertPncpDate(dataFinal, "dataFinal");

  if (dataInicial > dataFinal) {
    throw new Error("dataInicial não pode ser maior que dataFinal.");
  }

  await ensurePortalTenant();

  const executionId =
    options.executionId ||
    (options.workflowType
      ? await createPncpScrapeExecution({
          dataInicial,
          dataFinal,
          ufs,
          triggeredBy: options.triggeredBy,
          workflowType: options.workflowType,
        })
      : undefined);

  const stats: PncpScrapeStats = {
    executionId,
    dataInicial,
    dataFinal,
    ufs,
    requestsMade: 0,
    combinationsProcessed: 0,
    statesProcessed: 0,
    pagesProcessed: 0,
    recordsReceived: 0,
    recordsUpserted: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };

  const totalCombinations = ufs.length * PNCP_MODALIDADE_IDS.length;

  try {
    await appendWorkflowLog(
      executionId,
      `Iniciando varredura massiva do PNCP para ${ufs.length} UFs e ${PNCP_MODALIDADE_IDS.length} modalidades.`
    );

    for (const [stateIndex, uf] of ufs.entries()) {
      await appendWorkflowLog(
        executionId,
        `UF ${uf}: iniciando coleta de ${dataInicial} até ${dataFinal}.`
      );

      for (const modalidadeId of PNCP_MODALIDADE_IDS) {
        const combinationNumber = stats.combinationsProcessed + 1;
        const combinationLabel = `UF ${uf} | modalidade ${modalidadeId}`;

        try {
          await appendWorkflowLog(
            executionId,
            `${combinationLabel}: consultando metadados.`
          );

          const firstPage = await fetchPncpPage({
            dataInicial,
            dataFinal,
            uf,
            modalidadeId,
            pagina: 1,
          });

          stats.requestsMade += 1;
          stats.combinationsProcessed += 1;

          const totalPages =
            firstPage.totalPaginas > 0
              ? firstPage.totalPaginas
              : firstPage.data.length > 0
                ? 1
                : 0;

          if (totalPages === 0) {
            const progress = Math.min(
              99,
              Math.floor((combinationNumber / totalCombinations) * 100)
            );
            await updateWorkflowExecution(
              executionId,
              stats,
              `${combinationLabel}: sem registros`,
              progress
            );
            continue;
          }

          for (let pagina = 1; pagina <= totalPages; pagina += 1) {
            const page =
              pagina === 1
                ? firstPage
                : await fetchPncpPage({
                    dataInicial,
                    dataFinal,
                    uf,
                    modalidadeId,
                    pagina,
                  });

            if (pagina > 1) {
              stats.requestsMade += 1;
            }

            stats.pagesProcessed += 1;
            stats.recordsReceived += page.data.length;
            stats.recordsUpserted += await upsertPncpBatch(page.data);

            const progress = Math.min(
              99,
              Math.floor(
                (((stats.combinationsProcessed - 1) + pagina / totalPages) /
                  totalCombinations) *
                  100
              )
            );

            const stepMessage = `${combinationLabel}: página ${pagina}/${totalPages} (${page.data.length} registros)`;
            await appendWorkflowLog(executionId, stepMessage);
            await updateWorkflowExecution(
              executionId,
              stats,
              stepMessage,
              progress
            );
          }
        } catch (error) {
          stats.errors += 1;
          stats.combinationsProcessed += 1;

          const message =
            error instanceof Error ? error.message : "Erro desconhecido";
          await appendWorkflowLog(
            executionId,
            `${combinationLabel}: falha ao consultar o PNCP. ${message}`,
            "error"
          );
        }
      }

      stats.statesProcessed = stateIndex + 1;
      await updateWorkflowExecution(
        executionId,
        stats,
        `UF ${uf} concluída (${stateIndex + 1}/${ufs.length})`,
        Math.min(
          99,
          Math.floor((stats.combinationsProcessed / totalCombinations) * 100)
        )
      );
    }

    await appendWorkflowLog(
      executionId,
      "Sincronizando métricas de flywheel das licitações públicas."
    );
    await syncPortalFlywheelMetrics();

    stats.finishedAt = new Date().toISOString();
    await markWorkflowSuccess(executionId, stats);

    return stats;
  } catch (error) {
    stats.finishedAt = new Date().toISOString();

    const message =
      error instanceof Error ? error.message : "Erro desconhecido no scraper.";
    await appendWorkflowLog(executionId, message, "error");
    await markWorkflowError(executionId, stats, message);
    throw error;
  }
}

export async function scrapeRecentPncp(
  options: Omit<PncpScrapeOptions, "dataInicial" | "dataFinal"> = {}
): Promise<PncpScrapeStats> {
  const recentRange = defaultDateRange(3);

  return scrapeAllStates({
    ...options,
    dataInicial: recentRange.dataInicial,
    dataFinal: recentRange.dataFinal,
  });
}
