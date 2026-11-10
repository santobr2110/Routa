import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { TimeSeries } from "@/components/charts/time-series";
import { CockpitHero, FuelCard, Gauge, Odometer, heroButton, roadGreeting } from "@/components/cockpit";
import { Kpi, PeriodPicker } from "@/components/stats";
import { TripTable, tripBadges } from "@/components/trip-table";
import { formatBRL, formatDateBR, formatDateRangeBR } from "@/lib/format";
import type { OrganizerOverview as Overview } from "@/lib/organizer-stats";
import { PERIODS, type PeriodKey } from "@/lib/periods";


/** Visão geral do organizador: só as viagens e inscrições dele. */
export function OrganizerOverview({
  firstName,
  data: o,
  period,
  alerts,
  heroImage,
}: {
  /** Foto da capa: a do clube, a padrão do admin ou vazio (foto da Routa). */
  heroImage?: string;
  firstName: string;
  data: Overview;
  period: PeriodKey;
  alerts?: React.ReactNode;
}) {
  const t = o.totals;
  const p = o.previous;
  const hasMoney = o.upcoming.some((u) => u.fixed) || t.value_cents > 0;
  const occupancy = o.now.seats > 0 ? Math.round((o.now.filled / o.now.seats) * 100) : null;
  // A próxima saída de verdade (publicada ou encerrada); se só houver rascunho, ele.
  const next = o.upcoming.find((u) => u.status !== "draft") ?? o.upcoming[0] ?? null;

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Visão geral</h1>
      <OrganizerHero firstName={firstName} next={next} image={heroImage} />

      {alerts}

      {o.upcoming.some((t) => t.overdue > 0) && (
        <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" role="note">
          <p className="font-medium">Prazo de pagamento vencido</p>
          <ul className="mt-1 space-y-0.5">
            {o.upcoming
              .filter((t) => t.overdue > 0)
              .map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/painel/viagens/${t.id}/inscritos?filtro=vencidos`}
                    className="underline"
                  >
                    {t.title}: {t.overdue} pessoa(s)
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="section-title">Painel de instrumentos</h2>
          <p className="text-sm text-muted">Como estão as viagens que ainda vão acontecer.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*:nth-child(n+3)]:col-span-2 sm:[&>*:nth-child(n+3)]:col-span-1">
          <Gauge
            label="Vagas preenchidas"
            value={occupancy === null ? null : o.now.filled / o.now.seats}
            hint={o.now.seats > 0 ? `${o.now.filled} de ${o.now.seats} nas viagens abertas` : "nenhuma viagem aberta"}
          />
          <Gauge
            label="Pagamentos em dia"
            value={o.now.confirmed > 0 ? o.now.paid / o.now.confirmed : null}
            hint={`${o.now.paid} de ${o.now.confirmed} confirmados já pagaram`}
          />
          <FuelCard
            label="A receber"
            value={formatBRL(o.now.to_receive_cents)}
            sub={`${formatBRL(o.now.received_cents)} já entrou`}
            pct={tankPct(o.now.received_cents, o.now.to_receive_cents)}
            stats={[
              { label: "Viagens abertas", value: o.now.open_trips },
              { label: "Na fila", value: o.now.waitlist },
            ]}
          />
          <Odometer
            label="Gente que já rodou com você"
            value={o.now.participants}
            hint="pessoas diferentes, desde a primeira viagem"
          />
        </div>
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="section-title">No período</h2>
            <p className="text-sm text-muted">
              {formatDateBR(o.from)} a {formatDateBR(o.to)} · comparado com os{" "}
              {PERIODS[period].label} anteriores
            </p>
          </div>
          <PeriodPicker current={period} href={(key) => `/painel?periodo=${key}`} />
        </div>
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

function tankPct(received: number, toReceive: number) {
  const total = received + toReceive;
  return total > 0 ? (received / total) * 100 : 0;
}

/** Capa do organizador: a próxima saída dele e os atalhos de quem organiza. */
export function OrganizerHero({
  firstName,
  next,
  image,
}: {
  image?: string;
  firstName: string;
  next: Overview["upcoming"][number] | null;
}) {
  const greet = roadGreeting();
  const pending = next ? next.confirmed - next.paid : 0;
  return (
    <CockpitHero
      image={image}
      firstName={firstName}
      hello={greet.hello}
      phrase={greet.phrase}
      next={
        next && {
          eyebrow: `Próxima saída${next.status === "draft" ? " · rascunho" : ""}`,
          title: next.title,
          href: `/painel/viagens/${next.id}`,
          subtitle: `${next.destination} · ${formatDateRangeBR(next.start_date, next.end_date)}`,
          days_left: next.days_left,
          convoy: next,
          actions: (
            <>
              <Link href={`/painel/viagens/${next.id}/inscritos`} className={heroButton.primary}>
                Ver o comboio
              </Link>
              {pending > 0 && (
                <Link href={`/painel/viagens/${next.id}/cobranca`} className={heroButton.glass}>
                  Cobrar {pending} pendente{pending === 1 ? "" : "s"}
                </Link>
              )}
              <Link href="/painel/viagens/nova" className={heroButton.ghost}>
                + Nova viagem
              </Link>
            </>
          ),
        }
      }
      empty={
        <>
          <p className="max-w-md text-white/80">
            Nenhuma saída marcada. A estrada está esperando: monta a próxima e manda o link pro
            grupo.
          </p>
          <Link href="/painel/viagens/nova" className={heroButton.primary}>
            + Criar viagem
          </Link>
        </>
      }
    />
  );
}

function UpcomingTable({ trips }: { trips: Overview["upcoming"] }) {
  return (
    <TripTable
      label="Próximas saídas"
      rows={trips.map((t) => {
        const base = `/painel/viagens/${t.id}`;
        return {
          id: t.id,
          href: base,
          title: t.title,
          destination: t.destination,
          start_date: t.start_date,
          end_date: t.end_date,
          badges: tripBadges({ status: t.status, past: false, hidden: t.hidden }),
          capacity: t.capacity,
          confirmed: t.confirmed,
          waitlist: t.waitlist,
          paid: t.paid,
          overdue: t.overdue,
          fixed: t.fixed,
          value_cents: t.value_cents,
          paid_cents: t.paid_cents,
          chargeHref: `${base}/cobranca`,
          links: [
            { href: `${base}/inscritos`, label: "Inscritos", icon: "people" },
            { href: `${base}/numeros`, label: "Números", icon: "chart" },
          ],
        };
      })}
    />
  );
}
