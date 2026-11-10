"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Tira a viagem do ar ou devolve. Quem decide se é admin é o banco. */
export async function setTripHidden(tripId: string, hide: boolean, formData: FormData) {
  await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_trip_hidden", {
    p_trip_id: tripId,
    p_hide: hide,
    p_reason: hide ? reason : null,
  });

  let result = hide ? "fora-do-ar" : "no-ar";
  if (error) {
    if (error.message.includes("reason_required")) result = "sem-motivo";
    else {
      console.error("admin_set_trip_hidden", tripId, error);
      result = "erro";
    }
  }
  revalidatePath(`/painel/admin/viagens/${tripId}`);
  redirect(`/painel/admin/viagens/${tripId}?resultado=${result}`);
}
