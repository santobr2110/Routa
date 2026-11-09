import type { Metadata } from "next";
import Link from "next/link";
import { CompassIcon } from "@/components/logo";
import { requireOrganizer } from "@/lib/auth";
import { formatDateBR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, photoUrl } from "@/lib/trips";

export const metadata: Metadata = { title: "Painel" };

export default async function PainelPage() {
  const { organizer } = await requireOrganizer();
  const firstName = organizer.name.split(" ")[0];

  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status, trip_photos(storage_path, position)")
    .order("start_date", { ascending: false });
  if (error) throw error;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">E aí, {firstName}! 🏍️</h1>

      <Link href="/painel/viagens/nova" className="btn-primary">
        + Criar viagem
      </Link>

      {trips.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <CompassIcon className="h-12 w-12 text-stone-400" />
          <h2 className="text-xl font-bold">Nenhuma viagem por aqui ainda</h2>
          <p className="max-w-sm text-stone-600">
            Cria sua primeira viagem e manda o link pro grupo. Leva poucos minutos.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Suas viagens</h2>
          <ul className="space-y-3">
            {trips.map((trip) => {
              const cover = [...trip.trip_photos].sort((a, b) => a.position - b.position)[0];
              return (
                <li key={trip.id}>
                  <Link
                    href={`/painel/viagens/${trip.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-3 hover:border-stone-400"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl(cover.storage_path)}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                        <CompassIcon className="h-8 w-8 text-stone-400" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-bold">{trip.title}</span>
                      <span className="block text-stone-600">
                        {formatDateBR(trip.start_date)}
                        {trip.end_date !== trip.start_date && ` a ${formatDateBR(trip.end_date)}`}
                      </span>
                      <span className="block text-sm font-semibold text-stone-700">
                        {STATUS_LABELS[trip.status]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
