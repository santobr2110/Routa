/** Períodos dos painéis (admin e organizador) e como agrupar cada um nos gráficos. */
export const PERIODS = {
  "7": { days: 7, bucket: "day", label: "7 dias" },
  "30": { days: 30, bucket: "day", label: "30 dias" },
  "90": { days: 90, bucket: "week", label: "90 dias" },
  "365": { days: 365, bucket: "month", label: "12 meses" },
} as const;
export type PeriodKey = keyof typeof PERIODS;
export type Bucket = "day" | "week" | "month";

/** Lê o período da URL (?periodo=7|30|90|365); padrão 30 dias. */
export function parsePeriod(value: unknown, fallback: PeriodKey = "30"): PeriodKey {
  return typeof value === "string" && value in PERIODS ? (value as PeriodKey) : fallback;
}
