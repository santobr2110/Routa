"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!z.email().safeParse(email).success || !password) {
    return { error: "Preenche o e-mail e a senha.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Falta confirmar seu e-mail: abre o link que mandamos quando você criou a conta."
        : error.status === 429
          ? "Muitas tentativas seguidas. Espera um minutinho e tenta de novo."
          : error.code === "invalid_credentials"
            ? "E-mail ou senha não conferem."
            : "Não deu para entrar agora. Tenta de novo daqui a pouco.";
    return { error: message, email };
  }

  redirect("/painel");
}
