export const COMMERCIAL_WHATSAPP_NUMBER = "555193448124";

export function buildWhatsAppHref(message: string): string {
  const normalized = COMMERCIAL_WHATSAPP_NUMBER.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export const COMMERCIAL_MESSAGES = {
  home: buildWhatsAppHref(
    "Oi Diego! Quero um diagnostico rapido do LicitaIA para o meu segmento."
  ),
  pricing: buildWhatsAppHref(
    "Oi Diego! Quero entender qual plano/implantacao do LicitaIA faz sentido para minha operacao."
  ),
  blog: buildWhatsAppHref(
    "Oi Diego! Vim pelo blog do LicitaIA e quero ver uma demo rapida."
  ),
  state: buildWhatsAppHref(
    "Oi Diego! Quero configurar um radar de licitacoes por estado no LicitaIA."
  ),
};
