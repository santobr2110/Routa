import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { formatBRL, formatDateRangeBR } from "@/lib/format";
import { amountDue } from "@/lib/registrations";
import { createClient } from "@/lib/supabase/server";
import { TripHeader } from "../../trip-header";
import { MessageCenter, type CenterPerson } from "./message-center";

export const metadata: Metadata = { title: "Cobrança e avisos" };

export default async function CobrancaPage({ params }: PageProps<"/painel/viagens/[id]/cobranca">) {
  const { organizer } = await requireOrganizer();
  const { id } = await params;

  const supabase = await createClient();
  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, title, status, start_date, end_date, destination, pricing_mode, price_cents, pillion_price_cents, pix_key, departure_point, departure_point_url, departure_time",
    )
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: regs, error } = await supabase
    .from("registrations")
    .select("id, name, whatsapp, has_pillion, status, payment_status")
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    .order("created_at");
  if (error) throw error;

  const people: CenterPerson[] = regs.map((r) => ({
    id: r.id,
    name: r.name,
    whatsapp: r.whatsapp,
    status: r.status as CenterPerson["status"],
    paid: r.payment_status === "paid",
    amountCents: amountDue(trip, r.has_pillion),
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
        }}
        people={people}
      />
    </div>
  );
}
