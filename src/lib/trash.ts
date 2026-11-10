/** Lixeira de viagens (migration 0014). */

/** Dias na lixeira antes de apagar de vez (private.purge_deleted_trips). */
export const TRASH_DAYS = 30;

/** Palavra que precisa ser digitada para confirmar a exclusão. */
export const CONFIRM_WORD = "EXCLUIR";

export type DeletedTrip = {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  deleted_at: string;
  deleted_by_admin: boolean;
  deleted_reason: string | null;
  purge_at: string;
  confirmed: number;
  waitlist: number;
};

/** Dias inteiros que faltam para apagar de vez (nunca negativo). */
export function daysLeft(purgeAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(purgeAt) - now) / 86_400_000));
}

/** Confere a palavra de confirmação (aceita minúsculas e espaços nas pontas). */
export function confirmWordOk(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === CONFIRM_WORD;
}
