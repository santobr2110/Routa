import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** Usuário logado (validado pelo JWT) ou null. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
});

/** Exige login; senão, manda para /entrar. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Perfil do organizador (nome + WhatsApp) ou null se ainda não preencheu. */
export const getOrganizer = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, whatsapp, suspended_at, suspended_reason")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
});

/** Exige login e perfil preenchido; senão, manda para o cadastro do perfil. */
export async function requireOrganizer() {
  const user = await requireUser();
  const organizer = await getOrganizer(user.id);
  if (!organizer) redirect("/painel/perfil");
  return { user, organizer };
}
