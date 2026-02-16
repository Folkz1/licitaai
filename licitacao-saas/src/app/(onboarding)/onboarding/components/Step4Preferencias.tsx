'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

interface Step4PreferenciasProps {
  data: Record<string, unknown>;
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  isLoading: boolean;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const MODALIDADES = [
  { value: 1, label: 'Pregão Eletrônico', description: 'Modalidade mais comum' },
  { value: 2, label: 'Concorrência', description: 'Grandes valores' },
  { value: 6, label: 'Dispensa de Licitação', description: 'Valores menores' },
  { value: 8, label: 'Credenciamento', description: 'Serviços contínuos' },
  { value: 9, label: 'Pregão Presencial', description: 'Menos comum' },
  { value: 10, label: 'RDC', description: 'Regime Diferenciado' },
];

export default function Step4Preferencias({
  data,
  onNext,
  onBack,
  isLoading,
}: Step4PreferenciasProps) {
  const [formData, setFormData] = useState({
    ufs_interesse: (data?.ufs_interesse as string[]) || [],
    modalidades: (data?.modalidades as number[]) || [1, 6],
    valor_minimo: (data?.valor_minimo as number) || 0,
    valor_maximo: (data?.valor_maximo as number) || null,
    dias_retroativos: (data?.dias_retroativos as number) || 15,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (formData.modalidades.length === 0) {
      newErrors.modalidades = 'Selecione pelo menos uma modalidade';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      onNext(formData);
    }
  };

  const toggleUf = (uf: string) => {
    setFormData(prev => ({
      ...prev,
      ufs_interesse: prev.ufs_interesse.includes(uf)
        ? prev.ufs_interesse.filter(u => u !== uf)
        : [...prev.ufs_interesse, uf]
    }));
  };

  const toggleModalidade = (value: number) => {
    setFormData(prev => ({
      ...prev,
      modalidades: prev.modalidades.includes(value)
        ? prev.modalidades.filter(m => m !== value)
        : [...prev.modalidades, value]
    }));
  };

  const selectAllUfs = () => {
    setFormData(prev => ({
      ...prev,
      ufs_interesse: prev.ufs_interesse.length === UFS.length ? [] : [...UFS]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">Estados de Interesse</Label>
          <button
            type="button"
            onClick={selectAllUfs}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            {formData.ufs_interesse.length === UFS.length ? 'Limpar seleção' : 'Selecionar todos'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {UFS.map((uf) => (
            <button
              key={uf}
              type="button"
              onClick={() => toggleUf(uf)}
              className={`w-10 h-10 rounded-md text-sm font-medium transition-all ${
                formData.ufs_interesse.includes(uf)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {uf}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-sm">
          {formData.ufs_interesse.length === 0
            ? 'Nenhum selecionado = buscar em todos os estados'
            : `${formData.ufs_interesse.length} estado(s) selecionado(s)`}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">Modalidades de Interesse *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODALIDADES.map((mod) => (
            <button
              key={mod.value}
              type="button"
              onClick={() => toggleModalidade(mod.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                formData.modalidades.includes(mod.value)
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
              }`}
            >
              <p className="font-medium">{mod.label}</p>
              <p className="text-sm text-slate-400">{mod.description}</p>
            </button>
          ))}
        </div>
        {errors.modalidades && (
          <span className="text-red-400 text-sm">{errors.modalidades}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valor_minimo" className="text-slate-300">
            Valor Mínimo (R$)
          </Label>
          <input
            id="valor_minimo"
            type="number"
            value={formData.valor_minimo || ''}
            onChange={(e) => setFormData({ ...formData, valor_minimo: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor_maximo" className="text-slate-300">
            Valor Máximo (R$)
          </Label>
          <input
            id="valor_maximo"
            type="number"
            value={formData.valor_maximo || ''}
            onChange={(e) => setFormData({ ...formData, valor_maximo: parseFloat(e.target.value) || null })}
            placeholder="Sem limite"
            className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dias_retroativos" className="text-slate-300">
          Buscar licitações dos últimos (dias)
        </Label>
        <input
          id="dias_retroativos"
          type="number"
          value={formData.dias_retroativos}
          onChange={(e) => setFormData({ ...formData, dias_retroativos: parseInt(e.target.value) || 15 })}
          min={1}
          max={365}
          className="w-32 h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white"
        />
        <p className="text-slate-500 text-sm">
          Quantos dias para trás buscar licitações na primeira execução.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
