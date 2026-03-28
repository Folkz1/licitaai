import { APP_URL } from "@/lib/portal";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Clock, FileText, Scale, Users } from "lucide-react";

interface GuiaContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  readTime: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: { heading: string; content: string }[];
  cta: string;
}

const GUIAS: Record<string, GuiaContent> = {
  "como-participar-de-licitacoes": {
    title: "Como Participar de Licitações Públicas em 2026",
    metaTitle:
      "Como Participar de Licitações Públicas em 2026 — Guia Completo | LicitaIA",
    metaDescription:
      "Guia completo e atualizado sobre como participar de licitações públicas no Brasil. Requisitos, documentos, passo a passo e dicas para vencer editais do PNCP.",
    readTime: "12 min",
    icon: FileText,
    sections: [
      {
        heading: "O que são licitações públicas?",
        content: `Licitações públicas são processos formais pelos quais órgãos do governo compram produtos e serviços. Toda compra pública acima de um determinado valor precisa passar por licitação — o que cria uma enorme oportunidade para empresas de todos os tamanhos.

Em 2025, o Portal Nacional de Contratações Públicas (PNCP) registrou mais de **R$ 800 bilhões** em compras governamentais. Isso significa que existe um mercado gigante esperando empresas preparadas.

A boa notícia: qualquer empresa pode participar, desde um MEI até uma multinacional. O processo é transparente e regulamentado por lei.`,
      },
      {
        heading: "Quem pode participar?",
        content: `Praticamente qualquer empresa legalizada no Brasil pode participar de licitações. Os requisitos básicos são:

- **CNPJ ativo** — empresa constituída e em situação regular
- **Certidões negativas** — FGTS, INSS, tributos federais, estaduais e municipais
- **Cadastro SICAF** — Sistema de Cadastramento Unificado de Fornecedores (para licitações federais)
- **Capital social compatível** — alguns editais exigem capital mínimo
- **Atestados de capacidade técnica** — comprovação de experiência anterior (nem sempre obrigatório)

**MEI e ME** têm vantagens: licitações até R$ 80 mil são exclusivas para micro e pequenas empresas. Além disso, há uma margem de preferência de até 10% sobre o preço.`,
      },
      {
        heading: "Passo a passo: da busca ao contrato",
        content: `**1. Encontrar editais relevantes**
O primeiro desafio é encontrar licitações no seu segmento. Existem mais de 5.000 órgãos publicando editais diariamente. Ferramentas como o LicitaIA automatizam essa busca e filtram por relevância usando IA.

**2. Ler o edital com atenção**
O edital é o "manual" da licitação. Leia especialmente: objeto (o que estão comprando), requisitos de habilitação, critérios de julgamento e prazos.

**3. Preparar a documentação**
Separe antecipadamente: certidões, contrato social, balanço patrimonial, atestados técnicos. Mantenha uma "pasta de licitações" sempre atualizada.

**4. Elaborar a proposta**
Calcule custos reais, margem de lucro e impostos. Seja competitivo mas realista — preços inexequíveis podem desclassificar sua proposta.

**5. Enviar/participar da sessão**
A maioria das licitações hoje é eletrônica (via Comprasnet, BEC, BLL, etc.). Cadastre-se na plataforma com antecedência.

**6. Acompanhar o resultado**
Acompanhe as fases de habilitação e recursos. Se vencer, prepare-se para assinar o contrato dentro do prazo.`,
      },
      {
        heading: "Modalidades de licitação (Lei 14.133/2021)",
        content: `A Nova Lei de Licitações (14.133/2021) simplificou as modalidades:

- **Pregão Eletrônico** — a mais comum (~70% das licitações). Critério: menor preço ou maior desconto. Sessão online em tempo real.
- **Concorrência** — para contratos de maior valor ou complexidade. Pode usar critério técnico.
- **Concurso** — para seleção de trabalhos técnicos, científicos ou artísticos.
- **Leilão** — para alienação (venda) de bens públicos.
- **Diálogo Competitivo** — nova modalidade para soluções inovadoras sem definição técnica prévia.

A dispensa de licitação (até R$ 50 mil para bens e R$ 100 mil para obras) também é uma oportunidade frequente.`,
      },
      {
        heading: "Erros comuns de iniciantes",
        content: `- **Não ler o edital inteiro** — cada detalhe importa. Uma certidão faltando pode desclassificar.
- **Calcular preço errado** — esquecer impostos, frete, embalagem ou custos operacionais.
- **Deixar para a última hora** — plataformas ficam instáveis próximo ao fechamento.
- **Ignorar impugnações e esclarecimentos** — leia as respostas do órgão, elas podem mudar regras.
- **Desistir no primeiro "não"** — licitação é volume. Uma taxa de 10-20% de sucesso já é excelente.`,
      },
      {
        heading: "Como a IA ajuda no processo",
        content: `A inteligência artificial transforma a forma de participar de licitações:

- **Monitoramento automático** — receba alertas de editais do seu segmento em tempo real
- **Análise de viabilidade** — IA lê o edital e avalia se vale a pena participar
- **Extração de requisitos** — documentos necessários, prazos e condições extraídos automaticamente
- **Histórico de preços** — consulte preços praticados em licitações anteriores
- **Priorização inteligente** — foque nos editais com maior probabilidade de sucesso

O LicitaIA monitora o PNCP diariamente e aplica IA para classificar cada edital por relevância para o seu perfil.`,
      },
    ],
    cta: "Comece a monitorar licitações do seu segmento gratuitamente",
  },

  "como-vender-para-o-governo": {
    title: "Como Vender para o Governo: Guia Prático 2026",
    metaTitle:
      "Como Vender para o Governo — Guia Prático para Empresas | LicitaIA",
    metaDescription:
      "Aprenda como vender produtos e serviços para o governo brasileiro. Cadastro SICAF, documentação, pregão eletrônico e estratégias para vencer licitações.",
    readTime: "10 min",
    icon: Users,
    sections: [
      {
        heading: "Por que vender para o governo?",
        content: `O governo brasileiro é o maior comprador do país. Em 2025, foram mais de **R$ 800 bilhões** em compras públicas — e esse número cresce todo ano.

Vantagens de ter o governo como cliente:

- **Pagamento garantido** — orçamento público é lei, o governo não "quebra"
- **Volume alto** — contratos de fornecimento contínuo (até 5 anos)
- **Diversificação** — reduz dependência de clientes privados
- **Credibilidade** — atender órgão público abre portas no mercado privado
- **Exclusividade para PMEs** — licitações até R$ 80 mil são reservadas para ME/EPP

O mercado público não é só para grandes empresas. MEIs, startups e prestadores de serviço encontram oportunidades todos os dias.`,
      },
      {
        heading: "Cadastro e documentação necessária",
        content: `**Cadastro SICAF (obrigatório para licitações federais)**
Acesse gov.br/sicaf e faça o cadastro com:
- CNPJ e dados da empresa
- Documentos de habilitação jurídica
- Regularidade fiscal (CND federal, estadual, municipal)
- Regularidade trabalhista (CNDT)
- Qualificação econômico-financeira (balanço patrimonial)

**Certificado Digital**
Obrigatório para participar de pregões eletrônicos. Tipo e-CNPJ (A1 ou A3).

**Atestados de Capacidade Técnica**
Peça aos seus clientes atuais! Qualquer contrato cumprido pode virar um atestado. Prefira atestados de órgãos públicos.

**Dica:** mantenha todas as certidões atualizadas permanentemente. Elas vencem — e uma certidão vencida no dia da sessão elimina sua proposta.`,
      },
      {
        heading: "Encontrando oportunidades",
        content: `O governo publica editais em dezenas de plataformas:

- **PNCP** (pncp.gov.br) — portal unificado nacional (obrigatório desde 2024)
- **Comprasnet** — licitações federais
- **BEC/SP** — Bolsa Eletrônica de Compras de SP
- **Licitações-e** (Banco do Brasil) — usado por muitos estados
- **Portais estaduais e municipais** — cada estado tem o seu

**O problema:** são milhares de editais por dia. Ler cada um manualmente é impraticável.

**A solução:** ferramentas como o LicitaIA monitoram todas essas fontes, filtram pelo seu CNAE/segmento e classificam por relevância usando inteligência artificial. Você recebe alertas apenas dos editais que interessam.`,
      },
      {
        heading: "Estratégias para vencer pregões",
        content: `**Pesquise preços praticados**
Consulte o histórico de preços no PNCP e no Painel de Preços (paineldeprecos.planejamento.gov.br). Saiba quanto o governo paga pelo que você vende.

**Calcule seu preço mínimo antes da sessão**
Defina antecipadamente o menor preço viável. No calor do pregão, é fácil se empolgar e dar lances insustentáveis.

**Participe de muitas licitações**
Licitação é jogo de volume. Quanto mais participar, mais aprende e maior a taxa de sucesso.

**Use a margem de preferência (ME/EPP)**
Se você é micro ou pequena empresa, pode cobrir o lance vencedor com até 5% de diferença após a fase de lances.

**Atente aos itens fracionados**
Muitas licitações permitem disputar itens individuais. Foque nos itens onde você é mais competitivo.`,
      },
      {
        heading: "Após vencer: contrato e execução",
        content: `Vencer a licitação é só o começo. A execução do contrato determina se você será chamado novamente:

- **Cumpra prazos rigorosamente** — atrasos geram penalidades e podem impedir futuras participações
- **Entregue exatamente o especificado** — qualquer desvio pode ser motivo de sanção
- **Documente tudo** — notas fiscais, termos de recebimento, e-mails, protocolos
- **Peça atestado ao final** — cada contrato cumprido fortalece seu currículo para próximas licitações
- **Mantenha contato com o fiscal do contrato** — comunicação clara previne problemas`,
      },
    ],
    cta: "Encontre licitações do seu segmento com análise de IA",
  },

  "nova-lei-14133-licitacoes": {
    title: "Nova Lei de Licitações 14.133/2021: O que Mudou na Prática",
    metaTitle:
      "Nova Lei de Licitações 14.133/2021 — O que Mudou | LicitaIA",
    metaDescription:
      "Entenda as principais mudanças da Nova Lei de Licitações (14.133/2021). Modalidades, prazos, pregão eletrônico, dispensa e o que muda para fornecedores.",
    readTime: "15 min",
    icon: Scale,
    sections: [
      {
        heading: "Visão geral da Nova Lei",
        content: `A Lei 14.133/2021 substituiu três leis antigas (8.666/93, 10.520/02 e 12.462/11) e se tornou a única lei de licitações do Brasil a partir de **30 de dezembro de 2023**.

Principais objetivos:
- **Simplificar** — uma lei única em vez de três
- **Digitalizar** — tudo eletrônico, publicação obrigatória no PNCP
- **Combater corrupção** — mais transparência e controle
- **Agilizar** — procedimentos mais rápidos e desburocratizados

Para fornecedores, a mudança traz oportunidades: mais transparência, processos mais previsíveis e novas modalidades como o Diálogo Competitivo.`,
      },
      {
        heading: "Modalidades: o que mudou",
        content: `**Extintas:** Tomada de Preços, Convite e RDC

**Mantidas e atualizadas:**
- **Pregão** — continua como principal modalidade. Agora é preferencialmente eletrônico.
- **Concorrência** — para obras, serviços especiais e critério técnico
- **Leilão** — alienação de bens
- **Concurso** — seleção de trabalhos

**Nova modalidade:**
- **Diálogo Competitivo** — para contratações onde o órgão não sabe exatamente a solução técnica. As empresas participam de diálogos antes da proposta final. Ideal para tecnologia e inovação.

**Dispensa de licitação (novos valores):**
- Bens e serviços: até **R$ 59.906,02** (atualizado anualmente pelo IPCA)
- Obras e serviços de engenharia: até **R$ 119.812,02**`,
      },
      {
        heading: "PNCP: tudo em um só lugar",
        content: `O Portal Nacional de Contratações Públicas (pncp.gov.br) é a maior mudança prática:

- **Publicação obrigatória** — todos os órgãos devem publicar no PNCP
- **Transparência total** — editais, atas, contratos e pagamentos em um só lugar
- **Consulta pública** — qualquer cidadão pode acompanhar
- **API aberta** — permite integração com ferramentas como o LicitaIA

Antes da nova lei, era preciso consultar dezenas de diários oficiais e portais diferentes. Agora, o PNCP centraliza tudo.

O LicitaIA se conecta diretamente à API do PNCP para monitorar novos editais em tempo real e classificá-los por relevância usando inteligência artificial.`,
      },
      {
        heading: "Mudanças na habilitação",
        content: `A nova lei trouxe uma mudança importante: a **inversão de fases**. Agora, a habilitação pode ser feita **depois** da análise de propostas (não antes).

Na prática:
1. Primeiro: abertura e análise de propostas/lances
2. Segundo: habilitação apenas do vencedor
3. Se o vencedor não atender: habilita o segundo colocado

**Vantagens para fornecedores:**
- Menos burocracia inicial — só precisa apresentar documentos se vencer
- Processo mais rápido — menos recursos e impugnações
- Mais empresas participam — a barreira de entrada diminui

**Seguro-garantia:**
A nova lei introduz o seguro-garantia como alternativa à garantia em dinheiro (até 30% do valor do contrato em obras de grande porte).`,
      },
      {
        heading: "Sanções e penalidades",
        content: `A nova lei endureceu as penalidades para empresas que descumprem contratos:

- **Advertência** — para infrações leves
- **Multa** — de até 30% do valor do contrato
- **Impedimento de licitar** — de até 3 anos
- **Declaração de inidoneidade** — de 3 a 6 anos (a mais grave)

**Importante:** as sanções são registradas no **Cadastro Nacional de Empresas Inidôneas e Suspensas (CEIS)** e no SICAF. Uma penalidade em um órgão pode impedir participação em todos os outros.

**Programa de integridade (compliance):**
Empresas com programa de integridade comprovado podem ter atenuação de penalidades. Para contratos acima de R$ 200 milhões, o programa é obrigatório.`,
      },
      {
        heading: "O que muda para micro e pequenas empresas",
        content: `A nova lei manteve e ampliou as vantagens para ME/EPP:

- **Licitações exclusivas** — itens de até R$ 80 mil são disputados apenas por ME/EPP
- **Subcontratação obrigatória** — em contratos grandes, até 25% deve ser subcontratado de ME/EPP
- **Reserva de cota** — em bens de natureza divisível, até 25% pode ser reservado para ME/EPP
- **Margem de preferência** — empate ficto de até 10% sobre o preço da grande empresa
- **Regularização fiscal tardia** — ME/EPP pode regularizar certidões após a sessão (prazo de 5 dias)

Essas vantagens tornam o mercado público especialmente atrativo para pequenas empresas.`,
      },
    ],
    cta: "Monitore licitações da Nova Lei com inteligência artificial",
  },
};

