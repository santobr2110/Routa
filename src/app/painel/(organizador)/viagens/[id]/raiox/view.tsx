import Link from "next/link";
import { CC_BAND_LABELS, STYLE_LABELS } from "@/lib/bike-specs";
import {
  EXPERIENCE_SHORT,
  OFFROAD_SHORT,
  RANGE_MARGIN,
  SKILL_SHORT,
  analyzeConvoy,
  convoyOn,
  type ConvoyAlert,
  type ConvoyRider,
  type ConvoySettings,
} from "@/lib/convoy";
import { LEVEL_LABELS, TERRAIN_LABELS } from "@/lib/trips";
import type { TripLevel, TripTerrain } from "@/types/database";

/** Aba Raio-X: alertas, perfil do grupo e a ficha de cada confirmado. */
export function RaioXView({
  trip,
  settings,
  riders,
  waitlist,
}: {
  trip: { id: string; level: TripLevel; terrain: TripTerrain };
  settings: ConvoySettings;
  riders: ConvoyRider[];
  waitlist: ConvoyRider[];
}) {
  const x = analyzeConvoy({ level: trip.level, terrain: trip.terrain, settings }, riders);
  const on = convoyOn(settings);

  return (
    <div className="space-y-6">
      {!on && (
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
          As perguntas do Raio-X estão desligadas nesta viagem. Mostramos só o que dá para saber
          pelo modelo da moto.{" "}
          <Link href={`/painel/viagens/${trip.id}`} className="font-medium text-accent underline">
            Ligar na aba Editar
          </Link>
        </p>
      )}

      {/* Faixa de resumo, estilo painel de instrumentos */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Motos confirmadas" value={String(x.riders)} hint={`${x.pillions} com garupa`} />
        <Fact
          label="Responderam"
          value={on ? `${x.answered}/${x.riders}` : "—"}
          hint={on ? "pelo formulário ou link pessoal" : "perguntas desligadas"}
        />
        <Fact
          label="Cilindradas"
          value={x.minCc && x.maxCc ? (x.minCc === x.maxCc ? `${x.minCc}cc` : `${x.minCc}–${x.maxCc}cc`) : "—"}
          hint="das motos que a Routa conhece"
        />
        <Fact
          label="Menor autonomia"
          value={x.minRange ? `${x.minRange} km` : "—"}
          hint={
            settings.longest_stretch_km
              ? `trecho sem posto: ${settings.longest_stretch_km} km (+20% = ${Math.ceil(settings.longest_stretch_km * RANGE_MARGIN)})`
              : "informe o maior trecho sem posto em Editar"
          }
        />
        <Fact
          label="Viagem"
          value={LEVEL_LABELS[trip.level]}
          hint={TERRAIN_LABELS[trip.terrain]}
        />
      </dl>

      <section className="space-y-3">
        <h2 className="section-title">Alertas</h2>
        {x.riders === 0 ? (
          <p className="card p-4 text-sm text-muted">Ninguém confirmado ainda.</p>
        ) : x.alerts.length === 0 ? (
          <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
            Nenhum alerta. Comboio redondo 🤙
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {x.alerts.map((a) => (
              <AlertCard key={a.title} alert={a} />
            ))}
          </ul>
        )}
        {x.alerts.some((a) => a.title.includes("não respond")) && (
          <Link
            href={`/painel/viagens/${trip.id}/cobranca?modelo=raiox`}
            className="inline-flex min-h-9 items-center text-sm font-medium text-accent hover:underline"
          >
            Pedir para responder pelo WhatsApp →
          </Link>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Perfil do grupo</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Breakdown
            title="Cilindrada"
            total={x.riders}
            rows={x.ccBands.map((b) => ({ label: CC_BAND_LABELS[b.key], names: b.names }))}
          />
          <Breakdown
            title="Estilo da moto"
            total={x.riders}
            rows={x.styles
              .filter((b) => b.names.length > 0)
              .map((b) => ({ label: STYLE_LABELS[b.key], names: b.names }))}
          />
          {settings.experience !== "off" && (
            <Breakdown
              title="Experiência na estrada"
              total={x.answered}
              rows={x.experience.map((b) => ({ label: EXPERIENCE_SHORT[b.key], names: b.names }))}
            />
          )}
          {settings.experience !== "off" && (
            <Breakdown
              title="Experiência na terra"
              total={x.answered}
              rows={x.offroad.map((b) => ({ label: OFFROAD_SHORT[b.key], names: b.names }))}
            />
          )}
          {settings.skills !== "off" && (
            <Breakdown
              title="Quem ajuda com o quê"
              total={x.answered}
              rows={x.skills.map((b) => ({ label: SKILL_SHORT[b.key], names: b.names }))}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Ficha de cada um</h2>
        {riders.length === 0 ? (
          <p className="card p-4 text-sm text-muted">Ninguém confirmado ainda.</p>
        ) : (
          <RiderTable riders={riders} settings={settings} />
        )}
        {waitlist.length > 0 && (
          <p className="text-sm text-muted">
            {waitlist.length} na fila de espera não entram na conta até subirem.
          </p>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{hint}</dd>
    </div>
  );
}

const TONES = {
  danger: { box: "border-danger/40 bg-danger-soft", text: "text-danger", icon: "⛔" },
  warn: { box: "border-warn/30 bg-warn-soft", text: "text-warn", icon: "⚠️" },
  info: { box: "border-line bg-surface", text: "text-ink", icon: "💡" },
} as const;

function AlertCard({ alert: a }: { alert: ConvoyAlert }) {
  const t = TONES[a.tone];
  return (
    <li className={`space-y-2 rounded-xl border p-4 ${t.box}`}>
      <p className={`font-semibold ${t.text}`}>
        <span aria-hidden>{t.icon} </span>
        {a.title}
      </p>
      {a.detail && <p className="text-sm text-ink-soft">{a.detail}</p>}
      {a.people && a.people.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {a.people.map((p) => (
            <li key={p} className="rounded-md bg-surface px-2 py-0.5 text-xs ring-1 ring-line">
              {p}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Breakdown({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: { label: string; names: string[] }[];
}) {
  const known = rows.reduce((s, r) => s + r.names.length, 0);
  return (
    <div className="card space-y-3 p-4">
      <p className="font-medium">{title}</p>
      {known === 0 ? (
        <p className="text-sm text-muted">Sem respostas ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? (r.names.length / total) * 100 : 0;
            return (
              <li key={r.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{r.label}</span>
                  <span className="text-muted tabular-nums">{r.names.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted">
                  <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${pct}%` }} />
                </div>
                {r.names.length > 0 && (
                  <p className="text-xs text-muted">{r.names.join(", ")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RiderTable({ riders, settings }: { riders: ConvoyRider[]; settings: ConvoySettings }) {
  const need = settings.longest_stretch_km
    ? Math.ceil(settings.longest_stretch_km * RANGE_MARGIN)
    : null;
  const range = (r: ConvoyRider) => {
    const p = r.profile;
    if (!p) return <span className="text-faint">—</span>;
    if (p.range_unknown) return <span className="text-warn">não sabe</span>;
    if (p.range_km === null) return <span className="text-faint">—</span>;
    return (
      <span className={need && p.range_km < need ? "font-semibold text-danger" : ""}>
        {p.range_km} km
      </span>
    );
  };
  const cc = (r: ConvoyRider) => {
    const v = r.profile?.cc ?? r.spec?.cc;
    if (v) return `${v}cc`;
    return r.profile?.cc_band ? CC_BAND_LABELS[r.profile.cc_band] : "—";
  };
  const style = (r: ConvoyRider) => {
    const s = r.profile?.style ?? r.spec?.style;
    return s ? STYLE_LABELS[s] : "";
  };
  const skills = (r: ConvoyRider) =>
    r.profile?.skills.length ? r.profile.skills.map((s) => SKILL_SHORT[s]).join(", ") : "—";

  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-muted/50 text-muted">
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Moto</th>
              <th className="px-4 py-2 text-right font-medium">Autonomia</th>
              <th className="px-4 py-2 font-medium">Estrada</th>
              <th className="px-4 py-2 font-medium">Terra</th>
              <th className="px-4 py-2 font-medium">Ajuda com</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  {r.name}
                  {r.has_pillion && <span className="text-muted"> + garupa</span>}
                  {!r.profile && <span className="block text-xs text-faint">não respondeu</span>}
                </td>
                <td className="px-4 py-2.5">
                  {r.bike}
                  <span className="block text-xs text-muted">
                    {[cc(r), style(r)].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{range(r)}</td>
                <td className="px-4 py-2.5">
                  {r.profile?.experience ? EXPERIENCE_SHORT[r.profile.experience] : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {r.profile?.offroad ? OFFROAD_SHORT[r.profile.offroad] : "—"}
                </td>
                <td className="px-4 py-2.5">{skills(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-2 md:hidden">
        {riders.map((r) => (
          <li key={r.id} className="card space-y-1 p-4 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">
                {r.name}
                {r.has_pillion && <span className="font-normal text-muted"> + garupa</span>}
              </p>
              {range(r)}
            </div>
            <p className="text-muted">
              {r.bike} · {[cc(r), style(r)].filter(Boolean).join(" · ")}
            </p>
            {r.profile ? (
              <p className="text-ink-soft">
                {[
                  r.profile.experience && EXPERIENCE_SHORT[r.profile.experience],
                  r.profile.offroad && OFFROAD_SHORT[r.profile.offroad],
                  r.profile.skills.length > 0 && skills(r),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Respondeu sem detalhes"}
              </p>
            ) : (
              <p className="text-faint">Não respondeu o Raio-X</p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
