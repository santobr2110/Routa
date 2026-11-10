import type { Metadata } from "next";
import Link from "next/link";
import { CompassIcon } from "@/components/logo";
import { requireOrganizer } from "@/lib/auth";
import { daysUntil, sealState } from "@/lib/cadastur";
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

  // Contagem por viagem: confirmados e lista de espera (o RLS só devolve as do organizador).
  const { data: regs } = await supabase
    .from("registrations")
    .select("trip_id, status")
    .neq("status", "cancelled");
  const counts = new Map<string, { confirmed: number; waitlist: number }>();
  for (const r of regs ?? []) {
    const c = counts.get(r.trip_id) ?? { confirmed: 0, waitlist: 0 };
    if (r.status === "confirmed") c.confirmed++;
    else c.waitlist++;
    counts.set(r.trip_id, c);
  }

  // Aviso do selo Cadastur vencendo ou vencido (sem pedido de renovação em análise).
  const { data: seals } = await supabase
    .from("cadastur_verifications")
    .select("status, valid_until")
    .in("status", ["approved", "pending"]);
  const latestSeal = (seals ?? [])
    .filter((v) => v.status === "approved")
    .sort((a, b) => b.valid_until.localeCompare(a.valid_until))[0];
  const renewing = (seals ?? []).some((v) => v.status === "pending");
  const sealWarning =
    latestSeal && !renewing && sealState(latestSeal.valid_until) !== "valid"
      ? daysUntil(latestSeal.valid_until)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">E aí, {firstName}!</h1>
        <Link href="/painel/viagens/nova" className="btn-primary">
          + Criar viagem
        </Link>
      </div>

      {organizer.suspended_at && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 font-medium text-danger" role="alert">
          🚫 Sua conta está suspensa pela administração da Routa. Suas viagens estão fora do ar e
          você não pode criar nem editar viagens. Motivo: {organizer.suspended_reason}. Para falar
          com a gente, responda o contato da Routa.
        </p>
      )}

      {sealWarning !== null && (
        <Link
          href="/painel/perfil"
          className="block rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn"
        >
          {sealWarning >= 0
            ? `Seu selo Cadastur vence em ${sealWarning} dia(s). Toque aqui para enviar o certificado renovado.`
            : "Seu selo Cadastur venceu e saiu das suas viagens. Toque aqui para renovar."}
        </Link>
      )}


      {trips.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <CompassIcon className="h-12 w-12 text-faint" />
          <h2 className="section-title">Nenhuma viagem por aqui ainda</h2>
          <p className="max-w-sm text-muted">
            Cria sua primeira viagem e manda o link pro grupo. Leva poucos minutos.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="section-title">Suas viagens</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => {
              const cover = [...trip.trip_photos].sort((a, b) => a.position - b.position)[0];
              const count = counts.get(trip.id);
              return (
                <li key={trip.id}>
                  <Link
                    href={`/painel/viagens/${trip.id}`}
                    className="card flex h-full items-center gap-4 p-3 transition-colors hover:border-line-hover"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl(cover.storage_path)}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                        <CompassIcon className="h-8 w-8 text-faint" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{trip.title}</span>
                      <span className="block text-sm text-muted">
                        {formatDateBR(trip.start_date)}
                        {trip.end_date !== trip.start_date && ` a ${formatDateBR(trip.end_date)}`}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {STATUS_LABELS[trip.status]}
                        {count &&
                          ` · ${count.confirmed} ${count.confirmed === 1 ? "confirmado" : "confirmados"}` +
                            (count.waitlist ? ` · ${count.waitlist} na fila` : "")}
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
