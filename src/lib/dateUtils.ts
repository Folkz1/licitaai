<<<<<<< HEAD
export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getDeadlineDate(licitacao: { data_encerramento_proposta?: string; data_abertura_propostas?: string; data_limite_envio_propostas?: string } | null): string | null {
  if (!licitacao) return null;
  return licitacao.data_encerramento_proposta || licitacao.data_limite_envio_propostas || licitacao.data_abertura_propostas || null;
=======
export function daysUntil(date: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
>>>>>>> master
}
