// Selo "Agente de turismo verificado – Cadastur" (semiautomático, migration 0007).

export const CADASTUR_BUCKET = "cadastur-certificates";
export const CADASTUR_MAX_BYTES = 10 * 1024 * 1024;
export const CADASTUR_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Consulta pública do Cadastur (o admin confere o certificado lá antes de aprovar). */
export const CADASTUR_PUBLIC_SEARCH_URL = "https://cadastur.turismo.gov.br/";

/** Dias antes do vencimento em que o organizador começa a ser avisado. */
export const EXPIRY_WARNING_DAYS = 30;

/** O que get_public_trip devolve em organizer_cadastur. */
export type CadasturSeal = { valid_until: string; verified_at: string };

/** Número do certificado só com letras e números, ou null. */
export function normalizeCertificateNumber(raw: string): string | null {
  const value = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /^[0-9A-Z]{8,20}$/.test(value) ? value : null;
}

/** Hoje no fuso de Brasília, como "aaaa-mm-dd". */
export function todayBR(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Dias de hoje até a data (negativo = já passou). */
export function daysUntil(isoDate: string, now = new Date()): number {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayBR(now)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export type SealState = "valid" | "expiring" | "expired";

/** Situação do selo aprovado conforme a validade. */
export function sealState(validUntil: string, now = new Date()): SealState {
  const days = daysUntil(validUntil, now);
  if (days < 0) return "expired";
  return days <= EXPIRY_WARNING_DAYS ? "expiring" : "valid";
}
