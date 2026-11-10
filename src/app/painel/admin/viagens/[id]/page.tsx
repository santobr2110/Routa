import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin, type AdminTripDetail } from "@/lib/admin";
import { formatBRL, formatBrPhone, formatDateRangeBR, formatDateTimeBR } from "@/lib/format";
import { tripUrl } from "@/lib/site";
import { LEVEL_LABELS, STATUS_LABELS, TERRAIN_LABELS } from "@/lib/trips";
import type { TripLevel, TripTerrain } from "@/types/database";
import { AuditList } from "../../audit-list";
import { ReasonForm } from "../../reason-form";
import { ResultMessage } from "../../result-message";
import { Badge, Stat } from "../../stat";
import { setTripHidden } from "./actions";

export const metadata: Metadata = { title: "Admin · Viagem", robots: { index: false } };

const REG_STATUS = { confirmed: "Confirmado", waitlist: "Na fila", cancelled: "Cancelado" } as const;

export default async function AdminViagemPage({
  params,
  searchParams,
}: PageProps<"/painel/admin/viagens/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { resultado } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data, error } = await supabase.rpc("admin_trip_detail", { p_trip_id: id });
  if (error) throw error;
  if (!data) notFound();
  const { trip, organizer, registrations, audit } = data as unknown as AdminTripDetail;

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const paid = confirmed.filter((r) => r.payment_status === "paid");
  const sum = (rows: typeof registrations) => rows.reduce((total, r) => total + (r.amount ?? 0), 0);
  const fixed = trip.pricing_mode === "fixed";
  const isPublic = trip.status !== "draft" && !trip.admin_hidden_at && !organizer.suspended_at;

  return (
    <div className="space-y-6">
      <Link href="/painel/admin/viagens" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Viagens
      </Link>

      <ResultMessage code={resultado} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight break-words">{trip.title}</h1>
          <Badge tone={trip.status === "published" ? "success" : "muted"}>{STATUS_LABELS[trip.status]}</Badge>
          {trip.admin_hidden_at && <Badge tone="danger">🙈 Fora do ar</Badge>}
        </div>
        <p className="text-lg text-ink-soft">
          {trip.destination} · {formatDateRangeBR(trip.start_date, trip.end_date)}
        </p>
        <p className="text-muted">
          {LEVEL_LABELS[trip.level as TripLevel] ?? trip.level} · {TERRAIN_LABELS[trip.terrain as TripTerrain] ?? trip.terrain}
          {" · "}
          {fixed
            ? `${formatBRL(trip.price_cents ?? 0)} piloto${trip.pillion_price_cents ? ` · ${formatBRL(trip.pillion_price_cents)} com garupa` : ""}`
            : "Valor a definir / rateio"}
          {` · ${trip.photos} foto(s)`}
          {trip.requires_plate && " · pede placa"}
        </p>
        <p className="text-sm text-muted">
          Criada em {formatDateTimeBR(trip.created_at)} · última edição {formatDateTimeBR(trip.updated_at)}
        </p>
        {isPublic && (
          <a href={tripUrl(trip.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center font-semibold text-accent underline">
            Abrir página pública ↗
          </a>
        )}
      </div>

      <section className="space-y-1 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-bold">Organizador</h2>
        <Link href={`/painel/admin/usuarios/${organizer.id}`} className="font-semibold text-accent underline">
          {organizer.name}
        </Link>
        <p className="text-muted break-all">
          {organizer.email ?? "sem e-mail"} · {formatBrPhone(organizer.whatsapp)}
        </p>
        {organizer.suspended_at && <Badge tone="danger">🚫 Organizador suspenso</Badge>}
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Confirmados" value={`${confirmed.length}/${trip.capacity}`} />
        <Stat label="Na fila" value={waitlist.length} />
        <Stat label="Pagos" value={`${paid.length}/${confirmed.length}`} />
        <Stat
          label={fixed ? "Valor confirmado" : "Cancelados"}
          value={fixed ? formatBRL(sum(confirmed)) : cancelled.length}
          detail={fixed ? `${formatBRL(sum(paid))} marcado como pago` : undefined}
        />
      </dl>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xl font-bold">Moderação</h2>
        {trip.admin_hidden_at ? (
          <>
            <p className="text-ink-soft">
              Fora do ar desde {formatDateTimeBR(trip.admin_hidden_at)}. Motivo: {trip.admin_hidden_reason}
            </p>
            <form action={setTripHidden.bind(null, trip.id, false)}>
              <SubmitButton pendingText="Devolvendo…" className="btn-secondary">
                Pôr a viagem de volta no ar
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <p className="text-ink-soft">
              Tirar do ar esconde a página pública e fecha as inscrições. Os inscritos continuam
              guardados e o organizador não consegue desfazer.
            </p>
            <ReasonForm
              action={setTripHidden.bind(null, trip.id, true)}
              label="Tirar viagem do ar"
              confirmLabel="Confirmar"
              pendingText="Tirando do ar…"
              placeholder="Ex.: conteúdo enganoso ou denúncia de golpe."
            />
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Inscritos ({registrations.length})</h2>
          <p className="text-sm text-muted">
            Só o necessário para suporte. Contatos, emergência e placa ficam com o organizador.
          </p>
        </div>
        {registrations.length === 0 ? (
          <p className="text-muted">Ninguém se inscreveu ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Moto</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3">Pagamento</th>
                  <th className="py-2">Inscrição</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2 pr-3 font-semibold">
                      {r.name}
                      {r.has_pillion && <span className="font-normal text-muted"> + garupa</span>}
                    </td>
                    <td className="py-2 pr-3">{r.bike}</td>
                    <td className="py-2 pr-3">{REG_STATUS[r.status]}</td>
                    <td className="py-2 pr-3">
                      {r.status === "confirmed" ? (r.payment_status === "paid" ? "✅ Pago" : "⏳ Pendente") : "—"}
                    </td>
                    <td className="py-2 whitespace-nowrap">{formatDateTimeBR(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Histórico de moderação</h2>
        <AuditList entries={audit} />
      </section>
    </div>
  );
}
