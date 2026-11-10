"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { parseBRL, slugify } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_PHOTOS,
  PHOTOS_BUCKET,
  TRIP_FIELDS,
  type TripField,
  type TripFormState,
  type TripFormValues,
} from "@/lib/trips";
import type { Database } from "@/types/database";

type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalTime = z.union([z.literal(""), time]);
const mapsUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(500)]);
const MAPS_ERROR = "Cola um link que comece com https:// (ex.: do Google Maps).";

const ERRORS: Record<TripField, string> = {
  title: "Dá um título para a viagem (de 3 a 100 letras).",
  destination: "Pra onde vocês vão? (de 2 a 80 letras)",
  description: "O roteiro pode ter até 5.000 letras.",
  start_date: "Escolhe a data de saída.",
  end_date: "Escolhe a data de volta (no mesmo dia da saída ou depois).",
  departure_point: "Diz de onde o grupo sai.",
  departure_point_url: MAPS_ERROR,
  departure_time: "Coloca o horário de saída.",
  return_point: "O local de retorno pode ter até 200 letras.",
  return_point_url: MAPS_ERROR,
  return_time: "Horário inválido.",
  pricing_mode: "Escolhe como fica o valor.",
  price: "Coloca o valor do piloto, ex.: 350 ou 1.250,00.",
  pillion_price: "Coloca o valor de piloto + garupa (igual ou maior que o do piloto), ou deixa vazio se não aceita garupa.",
  accepts_pillion: "Valor inválido.",
  level: "Escolhe o nível exigido.",
  terrain: "Escolhe o terreno predominante.",
  terrain_percent: "Coloca quanto % da viagem é nesse terreno (de 1 a 100).",
  capacity: "Quantas motos cabem? (de 1 a 500)",
  requires_plate: "Valor inválido.",
  pix_key: "Coloca a chave Pix (CPF, e-mail, telefone ou aleatória).",
  terms_text: "O termo precisa ter pelo menos algumas linhas.",
};

/** Lê e valida o formulário. Devolve os dados prontos para o banco ou os erros. */
function parseTrip(formData: FormData) {
  const values = Object.fromEntries(
    TRIP_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  ) as TripFormValues;

  const errors: TripFormState["errors"] = {};
  const check = <T>(field: TripField, schema: z.ZodType<T>, raw: string): T | undefined => {
    const result = schema.safeParse(raw);
    if (!result.success) errors[field] = ERRORS[field];
    return result.success ? result.data : undefined;
  };

  const title = check("title", z.string().trim().min(3).max(100), values.title);
  const destination = check("destination", z.string().trim().min(2).max(80), values.destination);
  const description = check("description", z.string().trim().max(5000), values.description);
  const start_date = check("start_date", isoDate, values.start_date);
  const end_date = check("end_date", isoDate, values.end_date);
  if (start_date && end_date && end_date < start_date) errors.end_date = ERRORS.end_date;

  const departure_point = check("departure_point", z.string().trim().min(3).max(200), values.departure_point);
  const departure_point_url = check("departure_point_url", mapsUrl, values.departure_point_url.trim());
  const departure_time = check("departure_time", time, values.departure_time);
  const return_point = check("return_point", z.string().trim().max(200), values.return_point);
  const return_point_url = check("return_point_url", mapsUrl, values.return_point_url.trim());
  const return_time = check("return_time", optionalTime, values.return_time);

  // Valor: piloto e piloto + garupa são valores fechados. Garupa vazia = não aceita garupa.
  const pricing_mode = check("pricing_mode", z.enum(["fixed", "split"]), values.pricing_mode);
  let price_cents: number | null = null;
  let pillion_price_cents: number | null = null;
  let accepts_pillion = values.accepts_pillion === "on";
  if (pricing_mode === "fixed") {
    price_cents = parseBRL(values.price);
    if (price_cents === null) errors.price = ERRORS.price;
    accepts_pillion = values.pillion_price.trim() !== "";
    if (accepts_pillion) {
      pillion_price_cents = parseBRL(values.pillion_price);
      if (pillion_price_cents === null || (price_cents !== null && pillion_price_cents < price_cents)) {
        errors.pillion_price = ERRORS.pillion_price;
      }
    }
  }

  const level = check("level", z.enum(["beginner", "intermediate", "experienced"]), values.level);
  const terrain = check("terrain", z.enum(["asphalt", "mixed", "offroad"]), values.terrain);
  const terrain_percent = check(
    "terrain_percent",
    z.coerce.number().int().min(1).max(100),
    values.terrain_percent,
  );
  const capacity = check("capacity", z.coerce.number().int().min(1).max(500), values.capacity);
  const requires_plate = values.requires_plate === "on";
  const pix_key = check("pix_key", z.string().trim().min(3).max(140), values.pix_key);
  const terms_text = check("terms_text", z.string().trim().min(20).max(10000), values.terms_text);

  if (Object.keys(errors).length > 0) return { values, errors } as const;

  const data = {
    title: title!,
    destination: destination!,
    description: description!,
    start_date: start_date!,
    end_date: end_date!,
    departure_point: departure_point!,
    departure_point_url: departure_point_url || null,
    departure_time: departure_time!,
    return_point: return_point || null,
    return_point_url: return_point_url || null,
    return_time: return_time || null,
    pricing_mode: pricing_mode!,
    price_cents,
    accepts_pillion,
    pillion_price_cents,
    level: level!,
    terrain: terrain!,
    terrain_percent: terrain_percent!,
    capacity: capacity!,
    requires_plate,
    pix_key: pix_key!,
    terms_text: terms_text!,
  } satisfies Omit<TripInsert, "organizer_id" | "slug">;

  return { values, data } as const;
}

