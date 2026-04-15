/**
 * PNCP Search Module - Replaces N8N "Busca PNCP" workflow
 *
 * Flow:
 * 1. Load tenant config (UFs, modalidades, keywords)
 * 2. Build search combinations (UF x modalidade)
 * 3. Call PNCP API with pagination
 * 4. Filter by inclusion/exclusion keywords
 * 5. Upsert into licitacoes table
 */

import { query, queryOne } from "@/lib/db";
import { assertTenantOperationalAccess } from "@/lib/trial";

const PNCP_API = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const PAGE_SIZE = 50; // A API do PNCP retorna "Tamanho de página inválido" acima de 50 na prática
const PAGE_DELAY_MS = 1000; // 1s entre páginas (antes era 500ms — muito rápido para a API gov.br)
const SITUACOES_VALIDAS = [1]; // 1 = Divulgada no PNCP

// --- Types ---

interface BuscaConfig {
  id: string;
  nome: string;
  ufs: string[] | null;
  modalidades_contratacao: number[] | null;
  dias_retroativos: number;
  valor_minimo: number;
  valor_maximo: number | null;
}

interface PalavraChave {
  palavra: string;
  tipo: "INCLUSAO" | "EXCLUSAO";
  variacoes: string[];
}

interface PncpLicitacao {
  numeroControlePNCP: string;
  anoCompra: number;
  sequencialCompra: number;
  objetoCompra: string;
  valorTotalEstimado: number;
  modalidadeNome: string;
  situacaoCompraId: number;
  situacaoCompraNome: string;
  dataPublicacaoPncp: string;
  dataEncerramentoProposta: string | null;
  linkSistemaOrigem: string | null;
  srp: boolean;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: { ufSigla: string; municipioNome: string; nomeUnidade: string };
  informacaoComplementar?: string;
}

interface BuscaStats {
  total_recebidas: number;
  filtradas_situacao: number;
  filtradas_data: number;
  filtradas_palavra: number;
  filtradas_exclusao: number;
  aprovadas: number;
  inseridas: number;
  erros_insert: number;
}

export interface BuscaResult {
  success: boolean;
  stats: BuscaStats;
  error?: string;
}

// --- Helpers ---

