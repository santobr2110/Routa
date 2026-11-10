import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { TimeSeries } from "@/components/charts/time-series";
import {
  CockpitHero,
  FuelCard,
  Gauge,
  Odometer,
  RoadSigns,
  heroButton,
  roadGreeting,
} from "@/components/cockpit";
import { Kpi, Occupancy, PeriodPicker, Snapshot } from "@/components/stats";
import {
  PERIODS,
  percent,
  type AdminTripRow,
  type Analytics,
  type Dashboard,
  type PeriodKey,
} from "@/lib/admin";
import {
  formatBRL,
  formatBrPhone,
  formatDateBR,
  formatDateRangeBR,
  whatsappLink,
} from "@/lib/format";
import { daysBetween, todayBR } from "@/lib/organizer-stats";
import { LEVEL_LABELS, STATUS_LABELS, TERRAIN_LABELS } from "@/lib/trips";
import type { TripLevel, TripStatus, TripTerrain } from "@/types/database";

const REG_STATUS: Record<string, string> = {
  confirmed: "Confirmadas",
  waitlist: "Na fila",
  cancelled: "Canceladas",
};
const PRICING: Record<string, string> = {
  fixed: "Valor fixo",
  split: "Rateio / a definir",
};
const nf = new Intl.NumberFormat("pt-BR");

