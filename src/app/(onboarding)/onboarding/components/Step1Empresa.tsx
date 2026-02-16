'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';

interface Step1EmpresaProps {
  data: Record<string, unknown>;
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  isLoading: boolean;
  isFirstStep: boolean;
}

const PORTES = [
  { value: 'ME', label: 'Microempresa (ME)' },
  { value: 'EPP', label: 'Empresa de Pequeno Porte (EPP)' },
  { value: 'MEI', label: 'Microempreendedor Individual (MEI)' },
  { value: 'DEMAIS', label: 'Demais empresas' },
];

const SETORES = [
  { value: 'COMERCIO', label: 'Comércio' },
  { value: 'SERVICOS', label: 'Serviços' },
  { value: 'INDUSTRIA', label: 'Indústria' },
  { value: 'MIXTO', label: 'Misto' },
];

export default function Step1Empresa({
  data,
  onNext,
  isLoading,
  isFirstStep,
}: Step1EmpresaProps) {
  const [formData, setFormData] = useState({
    razao_social: (data?.razao_social as string) || '',
    nome_fantasia: (data?.nome_fantasia as string) || '',
    cnpj: (data?.cnpj as string) || '',
    porte: (data?.porte as string) || '',
    setor: (data?.setor as string) || '',
    descricao_livre: (data?.descricao_livre as string) || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.razao_social.trim()) {
      newErrors.razao_social = 'Razão social é obrigatória';
    }
    
    if (!formData.porte) {
      newErrors.porte = 'Porte é obrigatório';
    }
    
    if (!formData.setor) {
      newErrors.setor = 'Setor é obrigatório';
    }
    
    if (formData.cnpj && formData.cnpj.replace(/\D/g, '').length !== 14) {
      newErrors.cnpj = 'CNPJ deve ter 14 dígitos';
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

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="razao_social" className="text-slate-300">
            Razão Social *
          </Label>
          <Input
            id="razao_social"
            value={formData.razao_social}
            onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
            placeholder="Empresa Ltda"
            className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
          />
          {errors.razao_social && (
            <span className="text-red-400 text-sm">{errors.razao_social}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nome_fantasia" className="text-slate-300">
            Nome Fantasia
          </Label>
          <Input
            id="nome_fantasia"
            value={formData.nome_fantasia}
            onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
            placeholder="Nome comercial"
            className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cnpj" className="text-slate-300">
          CNPJ
        </Label>
        <Input
          id="cnpj"
          value={formData.cnpj}
          onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
          placeholder="00.000.000/0000-00"
          className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
          maxLength={18}
        />
        {errors.cnpj && (
          <span className="text-red-400 text-sm">{errors.cnpj}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="porte" className="text-slate-300">
            Porte da Empresa *
          </Label>
          <select
            id="porte"
            value={formData.porte}
            onChange={(e) => setFormData({ ...formData, porte: e.target.value })}
            className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white"
          >
            <option value="">Selecione...</option>
            {PORTES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {errors.porte && (
            <span className="text-red-400 text-sm">{errors.porte}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor" className="text-slate-300">
            Setor de Atuação *
          </Label>
          <select
            id="setor"
            value={formData.setor}
            onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
            className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white"
          >
            <option value="">Selecione...</option>
            {SETORES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.setor && (
            <span className="text-red-400 text-sm">{errors.setor}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao_livre" className="text-slate-300">
          Descrição do Negócio (opcional)
        </Label>
        <textarea
          id="descricao_livre"
          value={formData.descricao_livre}
          onChange={(e) => setFormData({ ...formData, descricao_livre: e.target.value })}
          placeholder="Descreva brevemente o que sua empresa faz..."
          className="w-full min-h-[100px] px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 resize-none"
        />
      </div>

      <div className="flex justify-end pt-4">
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
