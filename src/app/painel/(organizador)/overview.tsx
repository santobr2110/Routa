import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { TimeSeries } from "@/components/charts/time-series";
import { Kpi, Occupancy, PeriodPicker, Snapshot } from "@/components/stats";
import { formatBRL, formatDateBR, formatDateRangeBR } from "@/lib/format";
import type { OrganizerOverview as Overview } from "@/lib/organizer-stats";
import { PERIODS, type PeriodKey } from "@/lib/periods";
import { STATUS_LABELS } from "@/lib/trips";

const nf = new Intl.NumberFormat("pt-BR");

/** Visão geral do organizador: só as viagens e inscrições dele. */
export function OrganizerOverview({
  firstName,
  data: o,
  period,
  alerts,
}: {
  firstName: string;
  data: Overview;
  period: PeriodKey;
  alerts?: React.ReactNode;
}) {
  const t = o.totals;
  const p = o.previous;
  const hasMoney = o.upcoming.some((u) => u.fixed) || t.value_cents > 0;
  const occupancy = o.now.seats > 0 ? Math.round((o.now.filled / o.now.seats) * 100) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">E aí, {firstName}!</h1>
          <p className="text-sm text-muted">
            {formatDateBR(o.from)} a {formatDateBR(o.to)} · comparado com os{" "}
            {PERIODS[period].label} anteriores
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker current={period} href={(key) => `/painel?periodo=${key}`} />
          <Link href="/painel/viagens/nova" className="btn-primary">
            + Criar viagem
          </Link>
        </div>
      </div>

      {alerts}

      <section className="space-y-3">
        <h2 className="section-title">Agora</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Snapshot label="Viagens abertas" value={nf.format(o.now.open_trips)} />
          <Snapshot
            label="Vagas preenchidas"
            value={occupancy === null ? "—" : `${occupancy}%`}
            hint={o.now.seats > 0 ? `${o.now.filled} de ${o.now.seats}` : "nenhuma viagem aberta"}
          />
          <Snapshot label="Na fila de espera" value={nf.format(o.now.waitlist)} />
          <Snapshot
            label="Pagamentos"
            value={o.now.confirmed > 0 ? `${Math.round((o.now.paid / o.now.confirmed) * 100)}%` : "—"}
            hint={`${o.now.paid} de ${o.now.confirmed} confirmados`}
          />
          <Snapshot
            label="A receber"
            value={formatBRL(o.now.to_receive_cents)}
            hint={`${formatBRL(o.now.received_cents)} já pago`}
          />
          <Snapshot
            label="Participantes"
            value={nf.format(o.now.participants)}
            hint="pessoas diferentes, desde o início"
          />
        </dl>
        {hasMoney && (
          <p className="text-xs text-muted">
            Valores das viagens de valor fixo que ainda não aconteceram. Rateio não entra na conta.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Próximas saídas</h2>
          <Link href="/painel/viagens" className="text-sm font-medium text-accent hover:underline">
            Todas as viagens →
          </Link>
        </div>
        {o.upcoming.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            Nenhuma viagem marcada.{" "}
            <Link href="/painel/viagens/nova" className="font-medium text-accent hover:underline">
              Criar uma agora
            </Link>
          </p>
        ) : (
          <UpcomingTable trips={o.upcoming} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">No período</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Kpi label="Inscrições" value={t.registrations} previous={p.registrations} />
          <Kpi label="Gente nova" value={t.new_participants} previous={p.new_participants} />
          <Kpi
            label="Voltaram"
            value={t.returning_participants}
            previous={p.returning_participants}
          />
          <Kpi
            label="Cancelamentos"
            value={t.cancellations}
            previous={p.cancellations}
            lowerIsBetter
          />
          <Kpi label="Valor confirmado" value={t.value_cents} previous={p.value_cents} money />
          <Kpi label="Marcado como pago" value={t.paid_cents} previous={p.paid_cents} money />
        </dl>
        <p className="text-xs text-muted">
          &quot;Gente nova&quot; é quem se inscreveu com você pela primeira vez no período;
          &quot;Voltaram&quot; já tinha se inscrito antes.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <TimeSeries
          title="Inscrições"
          description="Novas inscrições em cada período, por situação de hoje."
          bucket={o.bucket}
          kind="bar"
          series={[
            { key: "confirmed", label: "Confirmadas" },
            { key: "waitlist", label: "Na fila" },
          ]}
          points={o.series.map((s) => ({
            start: s.start,
            finish: s.finish,
            values: { confirmed: s.values.confirmed, waitlist: s.values.waitlist },
          }))}
        />
        <TimeSeries
          title="Valor das inscrições"
          description="Confirmadas em viagens de valor fixo, pela data da inscrição."
          bucket={o.bucket}
          unit="brl"
          kind="bar"
          series={[
            { key: "value", label: "Confirmado" },
            { key: "paid", label: "Marcado como pago" },
          ]}
          points={o.series.map((s) => ({
            start: s.start,
            finish: s.finish,
            values: { value: s.values.value, paid: s.values.paid },
          }))}
        />
      </div>

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="section-title">Quem se inscreveu no período</h2>
          <p className="text-sm text-muted">Ajuda a decidir quando divulgar a próxima viagem.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <BarList
            title="Antecedência"
            description="Dias entre a inscrição e a saída."
            items={o.breakdowns.lead_time}
          />
          <BarList
            title="Dia da semana"
            description="Em que dia as pessoas se inscrevem."
            items={o.breakdowns.weekday}
          />
          <BarList
            title="Marcas de moto"
            items={o.breakdowns.bike_brands}
            empty="Sem inscrições no período."
          />
          <BarList title="Garupa" description="Entre os confirmados." items={o.breakdowns.group} />
        </div>
      </section>
    </div>
  );
}

function UpcomingTable({ trips }: { trips: Overview["upcoming"] }) {
  const when = (days: number) =>
    days > 1 ? `em ${days} dias` : days === 1 ? "amanhã" : days === 0 ? "hoje" : "em andamento";
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-muted/50 text-muted">
              <th className="px-4 py-2 font-medium">Viagem</th>
              <th className="px-4 py-2 font-medium">Saída</th>
              <th className="px-4 py-2 font-medium">Ocupação</th>
              <th className="px-4 py-2 text-right font-medium">Fila</th>
              <th className="px-4 py-2 text-right font-medium">Pagos</th>
              <th className="px-4 py-2 text-right font-medium">A receber</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-muted/50">
                <td className="px-4 py-2.5">
                  <Link href={`/painel/viagens/${t.id}`} className="font-medium hover:text-accent">
                    {t.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {t.destination} · {STATUS_LABELS[t.status]}
                    {t.hidden && " · fora do ar"}
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {formatDateBR(t.start_date)}
                  <span className="block text-xs text-muted">{when(t.days_left)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Occupancy confirmed={t.confirmed} capacity={t.capacity} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.waitlist}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {t.paid}/{t.confirmed}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {t.fixed ? formatBRL(t.value_cents - t.paid_cents) : "rateio"}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <Link
                    href={`/painel/viagens/${t.id}/inscritos`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Inscritos
                  </Link>
                  <span className="text-faint"> · </span>
                  <Link
                    href={`/painel/viagens/${t.id}/numeros`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Números
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-2 md:hidden">
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/painel/viagens/${t.id}/numeros`} className="card block space-y-2 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-medium">{t.title}</p>
                <span className="shrink-0 text-xs text-muted">{when(t.days_left)}</span>
              </div>
              <p className="text-xs text-muted">
                {formatDateRangeBR(t.start_date, t.end_date)} · {STATUS_LABELS[t.status]}
              </p>
              <Occupancy confirmed={t.confirmed} capacity={t.capacity} />
              <p className="text-xs text-ink-soft">
                {t.waitlist} na fila · {t.paid}/{t.confirmed} pagos
                {t.fixed && ` · ${formatBRL(t.value_cents - t.paid_cents)} a receber`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
