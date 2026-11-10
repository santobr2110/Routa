"use server";

import { revalidatePath } from "next/cache";
import { convoyOn, parseConvoyForm, profileRpcArgs, type ConvoyField } from "@/lib/convoy";
import { getRegistrationPage, isAccessToken } from "@/lib/registration-page";
import { createClient } from "@/lib/supabase/server";

export type ConvoyFormState = {
  errors?: Partial<Record<ConvoyField | "form", string>>;
  savedAt?: number;
};

/** Grava as respostas do Raio-X pelo link pessoal (o token é a chave). */
export async function saveConvoy(
  token: string,
  _prev: ConvoyFormState,
  formData: FormData,
): Promise<ConvoyFormState> {
  if (!isAccessToken(token)) return { errors: { form: "Link inválido." } };
  const page = await getRegistrationPage(token);
  const convoy = page?.convoy;
  if (!page || !convoyOn(convoy) || !convoy.can_edit) {
    return { errors: { form: "Não dá mais para responder o Raio-X desta viagem." } };
  }

  const { profile, errors } = parseConvoyForm(formData, convoy, {
    brand: page.registration.bike_brand ?? "",
    model: page.registration.bike_model ?? "",
  });
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_convoy_profile", profileRpcArgs(token, profile));
  if (error) {
    if (error.message.includes("required_missing")) {
      return { errors: { form: "Faltou responder uma pergunta obrigatória." } };
    }
    if (error.message.includes("closed")) {
      return { errors: { form: "Não dá mais para responder o Raio-X desta viagem." } };
    }
    console.error("save_convoy_profile", error);
    return { errors: { form: "Não deu para salvar agora. Tenta de novo." } };
  }
  revalidatePath(`/i/${token}`);
  return { savedAt: Date.now() };
}
