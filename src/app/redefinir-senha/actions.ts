"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { NEW_PASSWORD_ERROR, newPasswordSchema } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error?: string };

/** Grava a senha nova. Quem chega aqui já entrou pelo link do e-mail de recuperação. */
export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!newPasswordSchema.safeParse(password).success) return { error: NEW_PASSWORD_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Essa já é a sua senha atual. Escolha outra."
          : error.code === "weak_password"
            ? NEW_PASSWORD_ERROR
            : "Não deu para salvar a senha. Tenta de novo.",
    };
  }
  redirect("/painel");
}
