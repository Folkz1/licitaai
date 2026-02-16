'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft, Plus, X } from 'lucide-react';

interface Step3ProdutosProps {
  data: Record<string, unknown>;
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function Step3Produtos({
  data,
  onNext,
  onBack,
  isLoading,
}: Step3ProdutosProps) {
  const [formData, setFormData] = useState({
    produtos_servicos: (data?.produtos_servicos as string) || '',
    palavras_chave_manual: (data?.palavras_chave_manual as string[]) || [],
    exclusoes: (data?.exclusoes as string) || '',
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.produtos_servicos.trim()) {
      newErrors.produtos_servicos = 'Descreva seus produtos ou serviços';
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

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.palavras_chave_manual.includes(newKeyword.trim())) {
      setFormData({
        ...formData,
        palavras_chave_manual: [...formData.palavras_chave_manual, newKeyword.trim()]
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      palavras_chave_manual: formData.palavras_chave_manual.filter(k => k !== keyword)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="produtos_servicos" className="text-slate-300">
          Produtos e Serviços que você oferece *
        </Label>
        <textarea
          id="produtos_servicos"
          value={formData.produtos_servicos}
          onChange={(e) => setFormData({ ...formData, produtos_servicos: e.target.value })}
          placeholder="Ex: Impressão offset, impressão digital, banners, folders, cartões de visita, material promocional..."
          className="w-full min-h-[120px] px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 resize-none"
        />
        <p className="text-slate-500 text-sm">
          Liste os principais produtos ou serviços que sua empresa oferece. Um por linha ou separados por vírgula.
        </p>
        {errors.produtos_servicos && (
          <span className="text-red-400 text-sm">{errors.produtos_servicos}</span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">
          Palavras-chave que você já conhece (opcional)
        </Label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder="Digite uma palavra-chave"
            className="flex-1 h-10 px-3 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addKeyword}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {formData.palavras_chave_manual.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.palavras_chave_manual.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="exclusoes" className="text-slate-300">
          O que você NÃO quer buscar (opcional)
        </Label>
        <textarea
          id="exclusoes"
          value={formData.exclusoes}
          onChange={(e) => setFormData({ ...formData, exclusoes: e.target.value })}
          placeholder="Ex: Não trabalho com serigrafia, não faço instalação de outdoors..."
          className="w-full min-h-[80px] px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 resize-none"
        />
        <p className="text-slate-500 text-sm">
          Ajuda a IA a filtrar licitações que não são relevantes para você.
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
