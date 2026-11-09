"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { NEW_PASSWORD_ERROR, newPasswordSchema } from "@/lib/password";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type SignUpState = {
  errors?: { email?: string; password?: string; form?: string };
  email?: string;
  sent?: boolean;
};

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const errors: SignUpState["errors"] = {};
  if (!z.email().safeParse(email).success) errors.email = "Confere o e-mail? Parece que falta alguma coisa.";
  if (!newPasswordSchema.safeParse(password).success) errors.password = NEW_PASSWORD_ERROR;
  if (errors.email || errors.password) return { errors, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // O link do e-mail de confirmação volta para cá e segue para o cadastro do perfil.
    options: { emailRedirectTo: `${siteUrl}/auth/confirm?next=/painel/perfil` },
  });

  if (error) {
    if (error.code === "weak_password") return { errors: { password: NEW_PASSWORD_ERROR }, email };
    if (error.code === "user_already_exists") {
      return {
        errors: { email: "Já existe uma conta com esse e-mail. Entre ou use “Esqueci minha senha”." },
        email,
      };
    }
    return {
      errors: {
        form:
          error.status === 429
            ? "Já mandamos e-mails demais por agora. Tenta criar a conta de novo daqui a 1 hora."
            : "Não deu para criar a conta agora. Tenta de novo daqui a pouco.",
      },
      email,
    };
  }

  // Confirmação de e-mail desligada no Supabase: já entra direto.
  if (data.session) redirect("/painel/perfil");

  // Com confirmação ligada, o Supabase não diz se o e-mail já tinha conta (privacidade).
  return { sent: true, email };
}
