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

export async function triggerBusca(tenantId: string, executionId?: string) {
  return callWebhook(N8N_WEBHOOK_BUSCA, {
    tenant_id: tenantId,
    execution_id: executionId,
    callback_url: `${APP_URL}/api/n8n/callback`,
    progress_url: `${APP_URL}/api/n8n/progress`,
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
