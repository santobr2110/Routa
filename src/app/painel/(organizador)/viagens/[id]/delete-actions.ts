"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { checkPassword, PASSWORD_ERRORS } from "@/lib/reauth";
import { createClient } from "@/lib/supabase/server";
import { CONFIRM_WORD, confirmWordOk } from "@/lib/trash";

export type DeleteTripState = {
  errors?: { word?: string; password?: string; form?: string };
};

/** Manda a viagem para a lixeira, depois de conferir a palavra EXCLUIR e a senha. */
export async function deleteTrip(
  tripId: string,
  _prev: DeleteTripState,
  formData: FormData,
): Promise<DeleteTripState> {
  const user = await requireUser();
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
  const { error } = await supabase.rpc("delete_trip", { p_trip_id: tripId });
  if (error) {
    if (error.message.includes("organizer_suspended")) {
      return { errors: { form: "Sua conta está suspensa: não dá para excluir viagens agora." } };
    }
    if (!error.message.includes("not_found")) console.error("delete_trip", tripId, error);
    return { errors: { form: "Não deu para excluir a viagem. Atualize a página e tente de novo." } };
  }

  revalidatePath("/painel", "layout");
  redirect("/painel/viagens/lixeira?excluida=1");
}

/** Tira a viagem da lixeira (só as que o próprio organizador excluiu). */
export async function restoreTrip(tripId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_trip", { p_trip_id: tripId });
  let result = "restaurada";
  if (error) {
    if (error.message.includes("deleted_by_admin")) result = "admin";
    else {
      if (!error.message.includes("not_found")) console.error("restore_trip", tripId, error);
      result = "erro";
    }
  }
  revalidatePath("/painel", "layout");
  if (result === "restaurada") redirect(`/painel/viagens/${tripId}?restaurada=1`);
  redirect(`/painel/viagens/lixeira?resultado=${result}`);
}
