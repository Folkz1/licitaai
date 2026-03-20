import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { query, queryOne } from "@/lib/db";
import { normalizePhone } from "@/lib/trial";
import { checkDuplicate, createTrialPresente } from "@/lib/prospeccao";

const MAX_BATCH_SIZE = 200;
const MAX_AUTO_SEND = 10;

interface LeadPayload {
  nome?: string;
  empresa?: string;
  segmento?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

function validateLead(lead: LeadPayload, index: number): string | null {
  if (!lead.nome?.trim()) return `Lead #${index + 1}: campo 'nome' é obrigatório`;
  if (!lead.empresa?.trim()) return `Lead #${index + 1}: campo 'empresa' é obrigatório`;
  if (!lead.telefone?.trim()) return `Lead #${index + 1}: campo 'telefone' é obrigatório`;

  const normalized = normalizePhone(lead.telefone);
  if (!normalized) return `Lead #${index + 1}: telefone inválido (${lead.telefone})`;

  return null;
}

export async function POST(request: Request) {
  try {
    // Auth: SUPER_ADMIN only
    const session = await auth();
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const leads: LeadPayload[] = body.leads;
    const autoSend: boolean = body.autoSend === true;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "Campo 'leads' deve ser um array com pelo menos 1 lead." },
        { status: 400 }
      );
    }

    if (leads.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_BATCH_SIZE} leads por importação.` },
        { status: 400 }
      );
    }

    // Validate all leads first
    const validationErrors: string[] = [];
    for (let i = 0; i < leads.length; i++) {
      const err = validateLead(leads[i], i);
      if (err) validationErrors.push(err);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Erro de validação", details: validationErrors },
        { status: 400 }
      );
    }

    // Process leads: check duplicates and queue
    let imported = 0;
    let duplicates = 0;
    const duplicateDetails: string[] = [];
    const importedLeads: Array<{ id: string; nome: string; empresa: string }> = [];

    for (const lead of leads) {
      const email = (lead.email || "").trim().toLowerCase();
      const telefone = (lead.telefone || "").trim();

      // Check duplicates
      const dupCheck = await checkDuplicate(email || `noemail-${Date.now()}@placeholder.local`, telefone);
      if (dupCheck.isDuplicate) {
        duplicates++;
        duplicateDetails.push(`${lead.nome} (${lead.empresa}): ${dupCheck.reason}`);
        continue;
      }

      // Insert into portal_leads with prospect_status = 'fila'
      const normalizedPhone = normalizePhone(telefone);
      const segmento = (lead.segmento || "").trim();
      const uf = (lead.uf || "").trim().toUpperCase();

      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO portal_leads (
          nome, email, telefone, empresa, interesse, status, score,
          qualification_channel, qualification_data, utm_source, utm_medium,
          source, prospect_status, source_url
        ) VALUES (
          $1, $2, $3, $4, $5, 'novo', 60,
          'prospeccao', $6::jsonb, 'prospeccao', 'batch',
          'prospeccao', 'fila', 'admin://batch-import'
        )
        RETURNING id`,
        [
          (lead.nome || "").trim(),
          email || null,
          normalizedPhone,
          (lead.empresa || "").trim(),
          segmento && uf ? `${segmento} | ${uf}` : segmento || uf || null,
          JSON.stringify({
            segmento: segmento || null,
            uf: uf || null,
            created_by: session?.user?.id || "admin",
            created_at: new Date().toISOString(),
            batch_import: true,
          }),
        ]
      );

      if (inserted) {
        imported++;
        importedLeads.push({
          id: inserted.id,
          nome: (lead.nome || "").trim(),
          empresa: (lead.empresa || "").trim(),
        });
      }
    }

    // If autoSend=true, immediately trigger sending for up to 10 leads
    let sentCount = 0;
    let sendErrors = 0;
    if (autoSend && imported > 0) {
      const toSend = await query<{
        id: string;
        nome: string;
        email: string;
        telefone: string;
        empresa: string;
        qualification_data: Record<string, unknown> | null;
      }>(
        `SELECT id, nome, email, telefone, empresa, qualification_data
         FROM portal_leads
         WHERE source = 'prospeccao'
           AND prospect_status = 'fila'
         ORDER BY created_at ASC
         LIMIT $1`,
        [MAX_AUTO_SEND]
      );

      for (const prospect of toSend) {
        const qualData = prospect.qualification_data || {};
        const segmento = (qualData.segmento as string) || "";
        const uf = (qualData.uf as string) || "";

        if (!prospect.telefone || !prospect.email) {
          // Mark as error if missing critical data
          await query(
            "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
            [prospect.id]
          );
          sendErrors++;
          continue;
        }

        try {
          const result = await createTrialPresente(
            {
              nome: prospect.nome,
              empresa: prospect.empresa,
              segmento,
              uf,
              telefone: prospect.telefone,
              email: prospect.email,
            },
            { createdBy: session?.user?.id || "admin" }
          );

          if (result.success) {
            // createTrialPresente already creates the tenant/user/subscription and sets prospect_status to 'enviado'
            // But we need to delete the original queued lead since createTrialPresente creates a new one
            await query("DELETE FROM portal_leads WHERE id = $1", [prospect.id]);
            sentCount++;
          } else {
            await query(
              "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
              [prospect.id]
            );
            sendErrors++;
          }
        } catch (err) {
          console.error(`[BATCH-IMPORT] Erro ao enviar para ${prospect.nome}:`, err);
          await query(
            "UPDATE portal_leads SET prospect_status = 'erro_envio', updated_at = NOW() WHERE id = $1",
            [prospect.id]
          );
          sendErrors++;
        }

        // Rate limit: 30s between sends
        if (sentCount + sendErrors < toSend.length) {
          await new Promise((r) => setTimeout(r, 30_000));
        }
      }
    }

    // Count remaining in queue
    const remaining = await queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM portal_leads WHERE source = 'prospeccao' AND prospect_status = 'fila'"
    );

    return NextResponse.json({
      imported,
      duplicates,
      duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
      queued: imported - sentCount,
      autoSend: autoSend
        ? { sent: sentCount, failed: sendErrors }
        : undefined,
      remainingInQueue: Number(remaining?.count || 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("[BATCH-IMPORT] Erro:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
