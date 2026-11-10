import { BarList } from "@/components/charts/bar-list";
import { TimeSeries } from "@/components/charts/time-series";
import { Kpi, Occupancy } from "@/components/stats";
import { formatBRL } from "@/lib/format";
import type { tripNumbers } from "@/lib/organizer-stats";

type Numbers = ReturnType<typeof tripNumbers>;

/** Números de uma viagem: ocupação, dinheiro, curva de inscrições e perfil do grupo. */
export function TripNumbersView({ n }: { n: Numbers }) {
  const left = Math.max(n.capacity - n.confirmed, 0);
  const when =
    n.days_left > 1
      ? `Faltam ${n.days_left} dias para a saída.`
      : n.days_left === 1
        ? "A saída é amanhã."
        : n.days_left === 0
          ? "A saída é hoje."
          : "Essa viagem já saiu.";
  const total = n.confirmed + n.waitlist;

  return (
    <div className="space-y-8">
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Ocupação</h2>
          <p className="text-sm text-muted">{when}</p>
        </div>
        <Occupancy confirmed={n.confirmed} capacity={n.capacity} />
        <p className="text-sm text-ink-soft">
          {left > 0 ? `${left} vaga(s) livre(s)` : "Lotada"}
          {n.waitlist > 0 && ` · ${n.waitlist} na fila de espera`}
          {n.cancelled > 0 && ` · ${n.cancelled} cancelada(s)`}
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Confirmados" value={n.confirmed} />
        <Kpi label="Na fila" value={n.waitlist} />
        <Kpi label="Pagos" value={n.paid} />
        <Kpi label="Com garupa" value={n.pillion} />
        {n.fixed ? (
          <>
            <Kpi label="Valor confirmado" value={n.value_cents} money />
            <Kpi label="A receber" value={n.value_cents - n.paid_cents} money />
          </>
        ) : (
          <>
            <Kpi label="Gente nova" value={n.first_timers} />
            <Kpi label="Também em outras viagens" value={n.returning} />
          </>
        )}
      </dl>
      {n.fixed && n.paid_cents > 0 && (
        <p className="-mt-5 text-xs text-muted">{formatBRL(n.paid_cents)} já marcado como pago.</p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
        <TimeSeries
          title="Como as vagas foram enchendo"
          description="Inscrições ativas acumuladas (confirmados + fila) desde que a viagem foi criada, comparadas com o total de vagas."
          bucket={n.bucket}
          series={[
            { key: "registrations", label: "Inscrições" },
            { key: "capacity", label: "Vagas" },
          ]}
          points={n.curve}
          cumulative
        />
        <BarList
          title="Quem vem"
          description="Entre os inscritos ativos."
          items={[
            { key: "Primeira viagem com você", value: n.first_timers },
            { key: "Também em outras viagens suas", value: n.returning },
          ]}
          empty="Ninguém inscrito ainda."
        />
      </div>

      {total > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <BarList
            title="Antecedência"
            description="Dias entre a inscrição e a saída."
            items={n.lead_time}
          />
          <BarList title="Dia da semana" description="Quando as pessoas se inscreveram." items={n.weekday} />
          <BarList title="Marcas de moto" items={n.bike_brands} />
        </div>
      )}
    </div>
  );
}
