"use server";

import { z } from "zod";
import { normalizeBrPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PricingMode } from "@/types/database";

export type RegisterField =
  | "name"
  | "whatsapp"
  | "email"
  | "bike"
  | "has_pillion"
  | "pillion_name"
  | "emergency_name"
  | "emergency_phone"
  | "terms";

export type RegisterValues = Record<RegisterField, string>;

/** O que register_for_trip devolve. Chave Pix e WhatsApp do organizador só para confirmados. */
export type RegisterResult = {
  registration_id: string;
  status: "confirmed" | "waitlist";
  pricing_mode: PricingMode;
  amount_cents: number | null;
  has_pillion: boolean;
  organizer_name: string;
  pix_key: string | null;
  organizer_whatsapp: string | null;
};

export type RegisterState = {
  errors?: Partial<Record<RegisterField | "form", string>>;
  values?: RegisterValues;
  result?: RegisterResult;
};

const FIELDS: RegisterField[] = [
  "name",
  "whatsapp",
  "email",
  "bike",
  "has_pillion",
  "pillion_name",
  "emergency_name",
  "emergency_phone",
  "terms",
];

const personName = z.string().trim().min(2).max(80);

/** Erros que a função do banco pode levantar, em português. */
const DB_ERRORS: Record<string, Partial<Record<RegisterField | "form", string>>> = {
  already_registered: {
    whatsapp: "Esse WhatsApp já está inscrito nesta viagem. Fala com o organizador se precisar mudar algo.",
  },
  trip_not_open: { form: "As inscrições desta viagem fecharam." },
  pillion_not_accepted: { has_pillion: "Esta viagem não aceita garupa." },
  terms_not_accepted: { terms: "Pra se inscrever, precisa aceitar o termo." },
};

export async function registerForTrip(
  slug: string,
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  ) as RegisterValues;

  const errors: RegisterState["errors"] = {};
  const name = personName.safeParse(values.name);
  if (!name.success) errors.name = "Coloca seu nome (de 2 a 80 letras).";
  const whatsapp = normalizeBrPhone(values.whatsapp);
  if (!whatsapp) errors.whatsapp = "Coloca o WhatsApp com DDD, ex.: (11) 99999-8888.";
  const email = z.email().max(200).safeParse(values.email.trim());
  if (!email.success) errors.email = "Coloca um e-mail válido, ex.: voce@exemplo.com.";
  const bike = z.string().trim().min(2).max(80).safeParse(values.bike);
  if (!bike.success) errors.bike = "Qual moto você vai levar? Ex.: Honda XRE 300.";

  const hasPillion = values.has_pillion === "yes";
  const pillionName = personName.safeParse(values.pillion_name);
  if (hasPillion && !pillionName.success) errors.pillion_name = "Coloca o nome da garupa.";

  const emergencyName = personName.safeParse(values.emergency_name);
  if (!emergencyName.success) errors.emergency_name = "Coloca o nome de alguém pra avisar numa emergência.";
  const emergencyPhone = normalizeBrPhone(values.emergency_phone);
  if (!emergencyPhone) {
    errors.emergency_phone = "Coloca o telefone com DDD, ex.: (11) 99999-8888.";
  } else if (emergencyPhone === whatsapp) {
    errors.emergency_phone = "Coloca o telefone de outra pessoa, não o seu.";
  }

  if (values.terms !== "on") errors.terms = "Pra se inscrever, precisa aceitar o termo.";

  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_trip", {
    p_slug: slug,
    p_name: name.data!,
    p_whatsapp: whatsapp!,
    p_email: email.data!,
    p_bike: bike.data!,
    p_has_pillion: hasPillion,
    p_pillion_name: hasPillion ? pillionName.data! : null,
    p_emergency_name: emergencyName.data!,
    p_emergency_phone: emergencyPhone!,
    p_terms_accepted: true,
  });

  if (error) {
    const known = Object.keys(DB_ERRORS).find((code) => error.message.includes(code));
    if (known) return { errors: DB_ERRORS[known], values };
    console.error("register_for_trip", slug, error);
    return { errors: { form: "Não deu para enviar agora. Tenta de novo em instantes." }, values };
  }

  return { result: data as RegisterResult, values };
}
