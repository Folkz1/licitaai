const N8N_WEBHOOK_BUSCA = process.env.N8N_WEBHOOK_BUSCA_URL!;
const N8N_WEBHOOK_ANALISE = process.env.N8N_WEBHOOK_ANALISE_URL!;
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || "";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function callWebhook(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(N8N_SECRET ? { Authorization: `Bearer ${N8N_SECRET}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n webhook failed (${res.status}): ${text}`);
  }

  return res.json();
}

export interface BuscaConfig {
  ufs?: string[];
  modalidades_contratacao?: string[];
  dias_retroativos?: number;
  valor_minimo?: number;
  valor_maximo?: number;
}

export async function triggerBusca(tenantId: string, executionId?: string, config?: BuscaConfig) {
  return callWebhook(N8N_WEBHOOK_BUSCA, {
    tenant_id: tenantId,
    execution_id: executionId,
    callback_url: `${APP_URL}/api/n8n/callback`,
    progress_url: `${APP_URL}/api/n8n/progress`,
    ...(config?.ufs?.length ? { ufs: config.ufs } : {}),
    ...(config?.modalidades_contratacao?.length ? { modalidades_contratacao: config.modalidades_contratacao } : {}),
    ...(config?.dias_retroativos ? { dias_retroativos: config.dias_retroativos } : {}),
    ...(config?.valor_minimo ? { valor_minimo: config.valor_minimo } : {}),
    ...(config?.valor_maximo ? { valor_maximo: config.valor_maximo } : {}),
  });
}

export async function triggerAnalise(tenantId: string, executionId?: string) {
  return callWebhook(N8N_WEBHOOK_ANALISE, {
    tenant_id: tenantId,
    execution_id: executionId,
    callback_url: `${APP_URL}/api/n8n/callback`,
    progress_url: `${APP_URL}/api/n8n/progress`,
  });
}
