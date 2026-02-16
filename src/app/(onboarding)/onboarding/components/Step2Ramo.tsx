'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface Step2RamoProps {
  data: Record<string, unknown>;
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  isLoading: boolean;
}

const RAMOS = [
  { id: 'GRAFICO', nome: 'Gráfica e Comunicação Visual', icon: '🖨️' },
  { id: 'TI', nome: 'Tecnologia da Informação', icon: '💻' },
  { id: 'CONSTRUCAO', nome: 'Construção Civil', icon: '🏗️' },
  { id: 'ALIMENTOS', nome: 'Alimentos e Bebidas', icon: '🍽️' },
  { id: 'TRANSPORTE', nome: 'Transporte e Logística', icon: '🚚' },
  { id: 'SAUDE', nome: 'Saúde e Medicamentos', icon: '🏥' },
  { id: 'EDUCACAO', nome: 'Educação e Treinamento', icon: '📚' },
  { id: 'LIMPEZA', nome: 'Limpeza e Conservação', icon: '🧹' },
  { id: 'EQUIPAMENTOS', nome: 'Equipamentos e Materiais', icon: '🔧' },
  { id: 'SERVICOS_GERAIS', nome: 'Serviços Gerais', icon: '📋' },
  { id: 'OUTRO', nome: 'Outro', icon: '📦' },
];

const TIPOS_CLIENTES = [
  { value: 'FEDERAL', label: 'Governo Federal' },
  { value: 'ESTADUAL', label: 'Governo Estadual' },
  { value: 'MUNICIPAL', label: 'Governo Municipal' },
  { value: 'PRIVADO', label: 'Setor Privado' },
];

export default function Step2Ramo({
  data,
  onNext,
  onBack,
  isLoading,
}: Step2RamoProps) {
  const [formData, setFormData] = useState({
    ramo_principal: (data?.ramo_principal as string) || '',
    ramo_secundario: (data?.ramo_secundario as string[]) || [],
    experiencia_pregao: (data?.experiencia_pregao as boolean) ?? false,
    tipos_clientes: (data?.tipos_clientes as string[]) || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.ramo_principal) {
      newErrors.ramo_principal = 'Selecione um ramo principal';
    }
    
    if (formData.tipos_clientes.length === 0) {
      newErrors.tipos_clientes = 'Selecione pelo menos um tipo de cliente';
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

  const toggleCliente = (value: string) => {
    setFormData(prev => ({
      ...prev,
      tipos_clientes: prev.tipos_clientes.includes(value)
        ? prev.tipos_clientes.filter(c => c !== value)
        : [...prev.tipos_clientes, value]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label className="text-slate-300">Ramo Principal de Atuação *</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {RAMOS.map((ramo) => (
            <button
              key={ramo.id}
              type="button"
              onClick={() => setFormData({ ...formData, ramo_principal: ramo.id })}
              className={`p-4 rounded-lg border text-left transition-all ${
                formData.ramo_principal === ramo.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="text-2xl">{ramo.icon}</span>
              <p className="mt-2 text-sm font-medium">{ramo.nome}</p>
              {formData.ramo_principal === ramo.id && (
                <Check className="w-4 h-4 text-indigo-400 mt-1" />
              )}
            </button>
          ))}
        </div>
        {errors.ramo_principal && (
          <span className="text-red-400 text-sm">{errors.ramo_principal}</span>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">Tipos de Clientes que Atende *</Label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_CLIENTES.map((tipo) => (
            <button
              key={tipo.value}
              type="button"
              onClick={() => toggleCliente(tipo.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                formData.tipos_clientes.includes(tipo.value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tipo.label}
            </button>
          ))}
        </div>
        {errors.tipos_clientes && (
          <span className="text-red-400 text-sm">{errors.tipos_clientes}</span>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">Experiência com Pregões</Label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, experiencia_pregao: true })}
            className={`flex-1 p-3 rounded-lg border transition-all ${
              formData.experiencia_pregao === true
                ? 'border-emerald-500 bg-emerald-500/10 text-white'
                : 'border-slate-600 bg-slate-900/50 text-slate-300'
            }`}
          >
            Sim, já participei
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, experiencia_pregao: false })}
            className={`flex-1 p-3 rounded-lg border transition-all ${
              formData.experiencia_pregao === false
                ? 'border-amber-500 bg-amber-500/10 text-white'
                : 'border-slate-600 bg-slate-900/50 text-slate-300'
            }`}
          >
            Não, é minha primeira vez
          </button>
        </div>
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