/** Visão geral do admin: período escolhido, números com comparação, gráficos e rankings. */
export function AdminOverview({
  dashboard: d,
  analytics: a,
  period,
  firstName,
  upcoming,
  heroImage,
}: {
  heroImage?: string;
  dashboard: Dashboard;
  analytics: Analytics;
  period: PeriodKey;
  firstName: string;
  /** Viagens publicadas que ainda vão acontecer (no ar). */
  upcoming: AdminTripRow[];
}) {
  const t = a.totals;
  const p = a.previous;
  const points = (
    pick: (s: Analytics["series"][number]) => Record<string, number>,
  ) =>
    a.series.map((s) => ({
      start: s.start,
      finish: s.finish,
      values: pick(s),
    }));
  const label =
    (map: Record<string, string>) =>
    (items: { key: string; value: number }[]) =>
      items.map((i) => ({ ...i, label: map[i.key] ?? i.key }));
  const b = a.breakdowns;
  const periodText = `${formatDateBR(a.from)} a ${formatDateBR(a.to)}`;

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Visão geral</h1>
      <AdminHero firstName={firstName} upcoming={upcoming} image={heroImage} />

      {(d.seals.pending > 0 ||
        d.trips.hidden > 0 ||
        d.organizers.suspended > 0) && (
        <div className="flex flex-wrap gap-2">
          {d.seals.pending > 0 && (
            <Link
              href="/painel/admin/selos"
              className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn"
            >
              {d.seals.pending} selo(s) Cadastur esperando revisão →
            </Link>
          )}
          {d.trips.hidden > 0 && (
            <Link
              href="/painel/admin/viagens?status=hidden&periodo=all"
              className="rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium"
            >
              {d.trips.hidden} viagem(ns) fora do ar →
            </Link>
          )}
          {d.organizers.suspended > 0 && (
            <span className="rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium">
              {d.organizers.suspended} organizador(es) suspenso(s)
            </span>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="section-title">Painel de instrumentos</h2>
          <p className="text-sm text-muted">
            Como estão as viagens que ainda vão acontecer em toda a Routa.
          </p>
        </div>
        <Instruments dashboard={d} upcoming={upcoming} />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Snapshot label="Usuários" value={nf.format(d.users.total)} />
          <Snapshot
            label="Ativos (30 dias)"
            value={nf.format(d.users.active_30d)}
            hint={`${percent(d.users.active_30d, d.users.total)}% da base`}
          />
          <Snapshot label="Organizadores" value={nf.format(d.organizers.total)} />
          <Snapshot label="Selos ativos" value={nf.format(d.seals.active)} />
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="section-title">No período</h2>
            <p className="text-sm text-muted">
              {periodText} · comparado com os {PERIODS[period].label} anteriores
            </p>
          </div>
          <PeriodPicker
            current={period}
            href={(key) => `/painel/admin?periodo=${key}`}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Novos usuários" value={t.signups} previous={p.signups} />
          <Kpi
            label="Novos organizadores"
            value={t.organizers}
            previous={p.organizers}
          />
          <Kpi label="Viagens criadas" value={t.trips} previous={p.trips} />
          <Kpi
            label="Viagens que saíram"
            value={t.departures}
            previous={p.departures}
          />
          <Kpi
            label="Inscrições"
            value={t.registrations}
            previous={p.registrations}
          />
          <Kpi
            label="Cancelamentos"
            value={t.cancellations}
            previous={p.cancellations}
            lowerIsBetter
          />
          <Kpi
            label="Valor das inscrições"
            value={t.value_cents}
            previous={p.value_cents}
            money
          />
          <Kpi
            label="Marcado como pago"
            value={t.paid_cents}
            previous={p.paid_cents}
            money
          />
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <TimeSeries
          title="Atividade"
          description="Cadastros, viagens criadas e inscrições em cada período."
          bucket={a.bucket}
          series={[
            { key: "signups", label: "Cadastros" },
            { key: "trips", label: "Viagens criadas" },
            { key: "registrations", label: "Inscrições" },
          ]}
          points={points((s) => ({
            signups: s.signups,
            trips: s.trips,
            registrations: s.registrations,
          }))}
        />
        <TimeSeries
          title="Valor das inscrições"
          description="Inscrições confirmadas em viagens com valor fixo, pela data da inscrição."
          bucket={a.bucket}
          unit="brl"
          kind="bar"
          series={[
            { key: "value", label: "Confirmado" },
            { key: "paid", label: "Marcado como pago" },
          ]}
          points={points((s) => ({ value: s.value_cents, paid: s.paid_cents }))}
        />
        <TimeSeries
          title="Crescimento acumulado"
          description="Total de usuários e de organizadores ao fim de cada período."
          bucket={a.bucket}
          cumulative
          series={[
            { key: "users", label: "Usuários" },
            { key: "organizers", label: "Organizadores" },
          ]}
          points={points((s) => ({
            users: s.users_total,
            organizers: s.organizers_total,
          }))}
        />
        <TimeSeries
          title="Cancelamentos"
          description="Inscrições removidas pelos organizadores."
          bucket={a.bucket}
          kind="bar"
          series={[{ key: "cancellations", label: "Cancelamentos" }]}
          points={points((s) => ({ cancellations: s.cancellations }))}
        />
      </div>

      <Funnel funnel={d.funnel} />

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="section-title">Viagens criadas no período</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <BarList
            title="Terreno"
            items={label(TERRAIN_LABELS as Record<TripTerrain, string>)(
              b.trips_by_terrain,
            )}
          />
          <BarList
            title="Nível"
            items={label(LEVEL_LABELS as Record<TripLevel, string>)(
              b.trips_by_level,
            )}
          />
          <BarList
            title="Situação"
            items={label(STATUS_LABELS as Record<TripStatus, string>)(
              b.trips_by_status,
            )}
          />
          <BarList
            title="Cobrança"
            items={label(PRICING)(b.trips_by_pricing)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Inscrições do período</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BarList
            title="Marcas de moto"
            description="As 10 mais comuns."
            items={b.bike_brands}
          />
          <BarList
            title="Destinos"
            description="Os 10 com mais inscrições."
            items={b.destinations}
          />
          <BarList
            title="Situação"
            items={label(REG_STATUS)(b.registrations_by_status)}
          />
          <BarList
            title="Antecedência"
            description="Quantos dias antes da saída as pessoas se inscrevem."
            items={b.lead_time}
            showShare
          />
          <BarList title="Dia da semana da inscrição" items={b.weekday} />
          <BarList
            title="Garupa e pagamento"
            description="Confirmadas, por situação do pagamento."
            items={[
              { key: "Vai sozinho(a)", value: b.pillion.without },
              { key: "Vai com garupa", value: b.pillion.with },
              { key: "Pagamento marcado", value: b.payment.paid },
              { key: "Pagamento pendente", value: b.payment.pending },
            ]}
            showShare={false}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
        <div className="card overflow-hidden">
          <div className="space-y-0.5 p-4 pb-2">
            <h2 className="font-medium">Organizadores com mais inscrições</h2>
            <p className="text-sm text-muted">No período.</p>
          </div>
          {a.top_organizers.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">
              Sem inscrições no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-muted/50 text-muted">
                    <th className="px-4 py-2 font-medium">Organizador</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Viagens
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Inscrições
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Pagos</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {a.top_organizers.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-line last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={`/painel/admin/usuarios/${o.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {o.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {o.trips}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {o.registrations}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {o.paid}/{o.confirmed}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatBRL(o.value_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <BarList
          title="Ocupação das viagens abertas"
          description="Quanto das vagas já está confirmado."
          items={b.occupancy}
          empty="Nenhuma viagem aberta."
        />
      </section>

      <section className="card overflow-hidden">
        <div className="space-y-0.5 p-4 pb-2">
          <h2 className="font-medium">Viagens com mais inscrições</h2>
          <p className="text-sm text-muted">
            Inscrições feitas no período; ocupação e pagamento de hoje.
          </p>
        </div>
        {a.top_trips.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">
            Sem inscrições no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Viagem</th>
                  <th className="px-4 py-2 font-medium">Saída</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Inscrições
                  </th>
                  <th className="px-4 py-2 font-medium">Ocupação</th>
                  <th className="px-4 py-2 text-right font-medium">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {a.top_trips.map((tr) => (
                  <tr
                    key={tr.id}
                    className="border-b border-line last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/painel/admin/viagens/${tr.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {tr.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {tr.destination} · {tr.organizer_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDateBR(tr.start_date)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {tr.registrations}
                    </td>
                    <td className="px-4 py-2">
                      <Occupancy
                        confirmed={tr.confirmed}
                        capacity={tr.capacity}
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {tr.paid}/{tr.confirmed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="section-title">Quem parou no caminho</h2>
          <p className="text-sm text-muted">
            Criaram conta há mais de 1 dia e ainda não criaram viagem. Uma
            mensagem pode destravar.
          </p>
        </div>
        {d.stalled.length === 0 ? (
          <p className="text-sm text-muted">Ninguém parado.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Pessoa</th>
                  <th className="px-4 py-2 font-medium">Parou em</th>
                  <th className="px-4 py-2 font-medium">Conta de</th>
                  <th className="px-4 py-2 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {d.stalled.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/painel/admin/usuarios/${s.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {s.name ?? s.email ?? "Sem nome"}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {s.stage === "no_profile" ? "Perfil" : "Primeira viagem"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatDateBR(s.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      {s.whatsapp ? (
                        <a
                          href={whatsappLink(
                            s.whatsapp,
                            `Oi, ${(s.name ?? "").split(" ")[0]}! Aqui é da Routa. Vi que você criou sua conta: posso te ajudar a montar a primeira viagem?`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-accent hover:underline"
                        >
                          {formatBrPhone(s.whatsapp)}
                        </a>
                      ) : (
                        <span className="text-muted">{s.email}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Funil de ativação: de quem criou conta até quem recebeu inscrição. */
function Funnel({ funnel }: { funnel: Dashboard["funnel"] }) {
  const steps = [
    { label: "Criaram conta", value: funnel.signed_up },
    { label: "Preencheram o perfil", value: funnel.profile },
    { label: "Criaram uma viagem", value: funnel.created_trip },
    { label: "Publicaram uma viagem", value: funnel.published_trip },
    { label: "Receberam inscrição", value: funnel.got_registration },
  ];
  const top = Math.max(funnel.signed_up, 1);
  return (
    <section className="card space-y-4 p-4">
      <div className="space-y-0.5">
        <h2 className="font-medium">Funil de organizadores</h2>
        <p className="text-sm text-muted">
          Desde o início. Onde as pessoas param entre criar a conta e receber a
          primeira inscrição.
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1]!.value : null;
          return (
            <li key={step.label} className="space-y-1.5">
              <p className="text-sm text-ink-soft">{step.label}</p>
              <p className="text-xl font-semibold tabular-nums">
                {nf.format(step.value)}{" "}
                <span className="text-sm font-normal text-muted">
                  {percent(step.value, funnel.signed_up)}%
                </span>
              </p>
              <div className="h-1.5 rounded-full bg-surface-muted">
                <div
                  className="h-1.5 rounded-full bg-series-1"
                  style={{ width: `${(step.value / top) * 100}%` }}
                />
              </div>
              {prev !== null && (
                <p className="text-xs text-muted">
                  {percent(step.value, prev)}% da etapa anterior
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Capa do admin: a próxima saída da plataforma inteira e as seguintes, como placas na estrada. */
function AdminHero({
  firstName,
  upcoming,
  image,
}: {
  image?: string;
  firstName: string;
  upcoming: AdminTripRow[];
}) {
  const greet = roadGreeting();
  const today = todayBR();
  const trips = [...upcoming].sort((x, y) =>
    x.start_date.localeCompare(y.start_date),
  );
  const [next, ...rest] = trips;
  const days = (t: AdminTripRow) => daysBetween(today, t.start_date);
  return (
    <CockpitHero
      image={image}
      firstName={firstName}
      hello={greet.hello}
      phrase={greet.phrase}
      next={
        next
          ? {
              eyebrow: "Próxima saída na Routa",
              title: next.title,
              href: `/painel/admin/viagens/${next.id}`,
              subtitle: `${next.destination} · ${formatDateRangeBR(next.start_date, next.end_date)} · por ${next.organizer_name}`,
              days_left: days(next),
              convoy: next,
              actions: (
                <>
                  <Link
                    href={`/painel/admin/viagens/${next.id}`}
                    className={heroButton.primary}
                  >
                    Ver a viagem
                  </Link>
                  <Link
                    href={`/painel/admin/usuarios/${next.organizer_id}`}
                    className={heroButton.glass}
                  >
                    Organizador
                  </Link>
                  <Link href="/painel/admin/viagens" className={heroButton.ghost}>
                    Todas as próximas ({trips.length})
                  </Link>
                </>
              ),
            }
          : null
      }
      empty={
        <>
          <p className="max-w-md text-white/80">
            Nenhuma saída marcada na plataforma. Bom momento para chamar quem
            parou no caminho.
          </p>
          <Link href="/painel/admin/usuarios" className={heroButton.primary}>
            Ver usuários
          </Link>
        </>
      }
    >
      {rest.length > 0 && (
        <RoadSigns
          title="Depois dela"
          items={rest.slice(0, 4).map((t) => ({
            id: t.id,
            href: `/painel/admin/viagens/${t.id}`,
            title: t.title,
            detail: `${t.destination} · ${t.organizer_name}`,
            days_left: days(t),
            convoy: t,
          }))}
        />
      )}
    </CockpitHero>
  );
}

/** Mostradores do admin: mesmos instrumentos do painel do organizador, somando a plataforma. */
function Instruments({
  dashboard: d,
  upcoming,
}: {
  dashboard: Dashboard;
  upcoming: AdminTripRow[];
}) {
  const seats = upcoming.reduce((s, t) => s + t.capacity, 0);
  const filled = upcoming.reduce(
    (s, t) => s + Math.min(t.confirmed, t.capacity),
    0,
  );
  const confirmed = upcoming.reduce((s, t) => s + t.confirmed, 0);
  const paid = upcoming.reduce((s, t) => s + t.paid, 0);
  const waitlist = upcoming.reduce((s, t) => s + t.waitlist, 0);
  const money = d.money;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*:nth-child(n+3)]:col-span-2 sm:[&>*:nth-child(n+3)]:col-span-1">
      <Gauge
        label="Vagas preenchidas"
        value={seats > 0 ? filled / seats : null}
        hint={
          seats > 0
            ? `${nf.format(filled)} de ${nf.format(seats)} nas viagens abertas`
            : "nenhuma viagem aberta"
        }
      />
      <Gauge
        label="Pagamentos em dia"
        value={confirmed > 0 ? paid / confirmed : null}
        hint={`${nf.format(paid)} de ${nf.format(confirmed)} confirmados já pagaram`}
      />
      <FuelCard
        label="Marcado como pago"
        value={formatBRL(money.paid_cents)}
        sub={`de ${formatBRL(money.confirmed_cents)} confirmados, desde o início`}
        pct={
          money.confirmed_cents > 0
            ? (money.paid_cents / money.confirmed_cents) * 100
            : 0
        }
        stats={[
          { label: "Viagens abertas", value: nf.format(upcoming.length) },
          { label: "Na fila", value: nf.format(waitlist) },
        ]}
      />
      <Odometer
        label="Inscrições na Routa"
        value={d.registrations.total}
        hint="desde o primeiro dia"
      />
    </div>
  );
}
