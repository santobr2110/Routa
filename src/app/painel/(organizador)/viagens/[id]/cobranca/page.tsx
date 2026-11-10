import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { formatBRL, formatDateRangeBR, formatDateTimeBR } from "@/lib/format";
import { convoyOn } from "@/lib/convoy";
import { amountDue, isOverdue } from "@/lib/registrations";
import { registrationUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { TripHeader } from "../../trip-header";
import { deleteTripUpdate } from "./actions";
import { MessageCenter, type CenterPerson } from "./message-center";
import { UpdateForm } from "./update-form";

export const metadata: Metadata = { title: "Cobrança e avisos" };

export default async function CobrancaPage({
  params,
  searchParams,
}: PageProps<"/painel/viagens/[id]/cobranca">) {
  const { organizer } = await requireOrganizer();
  const { id } = await params;
  const { modelo } = await searchParams;

  const supabase = await createClient();
  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, title, status, start_date, end_date, destination, pricing_mode, price_cents, pillion_price_cents, pix_key, departure_point, departure_point_url, departure_time, card_enabled, card_url, card_pillion_url, card_price_cents, card_pillion_price_cents, convoy_range, convoy_experience, convoy_skills",
    )
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: regs, error } = await supabase
    .from("registrations")
    .select("id, name, whatsapp, has_pillion, status, payment_status, payment_due_at, access_token")
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    .order("queued_at")
    .order("created_at");
  if (error) throw error;

  // Quem já respondeu o Raio-X do comboio.
  const { data: answered } = regs.length
    ? await supabase
        .from("convoy_profiles")
        .select("registration_id")
        .in("registration_id", regs.map((r) => r.id))
    : { data: [] };
  const answeredIds = new Set((answered ?? []).map((a) => a.registration_id));

  const { data: updates } = await supabase
    .from("trip_updates")
    .select("id, body, created_at")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: false });

  // Mesmo critério da inscrição (register_for_trip): dupla usa o link e o valor da dupla.
  const cardFor = (hasPillion: boolean): CenterPerson["card"] => {
    if (!trip.card_enabled || !trip.card_url) return null;
    const fixed = trip.pricing_mode === "fixed";
    return {
      url: hasPillion ? (trip.card_pillion_url ?? trip.card_url) : trip.card_url,
      amountCents: !fixed
        ? null
        : hasPillion
          ? (trip.card_pillion_price_cents ?? trip.pillion_price_cents)
          : (trip.card_price_cents ?? trip.price_cents),
    };
  };
  const people: CenterPerson[] = regs.map((r) => ({
    id: r.id,
    name: r.name,
    whatsapp: r.whatsapp,
    status: r.status as CenterPerson["status"],
    paid: r.payment_status === "paid",
    amountCents: amountDue(trip, r.has_pillion),
    card: cardFor(r.has_pillion),
    dueAt: r.status === "confirmed" && r.payment_status === "pending" ? r.payment_due_at : null,
    overdue: isOverdue(r),
    link: registrationUrl(r.access_token),
    convoyAnswered: answeredIds.has(r.id),
  }));
  const pending = people.filter((p) => p.status === "confirmed" && !p.paid);
  const pendingCents = pending.reduce((s, p) => s + (p.amountCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <TripHeader trip={trip} current="cobranca" inscritos={people.length} />

      <p className="text-sm text-ink-soft">
        {pending.length === 0
          ? "Todos os confirmados já pagaram."
          : `${pending.length} confirmado(s) sem pagamento marcado${
              trip.pricing_mode === "fixed" ? `, ${formatBRL(pendingCents)} a receber` : ""
            }.`}
      </p>

      <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="space-y-1">
          <h2 className="section-title">Mural da viagem</h2>
          <p className="text-sm text-muted">
            Avisos que ficam na página de cada inscrito (o link vai nas mensagens).
          </p>
        </div>
        <div className="space-y-4">
          <UpdateForm tripId={trip.id} />
          {(updates ?? []).length > 0 && (
            <ol className="divide-y divide-line rounded-lg border border-line">
              {(updates ?? []).map((u) => (
                <li key={u.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-muted">{formatDateTimeBR(u.created_at)}</p>
                    <p className="text-sm break-words whitespace-pre-line">{u.body}</p>
                  </div>
                  <form action={deleteTripUpdate.bind(null, trip.id, u.id)}>
                    <button
                      type="submit"
                      className="inline-flex min-h-9 shrink-0 items-center px-2 text-sm text-muted hover:text-danger"
                    >
                      Apagar
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <MessageCenter
        trip={{
          id: trip.id,
          title: trip.title,
          dates: formatDateRangeBR(trip.start_date, trip.end_date),
          fixed: trip.pricing_mode === "fixed",
          pixKey: trip.pix_key,
          organizerName: organizer.name,
          departurePoint: trip.departure_point,
          departureUrl: trip.departure_point_url,
          departureTime: trip.departure_time,
          acceptsCard: trip.card_enabled && !!trip.card_url,
          convoy: convoyOn({
            range: trip.convoy_range,
            experience: trip.convoy_experience,
            skills: trip.convoy_skills,
            longest_stretch_km: null,
          }),
        }}
        people={people}
        initialTemplate={modelo === "raiox" ? "raiox" : undefined}
      />
    </div>
  );
}
