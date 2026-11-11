import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin, type AdminTripDetail } from "@/lib/admin";
import {
  formatBRL,
  formatBrPhone,
  formatDateRangeBR,
  formatDateTimeBR,
} from "@/lib/format";
import { tripUrl } from "@/lib/site";
import { LEVEL_LABELS, STATUS_LABELS, TERRAIN_LABELS } from "@/lib/trips";
import type { TripLevel, TripTerrain } from "@/types/database";
import { AuditList } from "../../audit-list";
import { ReasonForm } from "../../reason-form";
import { ResultMessage } from "../../result-message";
import { Badge, Meter } from "../../stat";
import { DeleteTripForm } from "@/components/delete-trip-form";
import { daysLeft } from "@/lib/trash";
import { adminDeleteTrip, adminRestoreTrip, setTripHidden } from "./actions";

export const metadata: Metadata = {
  title: "Admin · Viagem",
  robots: { index: false },
};

const REG_STATUS = {
  confirmed: "Confirmado",
  waitlist: "Na fila",
  cancelled: "Cancelado",
} as const;

export default async function AdminViagemPage({
  params,
  searchParams,
}: PageProps<"/painel/admin/viagens/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { resultado } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data, error } = await supabase.rpc("admin_trip_detail", {
    p_trip_id: id,
  });
  if (error) throw error;
  if (!data) notFound();
  const { trip, organizer, registrations, audit } =
    data as unknown as AdminTripDetail;

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const paid = confirmed.filter((r) => r.payment_status === "paid");
  const sum = (rows: typeof registrations) =>
    rows.reduce((total, r) => total + (r.amount ?? 0), 0);
  const fixed = trip.pricing_mode === "fixed";
  const isPublic =
    trip.status !== "draft" &&
    !trip.admin_hidden_at &&
    !trip.deleted_at &&
    !organizer.suspended_at;

  return (
    <div className="space-y-6">
      <Link
        href="/painel/admin/viagens"
        className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
      >
        ← Viagens
      </Link>

      <ResultMessage code={resultado} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title break-words">{trip.title}</h1>
          <Badge tone={trip.status === "published" ? "success" : "muted"}>
            {STATUS_LABELS[trip.status]}
          </Badge>
          {trip.admin_hidden_at && <Badge tone="danger">Fora do ar</Badge>}
          {trip.deleted_at && (
            <Badge tone="danger">
              {trip.deleted_by_admin ? "Excluída pela administração" : "Na lixeira"}
            </Badge>
          )}
        </div>
        <p className="text-ink-soft">
          {trip.destination} ·{" "}
          {formatDateRangeBR(trip.start_date, trip.end_date)}
        </p>
        <p className="text-sm text-muted">
          {LEVEL_LABELS[trip.level as TripLevel] ?? trip.level} ·{" "}
          {TERRAIN_LABELS[trip.terrain as TripTerrain] ?? trip.terrain}
          {" · "}
          {fixed
            ? `${formatBRL(trip.price_cents ?? 0)} piloto${trip.pillion_price_cents ? ` · ${formatBRL(trip.pillion_price_cents)} com garupa` : ""}`
            : "Valor a definir / rateio"}
          {` · ${trip.photos} foto(s)`}
          {trip.requires_plate && " · pede placa"}
        </p>
        <p className="text-sm text-muted">
          Criada em {formatDateTimeBR(trip.created_at)} · última edição{" "}
          {formatDateTimeBR(trip.updated_at)}
        </p>
        {isPublic && (
          <a
            href={tripUrl(trip.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center text-sm font-medium text-accent hover:underline"
          >
            Abrir página pública ↗
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Meter
              label="Vagas"
              value={`${confirmed.length}/${trip.capacity}`}
              pct={trip.capacity > 0 ? confirmed.length / trip.capacity : 0}
              detail={
                waitlist.length > 0
                  ? `${waitlist.length} na fila de espera`
                  : `${Math.max(trip.capacity - confirmed.length, 0)} livre(s)`
              }
            />
            <Meter
              label="Pagos"
              value={`${paid.length}/${confirmed.length}`}
              pct={confirmed.length > 0 ? paid.length / confirmed.length : 0}
              detail={`${confirmed.length - paid.length} pendente(s) · ${cancelled.length} cancelado(s)`}
              tone="success"
            />
            {fixed ? (
              <div className="card min-w-0 p-4 col-span-2">
                <dt className="text-sm text-muted">Valor dos confirmados</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight break-words tabular-nums">
                  {formatBRL(sum(confirmed))}
                </dd>
                <dd className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">Marcado como pago</span>
                    <span className="font-semibold break-words text-success tabular-nums">
                      {formatBRL(sum(paid))}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">Falta receber</span>
                    <span className="font-semibold break-words tabular-nums">
                      {formatBRL(sum(confirmed) - sum(paid))}
                    </span>
                  </span>
                </dd>
              </div>
            ) : (
              <div className="card min-w-0 p-4 col-span-2">
                <dt className="text-sm text-muted">Valor</dt>
                <dd className="mt-1 text-lg font-semibold">Rateio</dd>
                <dd className="mt-1 text-sm text-muted">
                  O valor é dividido entre o grupo depois da viagem.
                </dd>
              </div>
            )}
          </dl>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="section-title">Inscritos ({registrations.length})</h2>
              <p className="text-sm text-muted">
                Só o necessário para suporte. Contatos, emergência e placa ficam com
                o organizador.
              </p>
            </div>
            {registrations.length === 0 ? (
              <p className="text-muted">Ninguém se inscreveu ainda.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-muted/50 text-muted">
                      <th className="px-4 py-2 font-medium">Nome</th>
                      <th className="px-4 py-2 font-medium">Moto</th>
                      <th className="px-4 py-2 font-medium">Situação</th>
                      <th className="px-4 py-2 font-medium">Pagamento</th>
                      <th className="px-4 py-2 font-medium">Inscrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">
                          {r.name}
                          {r.has_pillion && (
                            <span className="font-normal text-muted">
                              {" "}
                              + garupa
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{r.bike}</td>
                        <td className="px-4 py-2">{REG_STATUS[r.status]}</td>
                        <td className="px-4 py-2">
                          {r.status === "confirmed"
                            ? r.payment_status === "paid"
                              ? "Pago"
                              : "Pendente"
                            : "—"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-muted">
                          {formatDateTimeBR(r.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">Histórico de moderação</h2>
            <AuditList entries={audit} />
          </section>
        </div>
        <aside className="space-y-4">
          <section className="card space-y-1 p-4">
            <h2 className="text-sm text-muted">Organizador</h2>
            <Link
              href={`/painel/admin/usuarios/${organizer.id}`}
              className="font-medium text-accent hover:underline"
            >
              {organizer.name}
            </Link>
            <p className="text-sm break-all text-muted">
              {organizer.email ?? "sem e-mail"} ·{" "}
              {formatBrPhone(organizer.whatsapp)}
            </p>
            {organizer.suspended_at && (
              <Badge tone="danger">Organizador suspenso</Badge>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-medium">Moderação</h2>
            {trip.admin_hidden_at ? (
              <>
                <p className="text-sm text-ink-soft">
                  Fora do ar desde {formatDateTimeBR(trip.admin_hidden_at)}. Motivo:{" "}
                  {trip.admin_hidden_reason}
                </p>
                <form action={setTripHidden.bind(null, trip.id, false)}>
                  <SubmitButton pendingText="Devolvendo…" className="btn-secondary">
                    Pôr a viagem de volta no ar
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Tirar do ar esconde a página pública e fecha as inscrições. Os
                  inscritos continuam guardados e o organizador não consegue
                  desfazer.
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

          <section className="card space-y-3 p-4">
            <h2 className="font-medium">Lixeira</h2>
            {trip.deleted_at ? (
              <>
                <p className="text-sm text-ink-soft">
                  {trip.deleted_by_admin
                    ? `Excluída pela administração em ${formatDateTimeBR(trip.deleted_at)}. Motivo: ${trip.deleted_reason}.`
                    : `O organizador excluiu em ${formatDateTimeBR(trip.deleted_at)}.`}{" "}
                  {trip.purge_at &&
                    `Será apagada de vez em ${daysLeft(trip.purge_at)} dia(s).`}
                </p>
                <form action={adminRestoreTrip.bind(null, trip.id)}>
                  <SubmitButton pendingText="Restaurando…" className="btn-secondary">
                    Restaurar da lixeira
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Excluir manda a viagem para a lixeira por 30 dias e depois apaga tudo. O
                  organizador vê o aviso com o motivo e não consegue restaurar.
                </p>
                <DeleteTripForm
                  action={adminDeleteTrip.bind(null, trip.id)}
                  askReason
                  summary={`${confirmed.length} confirmado(s) (${paid.length} pago(s)), ${waitlist.length} na fila e ${trip.photos} foto(s)`}
                  consequences={[
                    "A página sai do ar, as inscrições fecham e a viagem some do painel do organizador.",
                    "Os inscritos que abrirem o link pessoal veem que a viagem foi excluída.",
                    "A exclusão e o motivo ficam no histórico de moderação.",
                  ]}
                />
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

