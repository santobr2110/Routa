"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { canonicalBrand, maxBikeYear, normalizePlate } from "@/lib/bikes";
import {
  convoyOn,
  parseConvoyForm,
  profileRpcArgs,
  type ConvoyField,
  type ConvoyProfile,
} from "@/lib/convoy";
import { emailEnabled, registrationEmail, sendEmail } from "@/lib/email";
import { formatDateRangeBR, normalizeBrPhone } from "@/lib/format";
import { getPublicTrip } from "@/lib/public-trip";
import { clientIp, hashIp, signRegistration, verifyTurnstile } from "@/lib/registration-guard";
import { registrationUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { PricingMode } from "@/types/database";

export type RegisterField =
  | "name"
  | "whatsapp"
  | "email"
  | "bike_brand"
  | "bike_model"
  | "bike_year"
  | "bike_color"
  | "bike_plate"
  | "has_pillion"
  | "pillion_name"
  | "emergency_name"
  | "emergency_phone"
  | "terms";

export type RegisterValues = Record<RegisterField, string>;
type ErrorKey = RegisterField | ConvoyField | "form";

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
  /** Link de pagamento com cartão do organizador (migration 0010), só para confirmados. */
  card?: { url: string; amount_cents: number | null } | null;
  /** Prazo para pagar (migration 0011), só para confirmados em viagem com prazo. */
  payment_due_at?: string | null;
  /** Token do link pessoal /i/{token} (migration 0013). */
  access_token?: string | null;
};

export type RegisterState = {
  errors?: Partial<Record<ErrorKey, string>>;
  values?: RegisterValues;
  /** Respostas do Raio-X, para preencher de novo quando há erro. */
  convoy?: ConvoyProfile;
  result?: RegisterResult;
  /** Muda a cada envio, para o anti-robô gerar um token novo (cada token vale uma vez). */
  attempt?: number;
};

const FIELDS: RegisterField[] = [
  "name",
  "whatsapp",
  "email",
  "bike_brand",
  "bike_model",
  "bike_year",
  "bike_color",
  "bike_plate",
  "has_pillion",
  "pillion_name",
  "emergency_name",
  "emergency_phone",
  "terms",
];

const personName = z.string().trim().min(2).max(80);

const RETRY = "Não deu para enviar agora. Recarrega a página e tenta de novo.";

/** Erros que a função do banco pode levantar, em português. */
const DB_ERRORS: Record<string, Partial<Record<ErrorKey, string>>> = {
  already_registered: {
    whatsapp: "Esse WhatsApp já está inscrito nesta viagem. Fala com o organizador se precisar mudar algo.",
  },
  trip_not_open: { form: "As inscrições desta viagem fecharam." },
  pillion_not_accepted: { has_pillion: "Esta viagem não aceita garupa." },
  terms_not_accepted: { terms: "Pra se inscrever, precisa aceitar o termo." },
  plate_required: { bike_plate: "Coloca a placa da moto, ex.: ABC1D23 ou ABC-1234." },
  rate_limited: {
    form: "Muitas inscrições seguidas deste aparelho. Espera uns minutos e tenta de novo.",
  },
  invalid_proof: { form: RETRY },
};

