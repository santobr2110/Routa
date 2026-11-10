"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type UpdateState = { error?: string; ok?: number };

/** Publica um aviso no mural da viagem (aparece na página de cada inscrito). */
export async function addTripUpdate(
  tripId: string,
  _prev: UpdateState,
  formData: FormData,
): Promise<UpdateState> {
  await requireOrganizer();
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Escreve o aviso antes de publicar." };
  if (body.length > 2000) return { error: "O aviso pode ter até 2.000 caracteres." };

  const supabase = await createClient();
  // O RLS só deixa publicar em viagens do próprio organizador.
  const { error } = await supabase.from("trip_updates").insert({ trip_id: tripId, body });
  if (error) {
    console.error("addTripUpdate", error);
    return {
      error: error.message.includes("organizer_suspended")
        ? "Sua conta está suspensa: não dá para publicar avisos."
        : "Não deu para publicar. Tenta de novo.",
    };
  }
  revalidatePath(`/painel/viagens/${tripId}/cobranca`);
  return { ok: Date.now() };
}

/** Apaga um aviso do mural. */
export async function deleteTripUpdate(tripId: string, updateId: string) {
  await requireOrganizer();
  const supabase = await createClient();
  await supabase.from("trip_updates").delete().eq("id", updateId).eq("trip_id", tripId);
  revalidatePath(`/painel/viagens/${tripId}/cobranca`);
}
