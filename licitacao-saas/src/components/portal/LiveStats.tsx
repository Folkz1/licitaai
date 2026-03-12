import { query, queryOne } from "@/lib/db";
import { PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
import { TrendingUp, FileText, Building2, Sparkles } from "lucide-react";

export default async function LiveStats() {
  let stats = { abertas: 0, analisadas: 0, orgaos: 0, ufs: 0 };

  try {
    const row = await queryOne<{
      abertas: string;
      analisadas: string;
      orgaos: string;
      ufs: string;
    }>(
      `SELECT
        COUNT(CASE WHEN data_encerramento_proposta > NOW() THEN 1 END)::TEXT as abertas,
        COUNT(CASE WHEN analysis_count > 0 THEN 1 END)::TEXT as analisadas,
        COUNT(DISTINCT orgao_nome)::TEXT as orgaos,
        COUNT(DISTINCT uf)::TEXT as ufs
       FROM licitacoes
       WHERE tenant_id = $1`,
      [PORTAL_PUBLIC_TENANT_ID]
    );
    if (row) {
      stats = {
        abertas: parseInt(row.abertas),
        analisadas: parseInt(row.analisadas),
        orgaos: parseInt(row.orgaos),
        ufs: parseInt(row.ufs),
      };
    }
  } catch {
    // Fallback to zeros
  }

  const items = [
    {
      icon: <FileText className="h-4 w-4" />,
      value: stats.abertas.toLocaleString("pt-BR"),
      label: "licitações abertas",
      color: "text-emerald-400",
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      value: stats.analisadas.toLocaleString("pt-BR"),
      label: "analisadas por IA",
      color: "text-indigo-400",
    },
    {
      icon: <Building2 className="h-4 w-4" />,
      value: stats.orgaos.toLocaleString("pt-BR"),
      label: "órgãos públicos",
      color: "text-amber-400",
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      value: `${stats.ufs}`,
      label: "estados monitorados",
      color: "text-purple-400",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800/60 bg-gradient-to-r from-slate-900/80 to-slate-950/50 p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className={`${item.color} flex justify-center mb-1`}>{item.icon}</div>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
