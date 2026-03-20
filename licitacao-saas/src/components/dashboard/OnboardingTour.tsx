"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Kanban,
  Settings,
  BarChart3,
  Zap,
} from "lucide-react";

const STORAGE_KEY = "licitai_tour_completed";

interface TourStep {
  target: string | null; // data-tour attribute value, null = centered modal
  title: string;
  description: string;
  icon: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Bem-vindo ao LicitaIA!",
    description:
      "Vamos fazer um tour rápido pela plataforma para você começar a encontrar licitações do seu segmento. São 6 passos, leva menos de 1 minuto.",
    icon: <Sparkles className="h-6 w-6 text-indigo-400" />,
  },
  {
    target: "kpi-cards",
    title: "Visão geral",
    description:
      "Aqui você vê os números principais: total de licitações capturadas, quantas foram analisadas pela IA, quantas estão no pipeline e o valor total em oportunidades.",
    icon: <BarChart3 className="h-5 w-5 text-indigo-400" />,
    position: "bottom",
  },
  {
    target: "workflow-monitor",
    title: "Busca e análise automática",
    description:
      "A IA busca novas licitações no PNCP e analisa automaticamente. Você pode disparar uma busca manual ou acompanhar o progresso aqui.",
    icon: <Zap className="h-5 w-5 text-emerald-400" />,
    position: "bottom",
  },
  {
    target: "nav-licitacoes",
    title: "Suas licitações",
    description:
      "Todas as licitações capturadas ficam aqui. Filtre por estado, prioridade, valor ou busque por palavras-chave. A IA classifica cada uma como P1, P2 ou P3.",
    icon: <FileText className="h-5 w-5 text-indigo-400" />,
    position: "right",
  },
  {
    target: "nav-pipeline",
    title: "Pipeline de revisão",
    description:
      "Arraste licitações entre fases: Nova, Pré-triagem, Análise, Decisão, Preparação, Participando. Organize seu fluxo como um kanban.",
    icon: <Kanban className="h-5 w-5 text-purple-400" />,
    position: "right",
  },
  {
    target: "nav-configuracoes",
    title: "Configure seu radar",
    description:
      "Defina palavras-chave, estados, modalidades e faixas de valor. A IA usa essas configurações para filtrar e priorizar as licitações certas para você.",
    icon: <Settings className="h-5 w-5 text-amber-400" />,
    position: "right",
  },
  {
    target: null,
    title: "Tudo pronto!",
    description:
      "A IA já está trabalhando para encontrar licitações do seu segmento. Você receberá alertas por WhatsApp quando algo relevante aparecer. Bom uso!",
    icon: <Sparkles className="h-6 w-6 text-emerald-400" />,
  },
];

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay to let dashboard render first
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const updateTargetRect = useCallback(() => {
    const currentStep = TOUR_STEPS[step];
    if (!currentStep?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!active) return;
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [active, step, updateTargetRect]);

  function completeTour() {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    // Also notify the API (fire and forget)
    fetch("/api/user/tour-completed", { method: "POST" }).catch(() => {});
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function skip() {
    completeTour();
  }

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const isCentered = !currentStep.target || !targetRect;

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (!isCentered && targetRect) {
    const pad = 12;
    const pos = currentStep.position || "bottom";
    switch (pos) {
      case "bottom":
        tooltipStyle = {
          position: "fixed",
          top: targetRect.bottom + pad,
          left: Math.max(16, targetRect.left + targetRect.width / 2 - 180),
          zIndex: 10002,
        };
        break;
      case "top":
        tooltipStyle = {
          position: "fixed",
          bottom: window.innerHeight - targetRect.top + pad,
          left: Math.max(16, targetRect.left + targetRect.width / 2 - 180),
          zIndex: 10002,
        };
        break;
      case "right":
        tooltipStyle = {
          position: "fixed",
          top: Math.max(16, targetRect.top + targetRect.height / 2 - 80),
          left: targetRect.right + pad,
          zIndex: 10002,
        };
        break;
      case "left":
        tooltipStyle = {
          position: "fixed",
          top: Math.max(16, targetRect.top + targetRect.height / 2 - 80),
          right: window.innerWidth - targetRect.left + pad,
          zIndex: 10002,
        };
        break;
    }
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[10000] transition-opacity duration-300"
        style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        onClick={skip}
      />

      {/* Spotlight cutout on target element */}
      {!isCentered && targetRect && (
        <div
          className="fixed z-[10001] rounded-xl ring-2 ring-indigo-500/60 ring-offset-2 ring-offset-transparent transition-all duration-300"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip / Modal */}
      {isCentered ? (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl shadow-indigo-500/10">
            <TourContent
              step={currentStep}
              stepNum={step}
              totalSteps={TOUR_STEPS.length}
              isFirst={isFirst}
              isLast={isLast}
              onNext={next}
              onPrev={prev}
              onSkip={skip}
            />
          </div>
        </div>
      ) : (
        <div style={tooltipStyle}>
          <div className="w-[360px] rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl shadow-indigo-500/10">
            <TourContent
              step={currentStep}
              stepNum={step}
              totalSteps={TOUR_STEPS.length}
              isFirst={isFirst}
              isLast={isLast}
              onNext={next}
              onPrev={prev}
              onSkip={skip}
            />
          </div>
        </div>
      )}
    </>
  );
}

function TourContent({
  step,
  stepNum,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepNum: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            {step.icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{step.title}</h3>
            <p className="text-xs text-slate-500">
              {stepNum + 1} de {totalSteps}
            </p>
          </div>
        </div>
        <button
          onClick={onSkip}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          title="Pular tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {step.description}
      </p>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepNum
                ? "w-6 bg-indigo-500"
                : i < stepNum
                ? "w-1.5 bg-indigo-500/40"
                : "w-1.5 bg-slate-700"
            }`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {!isFirst && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          )}
          {isFirst && (
            <button
              onClick={onSkip}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Pular tour
            </button>
          )}
        </div>
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {isLast ? "Começar a usar" : "Próximo"}
          {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </>
  );
}
