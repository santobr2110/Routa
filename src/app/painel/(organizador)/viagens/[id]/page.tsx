import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { centsToInput, formatDateRangeBR } from "@/lib/format";
import { tripUrl } from "@/lib/site";
import { TRASH_DAYS } from "@/lib/trash";
import { createClient } from "@/lib/supabase/server";
import { shareMessage, type TripFormValues } from "@/lib/trips";
import type { TripStatus } from "@/types/database";
import { DeleteTripForm } from "@/components/delete-trip-form";
import { updateTrip } from "../actions";
import { PhotoManager } from "../photo-manager";
import { ShareActions } from "../share-actions";
import { TRIP_FORM_ID, TripForm } from "../trip-form";
import { TripHeader } from "../trip-header";
import { deleteTrip } from "./delete-actions";

export const metadata: Metadata = { title: "Editar viagem" };

export default async function EditarViagemPage({
  params,
  searchParams,
}: PageProps<"/painel/viagens/[id]">) {
  const { user } = await requireOrganizer();
  const { id } = await params;
  const { nova, restaurada } = await searchParams;

  const supabase = await createClient();
  // O RLS só devolve viagens do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select("*, trip_photos(id, storage_path, position)")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  // Inscritos (para avisar antes de mudar e para o resumo da exclusão) e avisos do mural.
  const [{ data: regs }, { count: updatesCount }] = await Promise.all([
    supabase.from("registrations").select("status, payment_status").eq("trip_id", trip.id),
    supabase
      .from("trip_updates")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", trip.id),
  ]);
  const confirmed = (regs ?? []).filter((r) => r.status === "confirmed");
  const paidCount = confirmed.filter((r) => r.payment_status === "paid").length;
  const waitlistCount = (regs ?? []).filter((r) => r.status === "waitlist").length;
  const activeRegistrations = confirmed.length + waitlistCount;

  const photos = [...trip.trip_photos].sort((a, b) => a.position - b.position);

  const initial: TripFormValues = {
    title: trip.title,
    destination: trip.destination,
    description: trip.description,
    start_date: trip.start_date,
    end_date: trip.end_date,
    departure_point: trip.departure_point,
    departure_point_url: trip.departure_point_url ?? "",
    departure_time: trip.departure_time?.slice(0, 5) ?? "",
    return_point: trip.return_point ?? "",
    return_point_url: trip.return_point_url ?? "",
    return_time: trip.return_time?.slice(0, 5) ?? "",
    pricing_mode: trip.pricing_mode,
    price: trip.price_cents === null ? "" : centsToInput(trip.price_cents),
    pillion_price:
      trip.pillion_price_cents === null ? "" : centsToInput(trip.pillion_price_cents),
    accepts_pillion: trip.accepts_pillion ? "on" : "",
    level: trip.level,
    terrain: trip.terrain,
    terrain_percent: String(trip.terrain_percent),
    capacity: String(trip.capacity),
    requires_plate: trip.requires_plate ? "on" : "",
    pix_key: trip.pix_key,
    payment_deadline_hours:
      trip.payment_deadline_hours === null ? "" : String(trip.payment_deadline_hours),
    payment_deadline_action: trip.payment_deadline_action,
    convoy_range: trip.convoy_range,
    convoy_experience: trip.convoy_experience,
    convoy_skills: trip.convoy_skills,
    longest_stretch_km: trip.longest_stretch_km === null ? "" : String(trip.longest_stretch_km),
    card_enabled: trip.card_enabled ? "on" : "",
    card_url: trip.card_url ?? "",
    card_pillion_url: trip.card_pillion_url ?? "",
    card_price: trip.card_price_cents === null ? "" : centsToInput(trip.card_price_cents),
    card_pillion_price:
      trip.card_pillion_price_cents === null ? "" : centsToInput(trip.card_pillion_price_cents),
    terms_text: trip.terms_text,
  };

  return (
    <div className="space-y-6">
      <TripHeader trip={trip} current="editar" inscritos={activeRegistrations ?? 0} />

      {nova && (
        <p className="rounded-xl bg-success-soft px-4 py-3 font-medium text-success" role="status">
          Viagem criada! 🎉 Agora adiciona umas fotos pra deixar a página bonita.
        </p>
      )}

      {restaurada && (
        <p className="rounded-xl bg-success-soft px-4 py-3 font-medium text-success" role="status">
          Viagem restaurada da lixeira, com inscritos, fotos e avisos.
          {trip.status !== "draft" && " A página e as inscrições voltaram como estavam."}
        </p>
      )}

      <StatusActions status={trip.status} />

      {!!activeRegistrations && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn" role="note">
          Esta viagem já tem {activeRegistrations}{" "}
          {activeRegistrations === 1 ? "inscrito" : "inscritos"}. Se mudar valor, datas, saída,
          garupa ou termo, avise o grupo pelo WhatsApp.
        </p>
      )}

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

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="space-y-1">
          <h2 className="section-title">Fotos</h2>
          <p className="text-muted">
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

      <section className="space-y-3 border-t border-line pt-6" aria-labelledby="zona-perigo">
        <div className="space-y-1">
          <h2 id="zona-perigo" className="section-title text-danger">
            Excluir viagem
          </h2>
          <p className="text-sm text-muted">
            Para quando a viagem não vai mais acontecer ou foi criada por engano. Ela vai para a
            lixeira e dá para restaurar por {TRASH_DAYS} dias.
          </p>
        </div>
        <DeleteTripForm
          action={deleteTrip.bind(null, trip.id)}
          summary={deleteSummary({
            confirmed: confirmed.length,
            paid: paidCount,
            waitlist: waitlistCount,
            photos: photos.length,
            updates: updatesCount ?? 0,
          })}
          consequences={[
            "A página da viagem sai do ar e as inscrições fecham na hora.",
            "Ela some do seu painel, da página do clube e dos números.",
            "Quem já se inscreveu e abrir o link pessoal vê que a viagem foi excluída, sem os dados de pagamento. Avise o grupo pelo WhatsApp.",
            ...(paidCount > 0
              ? [`${paidCount} ${paidCount === 1 ? "pessoa já pagou" : "pessoas já pagaram"}: a devolução é com você, fora da Routa.`]
              : []),
          ]}
          spreadsheetHref={
            regs && regs.length > 0 ? `/painel/viagens/${trip.id}/inscritos/planilha` : undefined
          }
        />
      </section>
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "4 confirmados (2 pagos), 1 na fila, 3 fotos e 2 avisos". */
function deleteSummary(c: {
  confirmed: number;
  paid: number;
  waitlist: number;
  photos: number;
  updates: number;
}) {
  const parts = [
    `${plural(c.confirmed, "confirmado", "confirmados")}${c.confirmed > 0 ? ` (${plural(c.paid, "pago", "pagos")})` : ""}`,
    `${c.waitlist} na fila`,
    plural(c.photos, "foto", "fotos"),
    plural(c.updates, "aviso no mural", "avisos no mural"),
  ];
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/**
 * Botões para publicar, encerrar ou voltar para rascunho. Eles enviam o formulário da
 * viagem (atributo form) com next_status: o que foi mudado nos campos é salvo junto.
 */
function StatusActions({ status }: { status: TripStatus }) {
  const buttons: { to: TripStatus; label: string; primary?: boolean }[] =
    status === "draft"
      ? [{ to: "published", label: "Salvar e publicar", primary: true }]
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
          <button
            key={b.to}
            type="submit"
            form={TRIP_FORM_ID}
            name="next_status"
            value={b.to}
            className={b.primary ? "btn-primary" : "btn-secondary"}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="field-hint">
        {status === "draft" && "Enquanto for rascunho, ninguém consegue ver nem se inscrever. "}
        Estes botões também salvam o que você mudou no formulário.
      </p>
    </div>
  );
}
