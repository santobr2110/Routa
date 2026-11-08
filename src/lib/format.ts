// Formatos brasileiros usados na interface.

/**
 * Normaliza um telefone brasileiro para só dígitos com o 55 na frente (ex.: 5511999998888).
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888" etc.
 * Devolve null se não parecer um celular/fixo com DDD.
 */
export function normalizeBrPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : null;
}

/** 5511999998888 → (11) 99999-8888 */
export function formatBrPhone(phone: string): string {
  const local = phone.replace(/^55/, "");
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  const split = number.length === 9 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

/** Link do WhatsApp (wa.me), com mensagem opcional já preenchida. */
export function whatsappLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** 123456 (centavos) → R$ 1.234,56 */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

/** "2026-12-01" → 01/12/2026 (sem passar por Date, para não sofrer com fuso). */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