const FORM_ERROR = "Não deu para salvar agora. Tenta de novo.";
const SUSPENDED_ERROR =
  "Sua conta está suspensa pela administração da Routa: não dá para criar nem editar viagens.";

export async function createTrip(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const { user } = await requireOrganizer();
  const parsed = parseTrip(formData);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };

  const supabase = await createClient();
  const base = slugify(parsed.data.destination) || slugify(parsed.data.title) || "viagem";

  // O sufixo aleatório deixa o link único. Se mesmo assim colidir, tenta outro.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = `${base}-${randomBytes(3).toString("hex")}`;
    const { data, error } = await supabase
      .from("trips")
      .insert({ ...parsed.data, organizer_id: user.id, slug })
      .select("id")
      .single();

    if (!error) {
      revalidatePath("/painel");
      redirect(`/painel/viagens/${data.id}?nova=1`);
    }
    if (error.message.includes("organizer_suspended")) {
      return { errors: { form: SUSPENDED_ERROR }, values: parsed.values };
    }
    if (error.code !== "23505") break;
  }

  return { errors: { form: FORM_ERROR }, values: parsed.values };
}

export async function updateTrip(
  tripId: string,
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  await requireOrganizer();
  const parsed = parseTrip(formData);
  if (!parsed.data) return { errors: parsed.errors, values: parsed.values };

  // Os botões de status (Publicar, Encerrar…) enviam o formulário inteiro com next_status:
  // assim o que foi mudado nos campos é salvo junto, nunca perdido.
  const nextStatus = z
    .enum(["draft", "published", "closed"])
    .optional()
    .catch(undefined)
    .parse(formData.get("next_status") ?? undefined);

  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update(nextStatus ? { ...parsed.data, status: nextStatus } : parsed.data)
    .eq("id", tripId)
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("organizer_suspended")) {
      return { errors: { form: SUSPENDED_ERROR }, values: parsed.values };
    }
    if (error.message.includes("capacity_below_confirmed")) {
      return {
        errors: {
          capacity:
            "Já tem mais gente confirmada do que esse número de vagas. Remova inscritos antes de diminuir.",
        },
        values: parsed.values,
      };
    }
    return { errors: { form: FORM_ERROR }, values: parsed.values };
  }

  revalidatePath("/painel");
  revalidatePath(`/painel/viagens/${tripId}`);
  return { saved: true, values: parsed.values };
}

// =====================================================================
// Fotos
// O navegador sobe o arquivo direto no Storage (sem passar pelo servidor do Next)
// e depois chama addPhoto para registrar a foto na viagem.
// =====================================================================

export type PhotoResult = { error?: string };

export async function addPhoto(tripId: string, storagePath: string): Promise<PhotoResult> {
  const { user } = await requireOrganizer();
  // Só aceita arquivos na pasta desta viagem, do próprio organizador.
  const prefix = `${user.id}/${tripId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.slice(prefix.length).includes("/")) {
    return { error: "Arquivo inválido." };
  }

  const supabase = await createClient();
  const { data: photos, error: listError } = await supabase
    .from("trip_photos")
    .select("position")
    .eq("trip_id", tripId);
  if (listError) return { error: FORM_ERROR };

  const used = new Set(photos.map((p) => p.position));
  const position = [...Array(MAX_PHOTOS).keys()].find((p) => !used.has(p));
  if (position === undefined) return { error: `A viagem já tem ${MAX_PHOTOS} fotos.` };

  // Se a viagem não for deste organizador, o RLS recusa o insert.
  const { error } = await supabase
    .from("trip_photos")
    .insert({ trip_id: tripId, storage_path: storagePath, position });
  if (error) return { error: FORM_ERROR };

  revalidatePath(`/painel/viagens/${tripId}`);
  return {};
}

export async function removePhoto(photoId: string): Promise<PhotoResult> {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: photo, error } = await supabase
    .from("trip_photos")
    .delete()
    .eq("id", photoId)
    .select("trip_id, storage_path")
    .single();
  if (error) return { error: "Não deu para remover a foto. Tenta de novo." };

  // Se apagar o arquivo falhar, a foto já saiu da viagem; o arquivo só fica órfão.
  await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);

  revalidatePath(`/painel/viagens/${photo.trip_id}`);
  return {};
}

/** Põe a foto na posição 0 (capa), trocando de lugar com a capa atual. */
export async function setCoverPhoto(photoId: string): Promise<PhotoResult> {
  await requireOrganizer();
  const supabase = await createClient();
  const fail = { error: "Não deu para trocar a capa. Tenta de novo." };

  const { data: photo } = await supabase
    .from("trip_photos")
    .select("id, trip_id, storage_path, position")
    .eq("id", photoId)
    .single();
  if (!photo) return fail;
  if (photo.position === 0) return {};

  const { data: cover } = await supabase
    .from("trip_photos")
    .select("id, trip_id, storage_path, position")
    .eq("trip_id", photo.trip_id)
    .eq("position", 0)
    .maybeSingle();

  if (!cover) {
    const { error } = await supabase.from("trip_photos").update({ position: 0 }).eq("id", photo.id);
    if (error) return fail;
  } else {
    // (trip_id, position) é único e as 5 posições podem estar ocupadas,
    // então a troca é feita apagando as duas linhas e inserindo de novo.
    const { error: delError } = await supabase
      .from("trip_photos")
      .delete()
      .in("id", [photo.id, cover.id]);
    if (delError) return fail;
    const { error: insError } = await supabase.from("trip_photos").insert([
      { ...photo, position: 0 },
      { ...cover, position: photo.position },
    ]);
    if (insError) {
      // Volta como estava.
      await supabase.from("trip_photos").insert([photo, cover]);
      return fail;
    }
  }

  revalidatePath(`/painel/viagens/${photo.trip_id}`);
  return {};
}
