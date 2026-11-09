"use server";

import { requireUser } from "@/lib/auth";
import { NEW_PASSWORD_ERROR, newPasswordSchema } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = {
  errors?: { current?: string; next?: string; form?: string };
  /** Muda a cada troca bem-sucedida (o formulário usa como key para limpar os campos). */
  savedAt?: number;
};

/** Troca a senha de quem está logado, conferindo a senha atual antes. */
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");

  if (!current) return { errors: { current: "Digita sua senha atual." } };
  if (!newPasswordSchema.safeParse(next).success) return { errors: { next: NEW_PASSWORD_ERROR } };
  if (current === next) return { errors: { next: "A senha nova precisa ser diferente da atual." } };
  if (!user.email) return { errors: { form: "Não achamos o e-mail da sua conta. Sai e entra de novo." } };

  const supabase = await createClient();

  // Confere a senha atual: quem pegar o celular desbloqueado não consegue trocar a senha.
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (checkError) {
    return {
      errors:
        checkError.status === 429
          ? { form: "Muitas tentativas seguidas. Espera uns minutos e tenta de novo." }
          : { current: "Senha atual não confere." },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    return {
      errors:
        error.code === "same_password"
          ? { next: "A senha nova precisa ser diferente da atual." }
          : error.code === "weak_password"
            ? { next: NEW_PASSWORD_ERROR }
            : { form: "Não deu para trocar a senha agora. Tenta de novo." },
    };
  }

  return { savedAt: Date.now() };
}
