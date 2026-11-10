"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkPassword, PASSWORD_ERRORS } from "@/lib/reauth";
import { CONFIRM_WORD, confirmWordOk } from "@/lib/trash";
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

export type AdminDeleteState = {
  errors?: { reason?: string; word?: string; password?: string; form?: string };
};

/** Exclui (lixeira) com motivo, palavra EXCLUIR e senha. Fica na auditoria. */
export async function adminDeleteTrip(
  tripId: string,
  _prev: AdminDeleteState,
  formData: FormData,
): Promise<AdminDeleteState> {
  const user = await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { errors: { reason: "Escreva o motivo (pelo menos 3 letras)." } };
  if (!confirmWordOk(formData.get("confirm_word"))) {
    return { errors: { word: `Digite ${CONFIRM_WORD} para confirmar.` } };
  }
  const check = await checkPassword(user.email, String(formData.get("password") ?? ""));
  if (check !== "ok") {
    return check === "wrong"
      ? { errors: { password: PASSWORD_ERRORS.wrong } }
      : { errors: { form: PASSWORD_ERRORS[check] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_trip", {
    p_trip_id: tripId,
    p_reason: reason,
  });
  if (error) {
    if (error.message.includes("reason_required")) {
      return { errors: { reason: "Escreva o motivo (pelo menos 3 letras)." } };
    }
    console.error("admin_delete_trip", tripId, error);
    return { errors: { form: "Não deu para excluir. Atualize a página e tente de novo." } };
  }
  revalidatePath(`/painel/admin/viagens/${tripId}`);
  redirect(`/painel/admin/viagens/${tripId}?resultado=excluida`);
}

/** Tira da lixeira (qualquer viagem, inclusive as que o organizador excluiu). */
export async function adminRestoreTrip(tripId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_trip", { p_trip_id: tripId });
  if (error) console.error("admin_restore_trip", tripId, error);
  revalidatePath(`/painel/admin/viagens/${tripId}`);
  redirect(`/painel/admin/viagens/${tripId}?resultado=${error ? "erro" : "restaurada"}`);
}
