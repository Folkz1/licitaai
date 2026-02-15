'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Sparkles, Check, X } from 'lucide-react';

interface AIGeneratedConfig {
  keywords_inclusao?: string[];
  keywords_exclusao?: string[];
  justificativa?: string;
  [key: string]: unknown;
}

interface Step5RevisaoProps {
  session: {
    id: string;
    step_1_data: Record<string, unknown>;
    step_2_data: Record<string, unknown>;
    step_3_data: Record<string, unknown>;
    step_4_data: Record<string, unknown>;
    ai_generated_config: AIGeneratedConfig;
  } | null;
  onComplete: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const RAMOS_NOMES: Record<string, string> = {
  GRAFICO: 'Gráfica e Comunicação Visual',
  TI: 'Tecnologia da Informação',
  CONSTRUCAO: 'Construção Civil',
  ALIMENTOS: 'Alimentos e Bebidas',
  TRANSPORTE: 'Transporte e Logística',
  SAUDE: 'Saúde e Medicamentos',
  EDUCACAO: 'Educação e Treinamento',
  LIMPEZA: 'Limpeza e Conservação',
  EQUIPAMENTOS: 'Equipamentos e Materiais',
  SERVICOS_GERAIS: 'Serviços Gerais',
  OUTRO: 'Outro',
};

const MODALIDADES_NOMES: Record<number, string> = {
  1: 'Pregão Eletrônico',
  2: 'Concorrência',
  6: 'Dispensa',
  8: 'Credenciamento',
  9: 'Pregão Presencial',
  10: 'RDC',
};

export default function Step5Revisao({
  session,
  onComplete,
  onBack,
}: Step5RevisaoProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIGeneratedConfig | null>(
    session?.ai_generated_config || null
  );
  const [error, setError] = useState<string | null>(null);

  const step1 = session?.step_1_data || {};
  const step2 = session?.step_2_data || {};
  const step3 = session?.step_3_data || {};
  const step4 = session?.step_4_data || {};

  // Gerar configuração com IA
  const generateConfig = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const res = await fetch('/api/onboarding/generate', {
        method: 'POST',
      });
      
      if (!res.ok) {
        throw new Error('Erro ao gerar configuração');
      }
      
      // Tentar parsear como JSON primeiro
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const config = await res.json();
        setAiConfig(config);
      } else {
        // Ler o stream de texto
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value);
        }
        
        // Tentar extrair JSON da resposta
        const jsonMatch = fullText.match(/\{[\s\S]*"keywords_inclusao"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const config = JSON.parse(jsonMatch[0]);
            setAiConfig(config);
          } catch (e) {
            console.error('Erro ao parsear JSON:', e);
            setError('Não foi possível processar a resposta da IA.');
          }
        } else {
          setError('Resposta da IA em formato inesperado.');
        }
      }
    } catch (err) {
      console.error('Erro na geração:', err);
      setError('Não foi possível gerar a configuração. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Completar onboarding
  const handleComplete = async () => {
    setIsCompleting(true);
    
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
      });
      
      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao completar onboarding');
      }
    } catch (err) {
      console.error('Erro ao completar:', err);
      setError('Erro ao completar onboarding. Tente novamente.');
    } finally {
      setIsCompleting(false);
    }
  };

  // Auto-gerar se não tem configuração
  useEffect(() => {
    if (!aiConfig && !isGenerating) {
      generateConfig();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Resumo dos dados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Empresa</h4>
          <p className="text-white font-medium">{String(step1.razao_social || 'Não informado')}</p>
          <p className="text-slate-400 text-sm">{String(step1.porte || '-')} • {String(step1.setor || '-')}</p>
        </div>
        
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Ramo</h4>
          <p className="text-white font-medium">
            {RAMOS_NOMES[(step2.ramo_principal as string)] || 'Não informado'}
          </p>
          <p className="text-slate-400 text-sm">
            {(step2.tipos_clientes as string[])?.join(', ') || '-'}
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Produtos/Serviços</h4>
          <p className="text-white text-sm line-clamp-2">
            {String(step3.produtos_servicos || 'Não informado')}
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Preferências</h4>
          <p className="text-white text-sm">
            {(step4.modalidades as number[])?.map(m => MODALIDADES_NOMES[m]).join(', ') || '-'}
          </p>
          <p className="text-slate-400 text-sm">
            {(step4.ufs_interesse as string[])?.length || 0} UFs • R$ {String(step4.valor_minimo || 0)} - {String(step4.valor_maximo || '∞')}
          </p>
        </div>
      </div>

      {/* Configuração gerada pela IA */}
      <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h4 className="text-white font-medium">Configuração Gerada pela IA</h4>
        </div>
        
        {isGenerating ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Analisando sua empresa e gerando configurações...</span>
          </div>
        ) : aiConfig ? (
          <div className="space-y-4">
            {/* Keywords de Inclusão */}
            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2">
                Keywords de Inclusão ({(aiConfig.keywords_inclusao as string[])?.length || 0})
              </h5>
              <div className="flex flex-wrap gap-1">
                {(aiConfig.keywords_inclusao as string[])?.slice(0, 10).map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs"
                  >
                    {kw}
                  </span>
                ))}
                {(aiConfig.keywords_inclusao as string[])?.length > 10 && (
                  <span className="px-2 py-1 text-slate-400 text-xs">
                    +{(aiConfig.keywords_inclusao as string[]).length - 10} mais
                  </span>
                )}
              </div>
            </div>
            
            {/* Keywords de Exclusão */}
            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2">
                Keywords de Exclusão ({(aiConfig.keywords_exclusao as string[])?.length || 0})
              </h5>
              <div className="flex flex-wrap gap-1">
                {(aiConfig.keywords_exclusao as string[])?.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Justificativa */}
            {aiConfig.justificativa && (
              <p className="text-slate-400 text-sm italic">
                {String(aiConfig.justificativa)}
              </p>
            )}
          </div>
        ) : (
          <div className="text-slate-400">
            <p>Não foi possível gerar a configuração automaticamente.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateConfig}
              className="mt-2 border-slate-600 text-slate-300"
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isGenerating || isCompleting}
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex gap-2">
          {!aiConfig && !isGenerating && (
            <Button
              type="button"
              variant="outline"
              onClick={generateConfig}
              className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/10"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar Configuração
            </Button>
          )}
          
          <Button
            type="button"
            onClick={handleComplete}
            disabled={isGenerating || isCompleting || !aiConfig}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Concluir e Começar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
