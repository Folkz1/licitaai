const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "https://apps-evolution-api.klx2s6.easypanel.host";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "CD6D2B1F7373-4086-AAC9-53391CF245E8";
const INSTANCE = process.env.EVOLUTION_INSTANCE || "guyfolkiz";

export async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const number = phone.replace(/\D/g, "");
  if (number.length < 12) return false;

  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { apikey: EVOLUTION_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ number, text, delay: 1200 }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
