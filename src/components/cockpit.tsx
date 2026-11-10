import Image from "next/image";
import Link from "next/link";
import estrada from "@/assets/estrada-comboio.jpg";
import { formatBRL, formatDateRangeBR } from "@/lib/format";
import type { OrganizerOverview } from "@/lib/organizer-stats";

type Upcoming = OrganizerOverview["upcoming"][number];

/** Frases de estrada: muda uma por dia (mesma frase o dia todo). */
const ROAD_PHRASES = [
  "A melhor curva é sempre a próxima.",
  "Quem organiza faz a estrada acontecer.",
  "Comboio bom é comboio que chega junto.",
  "Tanque cheio, grupo fechado, cabeça leve.",
  "Viagem boa se mede em histórias, não em quilômetros.",
  "Toda saída começa com um link no grupo.",
  "Vento na cara e vaga garantida.",
  "O destino é desculpa. O caminho é o motivo.",
];

/** Bom dia / boa tarde / boa noite (horário de Brasília) + frase do dia. */
export function roadGreeting(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const day = Math.floor(now.getTime() / 86_400_000);
  return {
    hello: hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite",
    phrase: ROAD_PHRASES[day % ROAD_PHRASES.length],
  };
}

function countdown(days: number) {
  if (days > 1) return { big: String(days), small: "dias para a saída" };
  if (days === 1) return { big: "1", small: "dia: amanhã tem estrada" };
  if (days === 0) return { big: "Hoje", small: "é dia de estrada" };
  return { big: "Agora", small: "o grupo está na estrada" };
}

