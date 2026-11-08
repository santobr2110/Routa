"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeBrPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export type ProfileState = {
  errors?: { name?: string; whatsapp?: string; form?: string };
  values?: { name: string; whatsapp: string };
};

const nameSchema = z.string().trim().min(2).max(80);

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const values = {
    name: String(formData.get("name") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
  };

  const name = nameSchema.safeParse(values.name);
  const whatsapp = normalizeBrPhone(values.whatsapp);
  const errors: ProfileState["errors"] = {};
  if (!name.success) errors.name = "Coloca seu nome (de 2 a 80 letras).";
  if (!whatsapp) errors.whatsapp = "Coloca o WhatsApp com DDD, ex.: (11) 99999-8888.";
  if (!name.success || !whatsapp) return { errors, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizers")
    .upsert({ id: user.id, name: name.data, whatsapp });

  if (error) {
    return { errors: { form: "Não deu para salvar agora. Tenta de novo." }, values };
  }

  redirect("/painel");
}