export async function registerForTrip(
  slug: string,
  prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const attempt = (prev.attempt ?? 0) + 1;
  const values = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  ) as RegisterValues;
  // Raio-X do comboio: perguntas que o organizador ligou nesta viagem.
  const publicTrip = await getPublicTrip(slug);
  const convoySettings = convoyOn(publicTrip?.convoy) ? publicTrip!.convoy! : null;
  const convoy = convoySettings
    ? parseConvoyForm(formData, convoySettings, { brand: values.bike_brand, model: values.bike_model })
    : null;
  const fail = (errors: RegisterState["errors"]): RegisterState => ({
    errors,
    values,
    attempt,
    convoy: convoy?.profile,
  });

  const errors: RegisterState["errors"] = { ...convoy?.errors };
  const name = personName.safeParse(values.name);
  if (!name.success) errors.name = "Coloca seu nome (de 2 a 80 letras).";
  const whatsapp = normalizeBrPhone(values.whatsapp);
  if (!whatsapp) errors.whatsapp = "Coloca o WhatsApp com DDD, ex.: (11) 99999-8888.";
  const email = z.email().max(200).safeParse(values.email.trim());
  if (!email.success) errors.email = "Coloca um e-mail válido, ex.: voce@exemplo.com.";

  // Ficha da moto.
  const brand = z.string().trim().min(2).max(40).safeParse(values.bike_brand);
  if (!brand.success) errors.bike_brand = "Qual a marca da moto? Ex.: Honda.";
  const model = z.string().trim().min(1).max(60).safeParse(values.bike_model);
  if (!model.success) errors.bike_model = "Qual o modelo? Ex.: XRE 300.";
  let year: number | null = null;
  if (values.bike_year.trim() !== "") {
    const parsed = z.coerce.number().int().min(1950).max(maxBikeYear()).safeParse(values.bike_year);
    if (parsed.success) year = parsed.data;
    else errors.bike_year = `Coloca o ano com 4 números, de 1950 a ${maxBikeYear()}.`;
  }
  const color = values.bike_color.trim();
  if (color && (color.length < 2 || color.length > 30)) {
    errors.bike_color = "A cor pode ter de 2 a 30 letras.";
  }
  // A placa só vale quando a viagem pede (o banco confere de novo e descarta se não pediu).
  let plate: string | null = null;
  if (values.bike_plate.trim() !== "") {
    plate = normalizePlate(values.bike_plate);
    if (!plate) errors.bike_plate = "Placa inválida. Ex.: ABC1D23 ou ABC-1234.";
  }

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

  if (Object.keys(errors).length > 0) return fail(errors);

  // Anti-robô: confere o Turnstile e assina a inscrição para o banco aceitar.
  const ip = clientIp(await headers());
  const human = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
  if (!human) {
    return fail({ form: "Não conseguimos confirmar que você não é um robô. Tenta de novo." });
  }

  let ipHash: string | null;
  let proof: { issuedAt: number; proof: string };
  try {
    ipHash = hashIp(ip);
    proof = signRegistration(slug, whatsapp!, ipHash);
  } catch (error) {
    console.error("register_for_trip: proteção não configurada", error);
    return fail({ form: RETRY });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_trip", {
    p_slug: slug,
    p_name: name.data!,
    p_whatsapp: whatsapp!,
    p_email: email.data!,
    p_bike_brand: canonicalBrand(brand.data!),
    p_bike_model: model.data!,
    p_bike_year: year,
    p_bike_color: color || null,
    p_bike_plate: plate,
    p_has_pillion: hasPillion,
    p_pillion_name: hasPillion ? pillionName.data! : null,
    p_emergency_name: emergencyName.data!,
    p_emergency_phone: emergencyPhone!,
    p_terms_accepted: true,
    p_ip_hash: ipHash,
    p_issued_at: proof.issuedAt,
    p_proof: proof.proof,
  });

  if (error) {
    const known = Object.keys(DB_ERRORS).find((code) => error.message.includes(code));
    if (known) {
      if (known === "invalid_proof") console.error("register_for_trip: prova recusada", slug);
      return fail(DB_ERRORS[known]);
    }
    console.error("register_for_trip", slug, error);
    return fail({ form: "Não deu para enviar agora. Tenta de novo em instantes." });
  }

  const result = data as RegisterResult;
  // Respostas do Raio-X: gravadas com o token do link pessoal. Se falhar, a inscrição vale
  // e a pessoa completa depois pela página dela.
  if (convoy && result.access_token) {
    const { error: convoyError } = await supabase.rpc(
      "save_convoy_profile",
      profileRpcArgs(result.access_token, convoy.profile),
    );
    if (convoyError) console.error("save_convoy_profile", slug, convoyError);
  }
  // E-mail com o link da página do inscrito (só se o serviço de e-mail estiver configurado).
  if (result.access_token && emailEnabled()) {
    const trip = publicTrip;
    if (trip) {
      const message = registrationEmail({
        name: name.data!,
        tripTitle: trip.title,
        dates: formatDateRangeBR(trip.start_date, trip.end_date),
        organizerName: result.organizer_name,
        status: result.status,
        link: registrationUrl(result.access_token),
      });
      await sendEmail({ to: email.data!, ...message });
    }
  }

  return { result, values, attempt };
}
