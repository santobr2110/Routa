import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { loadOrganizerData } from "@/lib/organizer-data";
import { tripNumbers } from "@/lib/organizer-stats";
import { TripHeader } from "../../trip-header";
import { TripNumbersView } from "./view";

export const metadata: Metadata = { title: "Números da viagem" };

export default async function NumerosPage({ params }: PageProps<"/painel/viagens/[id]/numeros">) {
  await requireOrganizer();
  const { id } = await params;
  // O RLS só devolve as viagens e inscrições do próprio organizador.
  const { trips, regs } = await loadOrganizerData();
  const trip = trips.find((t) => t.id === id);
  if (!trip) notFound();
  const numbers = tripNumbers(trip, regs);

  return (
    <div className="space-y-6">
      <TripHeader
        trip={trip}
        current="numeros"
        inscritos={numbers.confirmed + numbers.waitlist}
      />
      <TripNumbersView n={numbers} />
    </div>
  );
}
