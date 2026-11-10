import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { TimeSeries } from "@/components/charts/time-series";
import {
  PERIODS,
  percent,
  type Analytics,
  type Dashboard,
  type PeriodKey,
} from "@/lib/admin";
import {
  formatBRL,
  formatBrPhone,
  formatDateBR,
  whatsappLink,
} from "@/lib/format";
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
}: {
  dashboard: Dashboard;
  analytics: Analytics;
  period: PeriodKey;
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Visão geral</h1>
          <p className="text-sm text-muted">
            {periodText} · comparado com os {PERIODS[period].label} anteriores
          </p>
        </div>
        <nav
          className="inline-flex rounded-lg border border-line bg-surface p-0.5"
          aria-label="Período"
        >
          {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
            <Link
              key={key}
              href={`/painel/admin?periodo=${key}`}
              aria-current={key === period ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-md px-3 text-sm text-ink-soft aria-[current=page]:bg-surface-muted aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {PERIODS[key].label}
            </Link>
          ))}
        </nav>
      </div>

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
        <h2 className="section-title">No período</h2>
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

      <section className="space-y-3">
        <h2 className="section-title">Agora</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Snapshot label="Usuários" value={nf.format(d.users.total)} />
          <Snapshot
            label="Ativos (30 dias)"
            value={nf.format(d.users.active_30d)}
            hint={`${percent(d.users.active_30d, d.users.total)}% da base`}
          />
          <Snapshot
            label="Viagens abertas"
            value={nf.format(d.trips.upcoming_open)}
          />
          <Snapshot
            label="Ocupação média"
            value={
              d.trips.avg_occupancy === null ? "—" : `${d.trips.avg_occupancy}%`
            }
            hint="das viagens abertas"
          />
          <Snapshot
            label="Taxa de pagamento"
            value={`${percent(d.registrations.paid, d.registrations.confirmed)}%`}
            hint={`${d.registrations.paid} de ${d.registrations.confirmed}`}
          />
          <Snapshot label="Selos ativos" value={nf.format(d.seals.active)} />
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

/** Número do período com a variação em relação ao período anterior. */
function Kpi({
  label,
  value,
  previous,
  money = false,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  previous: number;
  money?: boolean;
  lowerIsBetter?: boolean;
}) {
  const diff = value - previous;
  const change = previous > 0 ? Math.round((diff / previous) * 100) : null;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const tone =
    diff === 0 ? "text-muted" : good ? "text-success" : "text-danger";
  const text =
    diff === 0
      ? "igual ao anterior"
      : change === null
        ? "novo no período"
        : `${diff > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs. anterior`;
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {money ? formatBRL(value) : nf.format(value)}
      </dd>
      <dd className={`mt-0.5 text-xs ${tone}`}>{text}</dd>
    </div>
  );
}

function Snapshot({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function Occupancy({
  confirmed,
  capacity,
}: {
  confirmed: number;
  capacity: number;
}) {
  const pct = capacity > 0 ? Math.min((confirmed / capacity) * 100, 100) : 0;
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-muted">
        <div
          className="h-1.5 rounded-full bg-series-1"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted tabular-nums">
        {confirmed}/{capacity}
      </span>
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
