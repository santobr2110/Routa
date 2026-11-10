import type { Metadata } from "next";
import Link from "next/link";
import { percent, requireAdmin, type Dashboard } from "@/lib/admin";
import { formatBRL, formatBrPhone, formatDateBR, whatsappLink } from "@/lib/format";
import { Stat } from "./stat";

export const metadata: Metadata = { title: "Admin · Visão geral", robots: { index: false } };

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_dashboard");
  if (error) throw error;
  const d = data as unknown as Dashboard;
  const paidRate = percent(d.registrations.paid, d.registrations.confirmed);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Visão geral</h1>

      {(d.seals.pending > 0 || d.organizers.suspended > 0 || d.trips.hidden > 0) && (
        <div className="space-y-2">
          {d.seals.pending > 0 && (
            <Link href="/painel/admin/selos" className="block rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn">
              ⏳ {d.seals.pending} pedido(s) de selo Cadastur esperando revisão →
            </Link>
          )}
          {d.organizers.suspended > 0 && (
            <Link href="/painel/admin/usuarios" className="block rounded-xl bg-surface-muted px-4 py-3 font-medium">
              🚫 {d.organizers.suspended} organizador(es) suspenso(s)
            </Link>
          )}
          {d.trips.hidden > 0 && (
            <Link href="/painel/admin/viagens?status=hidden" className="block rounded-xl bg-surface-muted px-4 py-3 font-medium">
              🙈 {d.trips.hidden} viagem(ns) fora do ar →
            </Link>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Números da plataforma</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Usuários" value={d.users.total} detail={`+${d.users.last_7d} em 7 dias · +${d.users.last_30d} em 30`} />
          <Stat label="Ativos (30 dias)" value={d.users.active_30d} detail="entraram nos últimos 30 dias" />
          <Stat label="Organizadores" value={d.organizers.total} detail={`${d.seals.active} com selo Cadastur`} />
          <Stat label="Viagens abertas" value={d.trips.upcoming_open} detail={`${d.trips.total} no total · +${d.trips.last_30d} em 30 dias`} />
          <Stat
            label="Inscrições"
            value={d.registrations.total}
            detail={`${d.registrations.confirmed} confirmadas · ${d.registrations.waitlist} na fila · +${d.registrations.last_7d} em 7 dias`}
          />
          <Stat label="Pagamentos" value={`${paidRate}%`} detail={`${d.registrations.paid} de ${d.registrations.confirmed} confirmados pagaram`} />
          <Stat
            label="Valor das inscrições"
            value={formatBRL(d.money.confirmed_cents)}
            detail={`${formatBRL(d.money.paid_cents)} já marcado como pago (viagens com valor fixo)`}
          />
          <Stat
            label="Ocupação média"
            value={d.trips.avg_occupancy === null ? "—" : `${d.trips.avg_occupancy}%`}
            detail="das viagens abertas"
          />
        </dl>
        <p className="text-sm text-muted">
          O dinheiro não passa pela Routa: os valores são o que os organizadores cobram e marcam
          como pago.
        </p>
      </section>

      <Funnel funnel={d.funnel} />

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Últimas 12 semanas</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <WeeklyBars title="Cadastros" weeks={d.weekly} metric="signups" />
          <WeeklyBars title="Viagens criadas" weeks={d.weekly} metric="trips" />
          <WeeklyBars title="Inscrições" weeks={d.weekly} metric="registrations" />
        </div>
        <details>
          <summary className="min-h-12 cursor-pointer font-semibold text-accent">Ver em tabela</summary>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2 pr-4">Semana de</th>
                  <th className="py-2 pr-4 text-right">Cadastros</th>
                  <th className="py-2 pr-4 text-right">Viagens</th>
                  <th className="py-2 text-right">Inscrições</th>
                </tr>
              </thead>
              <tbody>
                {d.weekly.map((w) => (
                  <tr key={w.week} className="border-b border-line">
                    <td className="py-2 pr-4">{formatDateBR(w.week)}</td>
                    <td className="py-2 pr-4 text-right">{w.signups}</td>
                    <td className="py-2 pr-4 text-right">{w.trips}</td>
                    <td className="py-2 text-right">{w.registrations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Quem parou no caminho</h2>
          <p className="text-muted">
            Criaram conta há mais de 1 dia e ainda não criaram viagem. Uma mensagem pode destravar.
          </p>
        </div>
        {d.stalled.length === 0 ? (
          <p className="text-muted">Ninguém parado. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {d.stalled.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
                <Link href={`/painel/admin/usuarios/${s.id}`} className="min-w-0">
                  <p className="font-semibold break-words">{s.name ?? s.email ?? "Sem nome"}</p>
                  <p className="text-sm text-muted">
                    {s.stage === "no_profile" ? "Não preencheu o perfil" : "Não criou viagem"} · conta de{" "}
                    {formatDateBR(s.created_at.slice(0, 10))}
                  </p>
                </Link>
                {s.whatsapp && (
                  <a
                    href={whatsappLink(
                      s.whatsapp,
                      `Oi, ${(s.name ?? "").split(" ")[0]}! Aqui é da Routa. Vi que você criou sua conta: posso te ajudar a montar a primeira viagem?`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-xl border-2 border-line-strong px-4 font-semibold"
                  >
                    WhatsApp {formatBrPhone(s.whatsapp)}
                  </a>
                )}
              </li>
            ))}
          </ul>
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
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Funil de organizadores</h2>
        <p className="text-muted">Onde as pessoas param entre criar a conta e receber a primeira inscrição.</p>
      </div>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="space-y-1">
            <div className="flex justify-between gap-2 text-base">
              <span className="font-semibold">{step.label}</span>
              <span className="text-ink-soft">
                {step.value} <span className="text-muted">({percent(step.value, funnel.signed_up)}%)</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface-muted">
              <div
                className="h-3 rounded-full bg-brand"
                style={{ width: `${Math.max((step.value / top) * 100, step.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Barras por semana (uma série, uma cor). Passe o mouse ou toque para ver o número. */
function WeeklyBars({
  title,
  weeks,
  metric,
}: {
  title: string;
  weeks: Dashboard["weekly"];
  metric: "signups" | "trips" | "registrations";
}) {
  const max = Math.max(...weeks.map((w) => w[metric]), 1);
  const total = weeks.reduce((sum, w) => sum + w[metric], 0);
  const last = weeks.at(-1)?.[metric] ?? 0;
  return (
    <figure className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">
          {total} no período · {last} nesta semana
        </span>
      </figcaption>
      <div className="flex h-24 items-end gap-0.5" role="img" aria-label={`${title}: ${weeks.map((w) => w[metric]).join(", ")} por semana`}>
        {weeks.map((w) => (
          <div
            key={w.week}
            className="group relative flex h-full flex-1 items-end"
            title={`Semana de ${formatDateBR(w.week)}: ${w[metric]}`}
          >
            <div
              className="w-full rounded-t bg-brand group-hover:opacity-80"
              style={{ height: `${(w[metric] / max) * 100}%`, minHeight: w[metric] > 0 ? 3 : 1 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{formatDateBR(weeks[0]!.week).slice(0, 5)}</span>
        <span>{formatDateBR(weeks.at(-1)!.week).slice(0, 5)}</span>
      </div>
    </figure>
  );
}
