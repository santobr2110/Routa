"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/**
 * Remove um inscrito (confirmado ou da fila). A função do banco marca como cancelado e
 * promove os primeiros da lista de espera. Volta para a lista avisando quem subiu.
 */
export async function cancelRegistration(tripId: string, registrationId: string) {
  await requireOrganizer();
  const supabase = await createClient();
  const page = `/painel/viagens/${tripId}/inscritos`;

  // Quem está na fila antes, para descobrir quem foi promovido depois.
  const { data: before } = await supabase
    .from("registrations")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "waitlist");
  const waitlistIds = (before ?? []).map((r) => r.id).filter((id) => id !== registrationId);

  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: registrationId,
  });
  if (error) {
    console.error("cancel_registration", registrationId, error);
    redirect(`${page}?erro=remover`);
  }

  let promoted: string[] = [];
  if (waitlistIds.length > 0) {
    const { data: after } = await supabase
      .from("registrations")
      .select("id")
      .in("id", waitlistIds)
      .eq("status", "confirmed");
    promoted = (after ?? []).map((r) => r.id);
  }

  revalidatePath("/painel");
  revalidatePath(`/painel/viagens/${tripId}`);
  revalidatePath(page);
  redirect(promoted.length ? `${page}?promovido=${promoted.join(",")}` : `${page}?removido=1`);
}

/**
 * Libera a vaga de quem venceu o prazo de pagamento: a pessoa vai para o fim da lista de
 * espera e o primeiro da fila sobe. Volta para a lista com os dois avisos prontos.
 */
export async function releaseRegistration(tripId: string, registrationId: string) {
  await requireOrganizer();
  const supabase = await createClient();
  const page = `/painel/viagens/${tripId}/inscritos`;

  const { data, error } = await supabase.rpc("release_overdue_registration", {
    p_registration_id: registrationId,
  });
  if (error) {
    console.error("release_overdue_registration", registrationId, error);
    redirect(`${page}?erro=liberar`);
  }
  const { promoted } = data as { released: string; promoted: string };

  revalidatePath("/painel");
  revalidatePath(page);
  redirect(`${page}?liberado=${registrationId}&promovido=${promoted}`);
}
