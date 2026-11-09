"use server";

import { z } from "zod";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; email?: string; sent?: boolean };

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) {
    return { error: "Confere o e-mail? Parece que falta alguma coisa.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/redefinir-senha`,
  });

  if (error?.status === 429) {
    return { error: "Muitos pedidos seguidos. Espera um minutinho e tenta de novo.", email };
  }
  // Mesmo se o e-mail não tiver conta, a resposta é igual (não revela quem é cadastrado).
  return { sent: true, email };
}
