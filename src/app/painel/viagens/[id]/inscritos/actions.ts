"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PaymentStatus } from "@/types/database";

/** Marca a inscrição como paga ou pendente (a única coluna que o organizador pode alterar). */
export async function setPaymentStatus(
  tripId: string,
  registrationId: string,
  status: PaymentStatus,
): Promise<{ error?: string }> {
  await requireOrganizer();
  if (status !== "paid" && status !== "pending") return { error: "Status inválido." };

  const supabase = await createClient();
  // O RLS só deixa alterar inscrições de viagens do próprio organizador.
  const { error } = await supabase
    .from("registrations")
    .update({ payment_status: status })
    .eq("id", registrationId)
    .eq("trip_id", tripId)
    .select("id")
    .single();
  if (error) return { error: "Não deu para salvar. Tenta de novo." };

  revalidatePath(`/painel/viagens/${tripId}/inscritos`);
  return {};
}
