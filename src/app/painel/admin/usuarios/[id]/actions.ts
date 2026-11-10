"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Suspende ou reativa um organizador. Quem decide se é admin é o banco. */
export async function setSuspended(organizerId: string, suspend: boolean, formData: FormData) {
  await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_organizer_id: organizerId,
    p_suspend: suspend,
    p_reason: suspend ? reason : null,
  });

  let result = suspend ? "suspenso" : "reativado";
  if (error) {
    if (error.message.includes("reason_required")) result = "sem-motivo";
    else if (error.message.includes("cannot_suspend_self")) result = "voce-mesmo";
    else {
      console.error("admin_set_suspended", organizerId, error);
      result = "erro";
    }
  }
  revalidatePath(`/painel/admin/usuarios/${organizerId}`);
  redirect(`/painel/admin/usuarios/${organizerId}?resultado=${result}`);
}