export async function generateStaticParams() {
  return Object.keys(GUIAS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guia = GUIAS[slug];
  if (!guia) return { title: "Guia não encontrado" };

  return {
    title: guia.metaTitle,
    description: guia.metaDescription,
    alternates: { canonical: `${APP_URL}/guia/${slug}` },
    openGraph: {
      title: guia.metaTitle,
      description: guia.metaDescription,
      type: "article",
      url: `${APP_URL}/guia/${slug}`,
    },
  };
}

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guia = GUIAS[slug];
  if (!guia) notFound();

  const Icon = guia.icon;
  const otherGuias = Object.entries(GUIAS).filter(([k]) => k !== slug);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guia.title,
    description: guia.metaDescription,
    author: { "@type": "Organization", name: "LicitaIA" },
    publisher: {
      "@type": "Organization",
      name: "LicitaIA",
      url: APP_URL,
    },
    mainEntityOfPage: `${APP_URL}/guia/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors">
            Início
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/guia/como-participar-de-licitacoes"
            className="hover:text-slate-300 transition-colors"
          >
            Guias
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{guia.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              {guia.readTime} de leitura
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {guia.title}
          </h1>
          <p className="mt-4 text-lg text-slate-400">{guia.metaDescription}</p>
        </header>

        {/* TOC */}
        <nav className="mb-12 rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Neste guia
          </h2>
          <ol className="space-y-2">
            {guia.sections.map((s, i) => (
              <li key={i}>
                <a
                  href={`#section-${i}`}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        {guia.sections.map((section, i) => (
          <section key={i} id={`section-${i}`} className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">
              {section.heading}
            </h2>
            <div className="prose prose-invert prose-slate max-w-none text-slate-300 leading-relaxed">
              {section.content.split("\n\n").map((paragraph, pi) => (
                <p
                  key={pi}
                  className="mb-4"
                  dangerouslySetInnerHTML={{
                    __html: paragraph
                      .replace(
                        /\*\*(.*?)\*\*/g,
                        '<strong class="text-white">$1</strong>'
                      )
                      .replace(/\n- /g, "<br/>• ")
                      .replace(/\n(\d+)\. /g, "<br/>$1. "),
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-8 text-center">
          <BookOpen className="h-10 w-10 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{guia.cta}</h2>
          <p className="text-slate-400 mb-6">
            O LicitaIA monitora o PNCP diariamente e usa IA para encontrar as
            melhores oportunidades para o seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Teste grátis por 7 dias
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/editais"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
            >
              Ver editais abertos
            </Link>
          </div>
        </div>

        {/* Related Guides */}
        <div className="mt-12 border-t border-slate-800/60 pt-12">
          <h2 className="text-lg font-semibold text-white mb-6">
            Outros guias
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {otherGuias.map(([otherSlug, other]) => {
              const OtherIcon = other.icon;
              return (
                <Link
                  key={otherSlug}
                  href={`/guia/${otherSlug}`}
                  className="group rounded-xl border border-slate-800/60 bg-slate-900/50 p-5 hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <OtherIcon className="h-5 w-5 text-indigo-400" />
                    <span className="text-sm text-slate-500">
                      {other.readTime}
                    </span>
                  </div>
                  <h3 className="font-medium text-white group-hover:text-indigo-300 transition-colors">
                    {other.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                    {other.metaDescription}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </article>
    </>
  );
}