/** Capa do painel: saudação, a próxima saída em contagem regressiva e o comboio. */
export function CockpitHero({
  firstName,
  hello,
  phrase,
  next,
}: {
  firstName: string;
  hello: string;
  phrase: string;
  next: Upcoming | null;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#0b1120] text-white shadow-sm">
      <Image
        src={estrada}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 1024px) 75vw, 100vw"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/70 to-[#0b1120]/20 md:bg-gradient-to-r md:from-[#0b1120]/95 md:via-[#0b1120]/70 md:to-[#0b1120]/10"
      />

      <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end lg:p-9">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <p className="text-sm text-white/70">
              {hello}, {firstName} 👋
            </p>
            <p className="max-w-lg text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              “{phrase}”
            </p>
          </div>

          {next ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-[0.14em] text-orange-300 uppercase">
                  Próxima saída{next.status === "draft" && " · rascunho"}
                </p>
                <Link
                  href={`/painel/viagens/${next.id}`}
                  className="block text-xl font-semibold break-words hover:underline sm:text-2xl"
                >
                  {next.title}
                </Link>
                <p className="text-sm text-white/70">
                  {next.destination} · {formatDateRangeBR(next.start_date, next.end_date)}
                </p>
              </div>
              <Convoy trip={next} />
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/painel/viagens/${next.id}/inscritos`}
                  className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-[#0b1120] hover:bg-white/90"
                >
                  Ver o comboio
                </Link>
                {next.paid < next.confirmed && (
                  <Link
                    href={`/painel/viagens/${next.id}/cobranca`}
                    className="inline-flex min-h-10 items-center rounded-lg bg-white/10 px-4 text-sm font-medium ring-1 ring-white/25 backdrop-blur hover:bg-white/20"
                  >
                    Cobrar {next.confirmed - next.paid} pendente{next.confirmed - next.paid === 1 ? "" : "s"}
                  </Link>
                )}
                <Link
                  href="/painel/viagens/nova"
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-white/80 hover:text-white"
                >
                  + Nova viagem
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="max-w-md text-white/80">
                Nenhuma saída marcada. A estrada está esperando: monta a próxima e manda o link pro
                grupo.
              </p>
              <Link
                href="/painel/viagens/nova"
                className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 font-semibold text-[#0b1120] hover:bg-white/90"
              >
                + Criar viagem
              </Link>
            </div>
          )}
        </div>

        {next && (
          <div className="flex items-end gap-3 md:flex-col md:items-end md:gap-0 md:text-right">
            <p className="cockpit-count text-6xl leading-none font-semibold tracking-tighter tabular-nums sm:text-7xl lg:text-8xl">
              {countdown(next.days_left).big}
            </p>
            <p className="pb-1 text-sm text-white/70 md:pb-0">{countdown(next.days_left).small}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** O comboio: uma moto por vaga. Paga = laranja cheio, confirmada = contorno, livre = apagada. */
function Convoy({ trip }: { trip: Upcoming }) {
  const shown = Math.min(trip.capacity, 48);
  const seats = Array.from({ length: shown }, (_, i) =>
    i < trip.paid ? "paid" : i < trip.confirmed ? "confirmed" : "free",
  );
  const free = Math.max(trip.capacity - trip.confirmed, 0);
  return (
    <div className="space-y-2">
      <ul className="flex max-w-xl flex-wrap gap-1.5" aria-hidden>
        {seats.map((s, i) => (
          <li
            key={i}
            className="convoy-seat"
            style={{ animationDelay: `${i * 35}ms` }}
            data-state={s}
          >
            <BikeIcon />
          </li>
        ))}
        {trip.capacity > shown && (
          <li className="self-center text-xs text-white/60">+{trip.capacity - shown}</li>
        )}
      </ul>
      <p className="text-sm text-white/80">
        <strong className="text-white">{trip.confirmed}</strong> de {trip.capacity} motos
        confirmadas · <strong className="text-white">{trip.paid}</strong> pagas
        {free > 0 ? ` · ${free} vaga${free === 1 ? "" : "s"} livre${free === 1 ? "" : "s"}` : " · lotada 🔥"}
        {trip.waitlist > 0 && ` · ${trip.waitlist} na fila`}
      </p>
    </div>
  );
}

function BikeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5 9 10h5l3 6.5M14 10l-1.5-3H10M15 7h3l1 3" />
    </svg>
  );
}

/** Mostrador analógico (meia-lua com ponteiro), como no painel da moto. */
export function Gauge({
  label,
  value,
  hint,
}: {
  label: string;
  /** 0 a 1, ou null quando não há base. */
  value: number | null;
  hint: string;
}) {
  const v = value === null ? 0 : Math.min(Math.max(value, 0), 1);
  const angle = -90 + v * 180;
  const ticks = Array.from({ length: 11 }, (_, i) => -90 + i * 18);
  return (
    <div className="card flex flex-col items-center gap-1 px-3 pt-4 pb-3 text-center sm:px-4">
      <svg viewBox="0 0 200 116" className="w-full max-w-[220px]" role="img" aria-label={`${label}: ${value === null ? "sem dados" : `${Math.round(v * 100)}%`}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-muted)" strokeWidth="14" strokeLinecap="round" />
        {value !== null && v > 0 && (
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${v * 100} 100`}
            className="gauge-arc"
          />
        )}
        {ticks.map((t, i) => (
          <line
            key={t}
            x1="100"
            y1={i % 5 === 0 ? 34 : 38}
            x2="100"
            y2="44"
            stroke="var(--faint)"
            strokeWidth={i % 5 === 0 ? 2 : 1}
            transform={`rotate(${t} 100 100)`}
          />
        ))}
        <g className="gauge-needle" style={{ "--to": `${angle}deg` } as React.CSSProperties} transform={`rotate(${angle} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="40" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="var(--ink)" />
        <circle cx="100" cy="100" r="3" fill="var(--accent)" />
      </svg>
      <p className="-mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
        {value === null ? "—" : `${Math.round(v * 100)}%`}
      </p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Odômetro: números em "roletes", como o painel antigo de moto. */
export function Odometer({ label, value, hint }: { label: string; value: number; hint: string }) {
  const digits = String(Math.max(0, Math.floor(value))).padStart(5, "0").split("");
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-4 text-center">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1 rounded-lg bg-[#0b1120] p-1.5 ring-1 ring-black/10" aria-label={`${value}`}>
        {digits.map((d, i) => (
          <span
            key={i}
            className={`flex h-11 w-8 items-center justify-center rounded-[5px] bg-gradient-to-b from-[#1e293b] via-[#111a2e] to-[#1e293b] font-mono text-2xl font-semibold tabular-nums ${i === digits.length - 1 ? "text-orange-300" : "text-white"}`}
          >
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Tanque: o que falta receber, com a barra do que já entrou. */
export function FuelCard({
  toReceive,
  received,
  openTrips,
  waitlist,
}: {
  toReceive: number;
  received: number;
  openTrips: number;
  waitlist: number;
}) {
  const total = toReceive + received;
  const pct = total > 0 ? (received / total) * 100 : 0;
  return (
    <div className="card flex flex-col justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium">A receber</p>
        <p className="text-2xl font-semibold tabular-nums">{formatBRL(toReceive)}</p>
        <p className="text-xs text-muted">{formatBRL(received)} já entrou</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-muted">
          <span>R</span>
          <div className="flex h-2.5 flex-1 gap-0.5" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-sm ${i < Math.round(pct / 10) ? "bg-success" : "bg-surface-muted"}`}
              />
            ))}
          </div>
          <span>C</span>
        </div>
        <p className="text-xs text-muted">{Math.round(pct)}% do tanque cheio</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Viagens abertas</dt>
          <dd className="font-semibold tabular-nums">{openTrips}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Na fila</dt>
          <dd className="font-semibold tabular-nums">{waitlist}</dd>
        </div>
      </dl>
    </div>
  );
}
