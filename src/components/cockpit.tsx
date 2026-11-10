import Image from "next/image";
import Link from "next/link";
import estrada from "@/assets/estrada-comboio.jpg";

/**
 * Foto de fundo da capa: a imagem escolhida (Site Settings ou do clube) ou a foto padrão
 * da Routa. Fica atrás de tudo (-z-20); o degradê por cima garante a leitura do texto.
 */
export function HeroPhoto({
  src,
  sizes,
  className,
}: {
  src?: string;
  sizes: string;
  className: string;
}) {
  if (src) {
    return (
      // Imagem do Storage já reduzida no envio (até 1920 px, JPEG).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    );
  }
  return <Image src={estrada} alt="" fill priority placeholder="blur" sizes={sizes} className={className} />;
}

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

/** Lotação de uma viagem para desenhar o comboio. */
export type ConvoyData = { capacity: number; confirmed: number; paid: number; waitlist: number };

/** Classes dos botões sobre a foto (iguais no painel e no admin). */
export const heroButton = {
  primary:
    "inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-[#0b1120] hover:bg-white/90",
  glass:
    "inline-flex min-h-10 items-center rounded-lg bg-white/10 px-4 text-sm font-medium ring-1 ring-white/25 backdrop-blur hover:bg-white/20",
  ghost: "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-white/80 hover:text-white",
};

/**
 * Capa com a foto da estrada: saudação, frase do dia, a próxima saída em contagem regressiva
 * e o comboio. Usada no painel do organizador e no admin (só mudam os textos e os botões).
 */
export function CockpitHero({
  firstName,
  hello,
  phrase,
  next,
  empty,
  image,
  children,
}: {
  /** URL da foto de fundo; vazio = foto padrão da Routa. */
  image?: string;
  firstName: string;
  hello: string;
  phrase: string;
  next: {
    eyebrow: string;
    title: string;
    href: string;
    subtitle: string;
    days_left: number;
    convoy: ConvoyData;
    actions?: React.ReactNode;
  } | null;
  /** O que aparece quando não há saída marcada. */
  empty: React.ReactNode;
  /** Faixa extra no pé da capa (o admin mostra as saídas seguintes). */
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#0b1120] text-white shadow-sm">
      <HeroPhoto
        src={image}
        sizes="(min-width: 1024px) 75vw, 100vw"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/70 to-[#0b1120]/20 md:bg-gradient-to-r md:from-[#0b1120]/95 md:via-[#0b1120]/70 md:to-[#0b1120]/10"
      />

      <div className="grid gap-8 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end lg:p-9">
        <div className="min-w-0 space-y-6">
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
                <p className="text-xs font-medium tracking-[0.14em] text-hero-accent uppercase">
                  {next.eyebrow}
                </p>
                <Link
                  href={next.href}
                  className="block text-xl font-semibold break-words hover:underline sm:text-2xl"
                >
                  {next.title}
                </Link>
                <p className="text-sm text-white/70">{next.subtitle}</p>
              </div>
              <Convoy trip={next.convoy} />
              {next.actions && <div className="flex flex-wrap gap-2">{next.actions}</div>}
            </div>
          ) : (
            <div className="space-y-4">{empty}</div>
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
      {children && (
        <div className="border-t border-white/10 bg-[#0b1120]/60 px-5 py-4 backdrop-blur sm:px-7 lg:px-9">
          {children}
        </div>
      )}
    </section>
  );
}

/** As saídas seguintes, como placas na beira da estrada (pé da capa do admin). */
export function RoadSigns({
  title,
  items,
}: {
  title: string;
  items: { id: string; href: string; title: string; detail: string; days_left: number; convoy: ConvoyData }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-[0.14em] text-white/60 uppercase">{title}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((t) => {
          const pct = t.convoy.capacity > 0 ? Math.min(t.convoy.confirmed / t.convoy.capacity, 1) * 100 : 0;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                className="flex h-full gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 hover:bg-white/10"
              >
                <span className="flex w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-hero-brand/15 text-hero-accent ring-1 ring-hero-accent/50">
                  <span className="text-lg leading-none font-semibold tabular-nums">
                    {t.days_left <= 0 ? "0" : t.days_left}
                  </span>
                  <span className="text-[10px] leading-tight">{t.days_left === 1 ? "dia" : "dias"}</span>
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-white/60">{t.detail}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-1 flex-1 rounded-full bg-white/10">
                      <span className="block h-1 rounded-full bg-hero-accent" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-[11px] text-white/70 tabular-nums">
                      {t.convoy.confirmed}/{t.convoy.capacity}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** O comboio: uma moto por vaga. Paga = laranja cheio, confirmada = contorno, livre = apagada. */
function Convoy({ trip }: { trip: ConvoyData }) {
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
            className={`flex h-11 w-8 items-center justify-center rounded-[5px] bg-gradient-to-b from-[#1e293b] via-[#111a2e] to-[#1e293b] font-mono text-2xl font-semibold tabular-nums ${i === digits.length - 1 ? "text-hero-accent" : "text-white"}`}
          >
            {d}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Tanque: o valor em destaque e a barra do quanto já entrou. */
export function FuelCard({
  label,
  value,
  sub,
  pct,
  stats,
}: {
  label: string;
  value: string;
  sub: string;
  /** 0 a 100: quanto do tanque está cheio. */
  pct: number;
  stats: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="card flex flex-col justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted">{sub}</p>
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
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
