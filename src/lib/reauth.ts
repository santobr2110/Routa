import { createClient } from "@/lib/supabase/server";
import type { DeletedTrip } from "@/lib/trash";

export type PasswordCheck = "ok" | "wrong" | "rate_limited" | "no_email";

/**
 * Confere a senha de quem está logado antes de uma ação sem volta (excluir viagem).
 * Mesmo esquema da troca de senha: quem pegar o celular desbloqueado não consegue.
 */
export async function checkPassword(email: string | null, password: string): Promise<PasswordCheck> {
  if (!email) return "no_email";
  if (!password) return "wrong";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return "ok";
  return error.status === 429 ? "rate_limited" : "wrong";
}

export const PASSWORD_ERRORS: Record<Exclude<PasswordCheck, "ok">, string> = {
  wrong: "Senha não confere.",
  rate_limited: "Muitas tentativas seguidas. Espera uns minutos e tenta de novo.",
  no_email: "Não achamos o e-mail da sua conta. Sai e entra de novo.",
};

/** Lixeira do organizador logado (inclui as excluídas pela administração). */
export async function getDeletedTrips(): Promise<DeletedTrip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_deleted_trips");
  if (error) throw error;
  return (data ?? []) as unknown as DeletedTrip[];
}
