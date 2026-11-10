"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Aprova ou recusa um pedido de selo. Quem decide se é admin é o banco (admin_review_cadastur). */
export async function reviewCadastur(id: string, approve: boolean, formData: FormData) {
  await requireUser();
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_cadastur", {
    p_id: id,
    p_approve: approve,
    p_reason: approve ? null : reason,
  });

  let result = approve ? "aprovado" : "recusado";
  if (error) {
    if (error.message.includes("reason_required")) result = "sem-motivo";
    else if (error.message.includes("not_pending")) result = "ja-revisado";
    else {
      console.error("admin_review_cadastur", id, error);
      result = "erro";
    }
  }
  revalidatePath("/painel/admin/selos");
  redirect(`/painel/admin/selos?resultado=${result}`);
}
