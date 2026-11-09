import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { centsToInput, formatDateRangeBR } from "@/lib/format";
import { tripUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, shareMessage, type TripFormValues } from "@/lib/trips";
import type { TripStatus } from "@/types/database";
import { setTripStatus, updateTrip } from "../actions";
import { PhotoManager } from "../photo-manager";
import { ShareActions } from "../share-actions";
import { TripForm } from "../trip-form";

export const metadata: Metadata = { title: "Editar viagem" };

export default async function EditarViagemPage({
  params,
  searchParams,
}: PageProps<"/painel/viagens/[id]">) {
  const { user } = await requireOrganizer();
  const { id } = await params;
  const { nova } = await searchParams;

  const supabase = await createClient();
  // O RLS só devolve viagens do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select("*, trip_photos(id, storage_path, position)")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const photos = [...trip.trip_photos].sort((a, b) => a.position - b.position);

  const initial: TripFormValues = {
    title: trip.title,
    destination: trip.destination,
    description: trip.description,
    start_date: trip.start_date,
    end_date: trip.end_date,
    meeting_point: trip.meeting_point,
    meeting_point_url: trip.meeting_point_url ?? "",
    pricing_mode: trip.pricing_mode,
    price: trip.price_cents === null ? "" : centsToInput(trip.price_cents),
    level: trip.level,
    terrain: trip.terrain,
    capacity: String(trip.capacity),
    pix_key: trip.pix_key,
    terms_text: trip.terms_text,
  };

  return (
    <div className="space-y-6">
      <Link href="/painel" className="inline-flex min-h-12 items-center font-semibold text-brand">
        ← Voltar
      </Link>

      {nova && (
        <p className="rounded-xl bg-green-50 px-4 py-3 font-medium text-green-900" role="status">
          Viagem criada! 🎉 Agora adiciona umas fotos pra deixar a página bonita.
        </p>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight break-words">{trip.title}</h1>
        <StatusBadge status={trip.status} />
      </div>

      <StatusActions tripId={trip.id} status={trip.status} />

      {trip.status !== "draft" && (
        <ShareActions
          url={tripUrl(trip.slug)}
          message={shareMessage(
            trip.destination,
            formatDateRangeBR(trip.start_date, trip.end_date),
            tripUrl(trip.slug),
          )}
        />
      )}

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Fotos</h2>
          <p className="text-stone-600">
            Até 5 fotos. A primeira é a capa, que aparece na prévia do WhatsApp.
          </p>
        </div>
        <PhotoManager tripId={trip.id} organizerId={user.id} photos={photos} />
      </section>

      <TripForm
        action={updateTrip.bind(null, trip.id)}
        initial={initial}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: TripStatus }) {
  const colors: Record<TripStatus, string> = {
    draft: "bg-stone-200 text-stone-800",
    published: "bg-green-100 text-green-900",
    closed: "bg-amber-100 text-amber-900",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${colors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Botões para publicar, encerrar ou voltar a viagem para rascunho. */
function StatusActions({ tripId, status }: { tripId: string; status: TripStatus }) {
  const buttons: { to: TripStatus; label: string; primary?: boolean }[] =
    status === "draft"
      ? [{ to: "published", label: "Publicar e abrir inscrições", primary: true }]
      : status === "published"
        ? [
            { to: "closed", label: "Encerrar inscrições" },
            { to: "draft", label: "Voltar para rascunho" },
          ]
        : [{ to: "published", label: "Reabrir inscrições", primary: true }];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {buttons.map((b) => (
          <form key={b.to} action={setTripStatus.bind(null, tripId, b.to)}>
            <button type="submit" className={b.primary ? "btn-primary" : "btn-secondary"}>
              {b.label}
            </button>
          </form>
        ))}
      </div>
      {status === "draft" && (
        <p className="field-hint">
          Enquanto for rascunho, ninguém consegue ver nem se inscrever.
        </p>
      )}
    </div>
  );
}