function normalize(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function matchKeyword(licitacao: PncpLicitacao, palavra: string): boolean {
  const norm = normalize(palavra);
  const campos = [
    licitacao.objetoCompra,
    licitacao.informacaoComplementar,
    licitacao.orgaoEntidade?.razaoSocial,
    licitacao.unidadeOrgao?.nomeUnidade,
    licitacao.unidadeOrgao?.municipioNome,
  ];

  for (const campo of campos) {
    if (campo && normalize(campo).includes(norm)) return true;
  }

  // Fallback: full JSON search
  return normalize(JSON.stringify(licitacao)).includes(norm);
}

// --- Main Search ---

async function fetchPncpPage(params: {
  dataInicial: string;
  dataFinal: string;
  modalidade: number;
  uf: string | null;
  pagina: number;
}): Promise<{ data: PncpLicitacao[]; totalPaginas: number; totalRegistros: number }> {
  const url = new URL(PNCP_API);
  url.searchParams.set("dataInicial", params.dataInicial);
  url.searchParams.set("dataFinal", params.dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", String(params.modalidade));
  url.searchParams.set("pagina", String(params.pagina));
  url.searchParams.set("tamanhoPagina", String(PAGE_SIZE));
  if (params.uf) url.searchParams.set("uf", params.uf);

  const maxAttempts = 4;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(120000), // 120s igual ao pncp-scraper.ts
      });
      // 204 = sem resultados para esta combinação (modalidade rara / UF sem dados)
      if (res.status === 204) {
        return { data: [], totalPaginas: 0, totalRegistros: 0 };
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : 30000 * attempt; // 30s, 60s, 90s
        const body = await res.text();
        lastErr = new Error(`PNCP API 429: ${body.slice(0, 100)}`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 120000)));
        }
        continue;
      }
      if (res.status >= 500) {
        const body = await res.text();
        throw new Error(`PNCP API ${res.status}: ${body.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(`PNCP API ${res.status}: ${await res.text()}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s for non-429
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function appendLog(executionId: string | undefined, log: { time: string; level: string; message: string; step?: string; data?: Record<string, unknown> }) {
  if (!executionId) return;
  try {
    await query(
      `UPDATE workflow_executions SET logs = COALESCE(logs, '[]'::jsonb) || $2::jsonb WHERE id = $1`,
      [executionId, JSON.stringify([log])]
    );
  } catch { /* never break pipeline */ }
}

export async function executarBusca(
  tenantId: string,
  executionId?: string,
  onProgress?: (msg: string) => Promise<void>
): Promise<BuscaResult> {
  const stats: BuscaStats = {
    total_recebidas: 0,
    filtradas_situacao: 0,
    filtradas_data: 0,
    filtradas_palavra: 0,
    filtradas_exclusao: 0,
    aprovadas: 0,
    inseridas: 0,
    erros_insert: 0,
  };

  try {
    await assertTenantOperationalAccess(tenantId, "search");

    // 1. Load config
    const config = await queryOne<BuscaConfig>(
      `SELECT id, nome, ufs, modalidades_contratacao,
              COALESCE(dias_retroativos, 8) as dias_retroativos,
              COALESCE(valor_minimo, 0) as valor_minimo,
              valor_maximo
       FROM configuracoes_busca
       WHERE tenant_id = $1 AND ativa = TRUE
       LIMIT 1`,
      [tenantId]
    );

    if (!config) {
      return { success: false, stats, error: "Nenhuma configuracao de busca ativa" };
    }

    // 2. Load keywords
    const keywords = await query<PalavraChave>(
      `SELECT palavra, tipo, variacoes
       FROM palavras_chave
       WHERE tenant_id = $1 AND ativa = TRUE
       ORDER BY tipo, peso DESC`,
      [tenantId]
    );

    const inclusao = keywords.filter((k) => k.tipo === "INCLUSAO").map((k) => k.palavra);
    const exclusao = keywords
      .filter((k) => k.tipo === "EXCLUSAO")
      .flatMap((k) => [k.palavra, ...(k.variacoes || [])]);

    // 3. Build search combinations
    const ufs = config.ufs?.length ? config.ufs : [null];
    const modalidades = config.modalidades_contratacao?.length ? config.modalidades_contratacao : [6, 8];
    const now = new Date();

    // Fatiar em janelas de 2 dias para evitar timeouts da API do PNCP com datasets grandes
    // Ex: 30 dias → 15 janelas de 2 dias. Cada janela retorna ~400-600 registros (manejável)
    const WINDOW_DAYS = 2;
    const dateWindows: { dataInicial: string; dataFinal: string }[] = [];
    for (let offset = 0; offset < config.dias_retroativos; offset += WINDOW_DAYS) {
      const windowEnd = new Date(now.getTime() - offset * 86400000);
      const windowStart = new Date(now.getTime() - Math.min(offset + WINDOW_DAYS, config.dias_retroativos) * 86400000);
      dateWindows.push({ dataInicial: formatDate(windowStart), dataFinal: formatDate(windowEnd) });
    }

    await onProgress?.(`Buscando PNCP: ${ufs.length} UFs x ${modalidades.length} modalidades x ${dateWindows.length} janelas de ${WINDOW_DAYS}d`);
    await appendLog(executionId, {
      time: new Date().toISOString(), level: "info", step: "busca_config",
      message: `Config: ${config.nome} | ${ufs.length} UFs x ${modalidades.length} modalidades | ${config.dias_retroativos} dias (${dateWindows.length} janelas de ${WINDOW_DAYS}d) | Valor min: ${config.valor_minimo}`,
      data: { config_id: config.id, config_nome: config.nome, ufs, modalidades, dias_retroativos: config.dias_retroativos, window_days: WINDOW_DAYS, windows: dateWindows.length, inclusao_count: inclusao.length, exclusao_count: exclusao.length, inclusao_keywords: inclusao, exclusao_keywords: exclusao },
    });

    // 4. For each UF x modalidade x janela de data, fetch all pages
    for (const uf of ufs) {
      for (const mod of modalidades) {
        for (const window of dateWindows) {
        const { dataInicial, dataFinal } = window;
        try {
          // First call to get metadata
          const meta = await fetchPncpPage({ dataInicial, dataFinal, modalidade: mod, uf, pagina: 1 });
          const totalPaginas = meta.totalPaginas || 1;

          if (meta.totalRegistros > 0) {
            await onProgress?.(`UF=${uf || "BR"} mod=${mod} ${dataInicial}-${dataFinal}: ${meta.totalRegistros} resultados, ${totalPaginas} paginas`);
          }

          // Process all pages (1s throttle between pages to avoid 429)
          for (let pagina = 1; pagina <= totalPaginas; pagina++) {
            if (pagina > 1) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
            const page = pagina === 1 ? meta : await fetchPncpPage({ dataInicial, dataFinal, modalidade: mod, uf, pagina });
            if (!Array.isArray(page.data)) continue;

            for (const lic of page.data) {
              stats.total_recebidas++;

              // Filter: situacao
              if (!SITUACOES_VALIDAS.includes(lic.situacaoCompraId)) {
                stats.filtradas_situacao++;
                continue;
              }

              // Filter: encerramento no futuro
              if (lic.dataEncerramentoProposta) {
                const enc = new Date(lic.dataEncerramentoProposta);
                if (enc < now) {
                  stats.filtradas_data++;
                  continue;
                }
              }

              // Filter: inclusion keywords (OR)
              if (inclusao.length > 0) {
                const match = inclusao.some((p) => matchKeyword(lic, p));
                if (!match) {
                  stats.filtradas_palavra++;
                  continue;
                }
              }

              // Filter: exclusion keywords (OR)
              if (exclusao.length > 0) {
                const excluded = exclusao.some((p) => matchKeyword(lic, p));
                if (excluded) {
                  stats.filtradas_exclusao++;
                  continue;
                }
              }

              stats.aprovadas++;

              // 5. Upsert
              const ufLic = lic.unidadeOrgao?.ufSigla || "";
              let tipoParticipacao = "AMPLA";
              if (lic.srp) tipoParticipacao = "SRP";
              if (lic.modalidadeNome && normalize(lic.modalidadeNome).includes("me/epp")) tipoParticipacao = "ME/EPP";

              try {
                await query(
                  `INSERT INTO licitacoes (
                    tenant_id, numero_controle_pncp, ano_compra, sequencial_compra,
                    cnpj_orgao, orgao_nome, objeto_compra, valor_total_estimado,
                    modalidade_contratacao, tipo_participacao, data_publicacao,
                    data_encerramento_proposta, uf, municipio, link_sistema_origem,
                    passou_pre_triagem, status
                  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,'NOVA')
                  ON CONFLICT (tenant_id, numero_controle_pncp) DO UPDATE SET
                    ano_compra = EXCLUDED.ano_compra,
                    sequencial_compra = EXCLUDED.sequencial_compra,
                    cnpj_orgao = EXCLUDED.cnpj_orgao,
                    orgao_nome = EXCLUDED.orgao_nome,
                    objeto_compra = EXCLUDED.objeto_compra,
                    valor_total_estimado = EXCLUDED.valor_total_estimado,
                    modalidade_contratacao = EXCLUDED.modalidade_contratacao,
                    tipo_participacao = EXCLUDED.tipo_participacao,
                    data_publicacao = EXCLUDED.data_publicacao,
                    data_encerramento_proposta = EXCLUDED.data_encerramento_proposta,
                    uf = EXCLUDED.uf,
                    municipio = EXCLUDED.municipio,
                    link_sistema_origem = EXCLUDED.link_sistema_origem,
                    passou_pre_triagem = EXCLUDED.passou_pre_triagem`,
                  [
                    tenantId,
                    lic.numeroControlePNCP,
                    lic.anoCompra || null,
                    lic.sequencialCompra || null,
                    lic.orgaoEntidade?.cnpj,
                    lic.orgaoEntidade?.razaoSocial,
                    lic.objetoCompra,
                    lic.valorTotalEstimado || 0,
                    lic.modalidadeNome,
                    tipoParticipacao,
                    lic.dataPublicacaoPncp,
                    lic.dataEncerramentoProposta || null,
                    ufLic,
                    lic.unidadeOrgao?.municipioNome,
                    lic.linkSistemaOrigem || null,
                  ]
                );
                stats.inseridas++;
              } catch (insertErr) {
                stats.erros_insert++;
                const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
                console.error(`[BUSCA] Insert error for ${lic.numeroControlePNCP}:`, errMsg);
                await appendLog(executionId, {
                  time: new Date().toISOString(), level: "error", step: "insert_licitacao",
                  message: `Insert falhou: ${lic.numeroControlePNCP} - ${errMsg.slice(0, 200)}`,
                  data: { ncp: lic.numeroControlePNCP, objeto: lic.objetoCompra?.slice(0, 100), error: errMsg.slice(0, 300) },
                });
              }
            }

          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await onProgress?.(`Erro UF=${uf || "BR"} mod=${mod} ${dataInicial}-${dataFinal}: ${msg}`);
          await appendLog(executionId, {
            time: new Date().toISOString(), level: "error", step: "busca_combinacao",
            message: `Erro UF=${uf || "BR"} mod=${mod} ${dataInicial}-${dataFinal}: ${msg.slice(0, 200)}`,
            data: { uf: uf || "BR", modalidade: mod, dataInicial, dataFinal, error: msg.slice(0, 300) },
          });
        }
        } // end for window
      }
    }

    // 6. Generate slugs for new licitacoes
    await query(
      `UPDATE licitacoes
       SET slug = LOWER(
         REGEXP_REPLACE(
           CONCAT(
             COALESCE(uf, 'br'), '-',
             LEFT(REGEXP_REPLACE(COALESCE(orgao_nome, 'orgao'), '[^a-zA-Z0-9 ]', '', 'g'), 40), '-',
             id::TEXT, '-',
             TO_CHAR(COALESCE(data_publicacao, NOW()), 'YYYY-MM')
           ),
           '[^a-z0-9]+', '-', 'g'
         )
       ),
       updated_at = NOW()
       WHERE tenant_id = $1 AND slug IS NULL`,
      [tenantId]
    );

    // 7. Update execution
    if (executionId) {
      await query(
        `UPDATE workflow_executions SET
          status = 'SUCCESS', finished_at = NOW(), progress = 100,
          current_step = 'Busca concluida',
          metrics = $2::jsonb,
          logs = COALESCE(logs, '[]'::jsonb) || $3::jsonb
        WHERE id = $1`,
        [
          executionId,
          JSON.stringify(stats),
          JSON.stringify([{ time: new Date().toISOString(), message: `Busca: ${stats.aprovadas} aprovadas de ${stats.total_recebidas}`, level: "info" }]),
        ]
      );
    }

    return { success: true, stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";

    if (executionId) {
      await query(
        `UPDATE workflow_executions SET status = 'ERROR', finished_at = NOW(),
          current_step = $2,
          logs = COALESCE(logs, '[]'::jsonb) || $3::jsonb
        WHERE id = $1`,
        [
          executionId,
          `Erro: ${msg.slice(0, 200)}`,
          JSON.stringify([{ time: new Date().toISOString(), message: msg, level: "error" }]),
        ]
      );
    }

    return { success: false, stats, error: msg };
  }
}
