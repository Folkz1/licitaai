"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  ArrowLeft,
  CheckCircle,
  XCircle,
  MessageSquare,
  Send,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  Copy,
  Clock,
  Brain,
  Download,
  Globe,
} from "lucide-react";
import Link from "next/link";

interface LicitacaoDetail {
  id: string;
  numero_controle_pncp: string;
  orgao_nome: string;
  objeto_compra: string;
  valor_total_estimado: number;
  modalidade_contratacao: string;
  tipo_participacao: string;
  data_publicacao: string;
  data_encerramento_proposta: string;
  uf: string;
  municipio: string;
  link_sistema_origem: string;
  status: string;
  review_phase: string;
  review_notes: string;
}

interface Analise {
  prioridade: string;
  justificativa: string;
  score_relevancia: number;
  valor_itens_relevantes: number;
  amostra_exigida: boolean;
  documentos_necessarios: string;
  prazos: string;
  requisitos_tecnicos: string;
  analise_riscos: string;
  preferencias_me_epp: string;
  garantias: string;
  forma_fornecimento: string;
  campos_customizados: Record<string, unknown>;
}

interface Item {
  numero_item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  e_produto_grafico: boolean;
  tipo_produto: string;
  confianca_classificacao: number;
  item_exclusivo_me_epp: boolean;
}

interface ReviewAction {
  id: string;
  action: string;
  from_phase: string;
  to_phase: string;
  note: string;
  created_at: string;
  user_name: string;
}

const PHASES = ["NOVA", "PRE_TRIAGEM", "ANALISE", "DECISAO", "PREPARACAO", "PARTICIPANDO", "CONCLUIDA"];

