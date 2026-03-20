import Link from "next/link";
import { FileText, Search, LogIn, Zap } from "lucide-react";
import TrackPageView from "@/components/TrackPageView";
import { Suspense } from "react";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Suspense fallback={null}>
        <TrackPageView />
      </Suspense>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              LicitaIA
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link
              href="/editais"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Search className="h-4 w-4" />
              Editais
            </Link>
            <Link
              href="/blog"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/guia/como-participar-de-licitacoes"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Guias
            </Link>
            <Link
              href="/precos"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Preços
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Zap className="h-4 w-4" />
              Testar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white">LicitaIA</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Plataforma de busca e análise inteligente de licitações públicas com IA.
                Monitore oportunidades do PNCP automaticamente.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Portal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/editais" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Buscar Editais
                  </Link>
                </li>
                <li>
                  <Link href="/precos" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Ver Planos
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Acessar Plataforma
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Guias</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/guia/como-participar-de-licitacoes" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Como Participar de Licitações
                  </Link>
                </li>
                <li>
                  <Link href="/guia/como-vender-para-o-governo" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Como Vender para o Governo
                  </Link>
                </li>
                <li>
                  <Link href="/guia/nova-lei-14133-licitacoes" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Nova Lei 14.133
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Produto</h4>
              <ul className="space-y-2">
                <li className="text-sm text-slate-500">Análise automática de editais</li>
                <li className="text-sm text-slate-500">Monitoramento PNCP em tempo real</li>
                <li className="text-sm text-slate-500">Classificação por IA</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-800/60 pt-6 text-center">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} LicitaIA. Dados públicos do Portal Nacional de Contratações Públicas (PNCP).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
