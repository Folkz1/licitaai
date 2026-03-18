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
  requiresAccountSetup?: boolean;
}

const PORTES = [
  { value: 'ME', label: 'Microempresa (ME)' },
  { value: 'EPP', label: 'Empresa de Pequeno Porte (EPP)' },
  { value: 'MEI', label: 'Microempreendedor Individual (MEI)' },
  { value: 'DEMAIS', label: 'Demais empresas' },
];

const SETORES = [
  { value: 'COMERCIO', label: 'Comercio' },
  { value: 'SERVICOS', label: 'Servicos' },
  { value: 'INDUSTRIA', label: 'Industria' },
  { value: 'MIXTO', label: 'Misto' },
];

export default function Step1Empresa({
  data,
  onNext,
  isLoading,
  requiresAccountSetup = false,
}: Step1EmpresaProps) {
  const [formData, setFormData] = useState({
    razao_social: (data?.razao_social as string) || '',
    nome_fantasia: (data?.nome_fantasia as string) || '',
    cnpj: (data?.cnpj as string) || '',
    porte: (data?.porte as string) || '',
    setor: (data?.setor as string) || '',
    descricao_livre: (data?.descricao_livre as string) || '',
    nome_responsavel: (data?.nome_responsavel as string) || '',
    email: (data?.email as string) || '',
    telefone: (data?.telefone as string) || '',
    senha: (data?.senha as string) || '',
    confirmar_senha: (data?.confirmar_senha as string) || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.razao_social.trim()) {
      newErrors.razao_social = 'Razao social e obrigatoria';
    }

    if (!formData.porte) {
      newErrors.porte = 'Porte e obrigatorio';
    }

    if (!formData.setor) {
      newErrors.setor = 'Setor e obrigatorio';
    }

    if (formData.cnpj && formData.cnpj.replace(/\D/g, '').length !== 14) {
      newErrors.cnpj = 'CNPJ deve ter 14 digitos';
    }

    if (requiresAccountSetup) {
      if (!formData.nome_responsavel.trim()) {
        newErrors.nome_responsavel = 'Nome do responsavel e obrigatorio';
      }

      if (!formData.email.trim()) {
        newErrors.email = 'Email e obrigatorio';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Informe um email valido';
      }

      if (!formData.senha) {
        newErrors.senha = 'Senha e obrigatoria';
      } else if (formData.senha.length < 8) {
        newErrors.senha = 'A senha precisa ter pelo menos 8 caracteres';
      }

      if (!formData.confirmar_senha) {
        newErrors.confirmar_senha = 'Confirme sua senha';
      } else if (formData.senha !== formData.confirmar_senha) {
        newErrors.confirmar_senha = 'As senhas precisam ser iguais';
      }
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

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);

    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {requiresAccountSetup && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h3 className="text-sm font-medium text-emerald-300">Dados de acesso</h3>
          <p className="mt-1 text-sm text-slate-300">
            Esses dados serao usados para criar sua conta e liberar o trial de 7 dias.
          </p>
        </div>
      )}

      {requiresAccountSetup && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome_responsavel" className="text-slate-300">
              Nome do Responsavel *
            </Label>
            <Input
              id="nome_responsavel"
              value={formData.nome_responsavel}
              onChange={(e) => setFormData({ ...formData, nome_responsavel: e.target.value })}
              placeholder="Seu nome"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            {errors.nome_responsavel && (
              <span className="text-red-400 text-sm">{errors.nome_responsavel}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-slate-300">
              WhatsApp
            </Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
              placeholder="(11) 99999-9999"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="voce@empresa.com"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            {errors.email && <span className="text-red-400 text-sm">{errors.email}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha" className="text-slate-300">
              Senha *
            </Label>
            <Input
              id="senha"
              type="password"
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Minimo de 8 caracteres"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            {errors.senha && <span className="text-red-400 text-sm">{errors.senha}</span>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="confirmar_senha" className="text-slate-300">
              Confirmar Senha *
            </Label>
            <Input
              id="confirmar_senha"
              type="password"
              value={formData.confirmar_senha}
              onChange={(e) => setFormData({ ...formData, confirmar_senha: e.target.value })}
              placeholder="Repita a senha"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            {errors.confirmar_senha && (
              <span className="text-red-400 text-sm">{errors.confirmar_senha}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="razao_social" className="text-slate-300">
            Razao Social *
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
        {errors.cnpj && <span className="text-red-400 text-sm">{errors.cnpj}</span>}
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
          {errors.porte && <span className="text-red-400 text-sm">{errors.porte}</span>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor" className="text-slate-300">
            Setor de Atuacao *
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
          {errors.setor && <span className="text-red-400 text-sm">{errors.setor}</span>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao_livre" className="text-slate-300">
          Descricao do Negocio (opcional)
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
              Proximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