function formatCurrency(v: number) {
  if (!v) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function parseJson(str: string) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

function buildPncpUrl(ncp: string) {
  if (!ncp) return null;
  return `https://pncp.gov.br/app/editais/${encodeURIComponent(ncp)}`;
}

function getPortalName(url: string) {
  if (!url || url === "null") return null;
  try {
    const host = new URL(url).hostname.replace("www.", "");
    if (host.includes("comprasnet")) return "ComprasNet";
    if (host.includes("licitanet")) return "Licitanet";
    if (host.includes("licitar")) return "Licitar";
    if (host.includes("compras") && host.includes("publica")) return "Compras Publicas";
    if (host.includes("bll")) return "BLL";
    if (host.includes("bec.sp")) return "BEC/SP";
    return host.split(".")[0];
  } catch { return null; }
}

function buildEditalDownloadUrl(ncp: string) {
  if (!ncp) return null;
  return `https://pncp.gov.br/api/pncp/v1/orgaos/${ncp.split("-")[0]}/compras/${ncp}/arquivos`;
}

export default function LicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lic, setLic] = useState<LicitacaoDetail | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [history, setHistory] = useState<ReviewAction[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchDetail();
    fetchHistory();
  }, [id]);

  async function fetchDetail() {
    setLoading(true);
    const res = await fetch(`/api/licitacoes/${id}`);
    const data = await res.json();
    setLic(data.licitacao);
    setAnalise(data.analise);
    setItens(data.itens || []);
    setLoading(false);
  }

  async function fetchHistory() {
    const res = await fetch(`/api/licitacoes/${id}/notes`);
    const data = await res.json();
    setHistory(data);
  }

  async function handleAction(action: string, toPhase?: string) {
    await fetch(`/api/licitacoes/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, toPhase }),
    });
    fetchDetail();
    fetchHistory();
  }

  async function handleNote() {
    if (!newNote.trim()) return;
    await fetch(`/api/licitacoes/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote }),
    });
    setNewNote("");
    fetchHistory();
  }

  if (loading || !lic) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const currentPhaseIdx = PHASES.indexOf(lic.review_phase);
  const nextPhase = currentPhaseIdx < PHASES.length - 1 ? PHASES[currentPhaseIdx + 1] : null;

  function copyToClipboard(text: string, label: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/licitacoes" className="flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex gap-2">
          {nextPhase && (
            <Button
              onClick={() => handleAction("ADVANCE", nextPhase)}
              className="bg-green-600 hover:bg-green-500"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Avancar para {nextPhase}
            </Button>
          )}
          {lic.review_phase !== "REJEITADA" && (
            <Button
              onClick={() => handleAction("REJECT", "REJEITADA")}
              variant="outline"
              className="border-red-700 text-red-400 hover:bg-red-900/30"
            >
              <XCircle className="mr-2 h-4 w-4" /> Rejeitar
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={analise?.prioridade === "P1" ? "destructive" : analise?.prioridade === "P2" ? "default" : "secondary"}>
                  {analise?.prioridade || "N/A"}
                </Badge>
                <Badge variant="outline">{lic.review_phase}</Badge>
                <Badge variant="outline">{lic.status}</Badge>
              </div>
              <h1 className="text-lg font-semibold text-white">{lic.objeto_compra}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" /> {lic.orgao_nome}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {lic.municipio}/{lic.uf}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Encerra: {formatDate(lic.data_encerramento_proposta)}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> {formatCurrency(lic.valor_total_estimado)}
                </span>
              </div>
              {/* Portal */}
              {getPortalName(lic.link_sistema_origem) && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <Globe className="h-4 w-4" /> Portal: <span className="text-white">{getPortalName(lic.link_sistema_origem)}</span>
                </span>
              )}
              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-2">
                {lic.numero_controle_pncp && buildPncpUrl(lic.numero_controle_pncp) && (
                  <a
                    href={buildPncpUrl(lic.numero_controle_pncp)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 px-3 py-1.5 text-sm text-indigo-400 hover:bg-indigo-600/20 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver no PNCP
                  </a>
                )}
                {lic.link_sistema_origem && lic.link_sistema_origem !== "null" && (
                  <a
                    href={lic.link_sistema_origem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-600/20 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {getPortalName(lic.link_sistema_origem) || "Portal de Origem"}
                  </a>
                )}
                {lic.numero_controle_pncp && (
                  <a
                    href={buildEditalDownloadUrl(lic.numero_controle_pncp)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600/10 border border-amber-500/30 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-600/20 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Edital / Anexos
                  </a>
                )}
                {lic.numero_controle_pncp && (
                  <button
                    onClick={() => copyToClipboard(buildPncpUrl(lic.numero_controle_pncp)!, "pncp")}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === "pncp" ? "Copiado!" : "Copiar link"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="analise" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="analise">Analise IA</TabsTrigger>
          <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
          <TabsTrigger value="historico">Historico</TabsTrigger>
        </TabsList>

        {/* Analysis Tab */}
        <TabsContent value="analise" className="space-y-4">
          {analise ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                    <Brain className="h-4 w-4 text-indigo-400" /> Justificativa da Análise IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 leading-relaxed">{analise.justificativa}</p>
                  {analise.amostra_exigida && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-900/20 p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-sm text-amber-300">Amostra exigida</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-sm text-slate-300">Valores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Valor Total</span>
                    <span className="text-white">{formatCurrency(lic.valor_total_estimado)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Itens Relevantes</span>
                    <span className="text-emerald-400">{formatCurrency(analise.valor_itens_relevantes)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Score</span>
                    <span className="text-white">{analise.score_relevancia}%</span>
                  </div>
                </CardContent>
              </Card>

              {analise.documentos_necessarios && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                      <FileText className="h-4 w-4" /> Documentos Necessarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                      {(Array.isArray(parseJson(analise.documentos_necessarios))
                        ? parseJson(analise.documentos_necessarios)
                        : [analise.documentos_necessarios]
                      ).map((doc: string, i: number) => (
                        <li key={i}>{doc}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {analise.prazos && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="h-4 w-4 text-amber-400" /> Prazos Importantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.prazos);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      if (Array.isArray(parsed)) {
                        return (
                          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                            {parsed.map((item: string, i: number) => <li key={i}>{item}</li>)}
                          </ul>
                        );
                      }
                      return <p className="text-sm text-slate-300">{analise.prazos}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.requisitos_tecnicos && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Requisitos Técnicos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.requisitos_tecnicos);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      if (Array.isArray(parsed)) {
                        return (
                          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                            {parsed.map((item: string, i: number) => <li key={i}>{String(item)}</li>)}
                          </ul>
                        );
                      }
                      return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{String(parsed)}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.analise_riscos && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                      <AlertTriangle className="h-4 w-4 text-red-400" /> Análise de Riscos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.analise_riscos);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{String(parsed)}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.garantias && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Garantias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.garantias);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-slate-300">{analise.garantias}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.preferencias_me_epp && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Preferências ME/EPP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.preferencias_me_epp);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-slate-300 leading-relaxed">{String(parsed)}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.forma_fornecimento && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Forma de Fornecimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const parsed = parseJson(analise.forma_fornecimento);
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(parsed).map(([key, value]) => (
                              <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-400">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                <span className="text-sm text-white">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-slate-300 leading-relaxed">{String(parsed)}</p>;
                    })()}
                  </CardContent>
                </Card>
              )}

              {analise.campos_customizados && Object.keys(analise.campos_customizados).length > 0 && (
                <Card className="border-slate-800 bg-slate-900/50 md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                      <FileText className="h-4 w-4 text-cyan-400" /> Dados Específicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                      {Object.entries(analise.campos_customizados).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center rounded-lg bg-slate-800/50 px-3 py-2">
                          <span className="text-sm font-medium text-slate-400">
                            {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                          <span className="text-sm text-white">
                            {Array.isArray(value) ? (value as string[]).join(", ") : String(value ?? "-")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="py-10 text-center text-slate-400">
                Nenhuma analise disponivel. Clique em &quot;Analisar Pendentes&quot; no dashboard.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="itens">
          <Card className="border-slate-800 bg-slate-900/50">
            {itens.length === 0 ? (
              <CardContent className="py-10 text-center text-slate-400">
                Nenhum item extraido.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">#</TableHead>
                    <TableHead className="text-slate-400">Descricao</TableHead>
                    <TableHead className="text-slate-400">Qtd</TableHead>
                    <TableHead className="text-slate-400">Valor Unit.</TableHead>
                    <TableHead className="text-slate-400">Total</TableHead>
                    <TableHead className="text-slate-400">Tipo</TableHead>
                    <TableHead className="text-slate-400">Confianca</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, i) => (
                    <TableRow key={i} className={`border-slate-800 ${item.e_produto_grafico ? "bg-emerald-900/10" : ""}`}>
                      <TableCell className="text-slate-400">{item.numero_item}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-slate-300">
                        {item.descricao}
                        {item.item_exclusivo_me_epp && (
                          <Badge className="ml-2" variant="secondary">ME/EPP</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">{item.quantidade} {item.unidade}</TableCell>
                      <TableCell className="text-sm text-slate-300">{formatCurrency(item.valor_unitario)}</TableCell>
                      <TableCell className="text-sm text-slate-300">{formatCurrency(item.valor_total)}</TableCell>
                      <TableCell>
                        {item.e_produto_grafico ? (
                          <Badge className="bg-emerald-600">{item.tipo_produto || "Grafico"}</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.confianca_classificacao > 80 ? "default" : "outline"}>
                          {item.confianca_classificacao}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="historico" className="space-y-4">
          {/* Add Note */}
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="flex gap-2 pt-4">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Adicionar nota..."
                className="border-slate-700 bg-slate-800 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleNote()}
              />
              <Button onClick={handleNote} className="bg-indigo-600 hover:bg-indigo-500">
                <Send className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* History List */}
          {history.map((action) => (
            <Card key={action.id} className="border-slate-800 bg-slate-900/50">
              <CardContent className="flex items-start gap-3 pt-4">
                <MessageSquare className="mt-1 h-4 w-4 text-slate-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-300">{action.user_name || "Sistema"}</span>
                    <Badge variant="outline" className="text-xs">{action.action}</Badge>
                    {action.from_phase !== action.to_phase && (
                      <span className="text-xs text-slate-500">
                        {action.from_phase} → {action.to_phase}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(action.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {action.note && <p className="mt-1 text-sm text-slate-400">{action.note}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
