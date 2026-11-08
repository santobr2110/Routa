"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email?: string };

const emailSchema = z.email();

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const origin = (await headers()).get("origin");
  return origin ?? "http://localhost:3000";
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!emailSchema.safeParse(email).success) {
    return { status: "error", message: "Confere o e-mail? Parece que falta alguma coisa.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/painel` },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Muitos pedidos seguidos. Espera um minutinho e tenta de novo."
        : "Não deu para enviar o link agora. Tenta de novo daqui a pouco.";
    return { status: "error", message, email };
  }

  return { status: "sent", email };
}
