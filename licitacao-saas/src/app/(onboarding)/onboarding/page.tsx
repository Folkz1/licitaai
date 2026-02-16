'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, Building2, Briefcase, Package, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Step1Empresa from './components/Step1Empresa';
import Step2Ramo from './components/Step2Ramo';
import Step3Produtos from './components/Step3Produtos';
import Step4Preferencias from './components/Step4Preferencias';
import Step5Revisao from './components/Step5Revisao';

const STEPS = [
  { id: 1, title: 'Sua Empresa', description: 'Dados básicos', icon: Building2 },
  { id: 2, title: 'Ramo de Atuação', description: 'Área de negócio', icon: Briefcase },
  { id: 3, title: 'Produtos e Serviços', description: 'O que você oferece', icon: Package },
  { id: 4, title: 'Preferências', description: 'Filtros de busca', icon: Settings },
  { id: 5, title: 'Revisão', description: 'Confirmar dados', icon: Sparkles },
];

interface OnboardingSession {
  id: string;
  current_step: number;
  step_1_data: Record<string, unknown>;
  step_2_data: Record<string, unknown>;
  step_3_data: Record<string, unknown>;
  step_4_data: Record<string, unknown>;
  step_5_data: Record<string, unknown>;
  ai_generated_config: Record<string, unknown>;
  status: string;
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Buscar sessão existente
  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/onboarding/session');
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        // Se já completou, redirecionar
        if (data.isCompleted) {
          router.push('/dashboard');
          return;
        }
        // Restaurar passo atual
        if (data.session?.current_step) {
          setCurrentStep(Math.max(0, data.session.current_step - 1));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar sessão:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStep = useCallback(async (step: number, data: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/onboarding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setSession(updated.session);
        return true;
      } else {
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar os dados.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Erro ao salvar passo:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const handleNext = async (data: Record<string, unknown>) => {
    const success = await saveStep(currentStep + 1, data);
    if (success && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-slate-400">Carregando...</span>
        </div>
      </div>
    );
  }

  const stepData: Record<number, Record<string, unknown>> = session ? {
    1: session.step_1_data || {},
    2: session.step_2_data || {},
    3: session.step_3_data || {},
    4: session.step_4_data || {},
    5: session.step_5_data || {},
  } : {
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Bem-vindo ao LicitaIA!
          </h1>
          <p className="text-slate-400">
            Vamos configurar sua conta para encontrar as melhores licitações para você.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium hidden sm:block ${
                        isActive ? 'text-indigo-400' : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-12 sm:w-24 h-1 mx-2 rounded-full transition-all ${
                        index < currentStep ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {(() => {
                const StepIcon = STEPS[currentStep].icon;
                return StepIcon ? <StepIcon className="w-5 h-5 text-indigo-400" /> : null;
              })()}
              {STEPS[currentStep].title}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {STEPS[currentStep].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && (
              <Step1Empresa
                data={stepData[1]}
                onNext={handleNext}
                onBack={handleBack}
                isLoading={isSaving}
                isFirstStep={true}
              />
            )}
            {currentStep === 1 && (
              <Step2Ramo
                data={stepData[2]}
                onNext={handleNext}
                onBack={handleBack}
                isLoading={isSaving}
              />
            )}
            {currentStep === 2 && (
              <Step3Produtos
                data={stepData[3]}
                onNext={handleNext}
                onBack={handleBack}
                isLoading={isSaving}
              />
            )}
            {currentStep === 3 && (
              <Step4Preferencias
                data={stepData[4]}
                onNext={handleNext}
                onBack={handleBack}
                isLoading={isSaving}
              />
            )}
            {currentStep === 4 && (
              <Step5Revisao
                session={session}
                onComplete={handleComplete}
                onBack={handleBack}
                isLoading={isSaving}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
