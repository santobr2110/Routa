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

/**
 * "1.234,56", "R$ 1234,5", "350" → centavos (123456, 123450, 35000).
 * Devolve null se não for um valor válido.
 */
export function parseBRL(input: string): number | null {
  const clean = input.replace(/R\$|\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return null;
  const [reais, centavos = ""] = clean.replace(/\./g, "").split(",");
  return Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
}

/** 123456 → "1.234,56" (para preencher o campo de valor). */
export function centsToInput(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(cents / 100);
}

/** "Serra do Rio do Rastro!" → "serra-do-rio-do-rastro" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Mesmo dia → "12/12/2026"; senão → "12/12/2026 a 14/12/2026". */
export function formatDateRangeBR(start: string, end: string): string {
  return start === end ? formatDateBR(start) : `${formatDateBR(start)} a ${formatDateBR(end)}`;
}
