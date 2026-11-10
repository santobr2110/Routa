import Link from "next/link";
import { CompassIcon, Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { deadlineText, formatBRL, formatDateBR, formatDateRangeBR, formatDateTimeBR } from "@/lib/format";
import type { PublicTrip } from "@/lib/public-trip";
import { LEVEL_LABELS, TERRAIN_LABELS, photoUrl } from "@/lib/trips";

export function spotsText(trip: PublicTrip): string {
  if (!trip.registration_open) return "Inscrições encerradas";
  if (trip.spots_left === 0) return "Lotou, mas tem lista de espera";
  return trip.spots_left === 1 ? "Última vaga!" : `${trip.spots_left} vagas`;
}

/**
 * Página pública da viagem. Celular: uma coluna e botão fixo no rodapé.
 * Desktop (lg): conteúdo à esquerda e um cartão fixo à direita com valor, vagas e inscrição.
 */
export function TripView({ trip }: { trip: PublicTrip }) {
  const dates = formatDateRangeBR(trip.start_date, trip.end_date);
  const isOpen = trip.registration_open;
  const isFull = trip.spots_left === 0;
  const cta = isOpen ? (
    <Link href={`/v/${trip.slug}/inscricao`} className="btn-primary sm:w-full">
      {isFull ? "Entrar na lista de espera" : "Quero ir"}
    </Link>
  ) : (
    <p className="flex min-h-10 items-center justify-center rounded-lg bg-surface-muted text-sm font-medium text-ink-soft">
      Inscrições encerradas
    </p>
  );

  return (
    <div className="flex flex-1 flex-col pb-28 lg:pb-16">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Routa, página inicial" className="inline-block">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="space-y-1.5 pt-2 pb-5 sm:pt-4">
          <p className="text-sm font-medium text-accent">{trip.destination}</p>
          <h1 className="page-title break-words sm:text-4xl">{trip.title}</h1>
          <p className="text-[15px] text-ink-soft">
            {dates}
            {trip.departure_time && ` · saída às ${trip.departure_time}`}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <div className="min-w-0 space-y-8">
            <Photos trip={trip} />

            <ul className="flex flex-wrap gap-2" aria-label="Perfil da viagem">
              <Chip>Nível: {LEVEL_LABELS[trip.level]}</Chip>
              <Chip>
                {TERRAIN_LABELS[trip.terrain]} · {trip.terrain_percent}%
              </Chip>
              {trip.accepts_pillion ? <Chip>Aceita garupa</Chip> : <Chip>Sem garupa</Chip>}
            </ul>

            {/* No celular, valor e vagas aparecem aqui; no desktop, no cartão ao lado. */}
            <div className="lg:hidden">
              <Summary trip={trip} />
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <Place
                title="Saída"
                when={`${formatDateBR(trip.start_date)}${trip.departure_time ? ` às ${trip.departure_time}` : ""}`}
                where={trip.departure_point}
                url={trip.departure_point_url}
              />
              <Place
                title="Retorno"
                when={`${formatDateBR(trip.end_date)}${trip.return_time ? `, previsão ${trip.return_time}` : ""}`}
                where={trip.return_point ?? "Mesmo local da saída"}
                url={trip.return_point_url}
              />
            </section>

            {trip.description && (
              <section className="space-y-2">
                <h2 className="section-title">Roteiro</h2>
                <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">
                  {trip.description}
                </p>
              </section>
            )}

            <details className="group card">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium sm:min-h-10">
                Termo de responsabilidade
                <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="max-w-prose px-4 pb-4 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                {trip.terms_text}
              </p>
            </details>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <Summary trip={trip} />
              {cta}
              <p className="text-center text-xs text-muted">
                O pagamento é combinado direto com o organizador, por Pix.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Celular: botão fixo no rodapé, fácil de achar com o polegar. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-2xl">{cta}</div>
      </div>
    </div>
  );
}

/** Valor, vagas e organização: o resumo para decidir. */
function Summary({ trip }: { trip: PublicTrip }) {
  const fixed = trip.pricing_mode === "fixed" && trip.price_cents !== null;
  return (
    <div className="card divide-y divide-line">
      <div className="space-y-1 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Valor</p>
        {fixed ? (
          <>
            <p className="text-2xl font-semibold tracking-tight">
              {formatBRL(trip.price_cents!)}
              <span className="text-sm font-normal text-muted"> piloto</span>
            </p>
            {trip.pillion_price_cents !== null && (
              <p className="text-sm text-ink-soft">
                {formatBRL(trip.pillion_price_cents)} piloto + garupa
              </p>
            )}
            <p className="pt-1 text-sm text-muted">{paymentText(trip)}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">A definir</p>
            <p className="text-sm text-muted">Rateio entre o grupo: o organizador passa o valor.</p>
            <p className="pt-1 text-sm text-muted">{paymentText(trip)}</p>
          </>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Vagas</p>
        <p className="font-semibold">{spotsText(trip)}</p>
        <SpotsBar trip={trip} />
        <p className="text-sm text-muted">
          {trip.capacity} motos no total.{trip.accepts_pillion && " Piloto e garupa ocupam uma vaga."}
        </p>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Organização</p>
        <p className="font-medium">{trip.organizer_name}</p>
        {trip.organizer_cadastur && (
          <>
            <span
              className="flex w-fit items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
              title={`Cadastur conferido pela Routa em ${formatDateTimeBR(trip.organizer_cadastur.verified_at)}`}
            >
              ✓ Agente de turismo verificado – Cadastur
            </span>
            <p className="text-xs text-muted">
              Verificado pela Routa · válido até {formatDateBR(trip.organizer_cadastur.valid_until)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SpotsBar({ trip }: { trip: PublicTrip }) {
  const taken = Math.min(trip.capacity - trip.spots_left, trip.capacity);
  const pct = trip.capacity > 0 ? (taken / trip.capacity) * 100 : 0;
  return (
    <div
      className="h-1.5 rounded-full bg-surface-muted"
      role="img"
      aria-label={`${taken} de ${trip.capacity} vagas preenchidas`}
    >
      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Place({ title, when, where, url }: { title: string; when: string; where: string; url: string | null }) {
  return (
    <div className="card space-y-1 p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <p className="font-medium">{when}</p>
      <p className="text-sm text-ink-soft">{where}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 sm:min-h-8"
        >
          Abrir no mapa ↗
        </a>
      )}
    </div>
  );
}

/** Celular: carrossel. Desktop: capa grande + miniaturas em grade. */
function Photos({ trip }: { trip: PublicTrip }) {
  if (trip.photos.length === 0) {
    return (
      <div className="flex aspect-[2/1] items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark">
        <CompassIcon className="h-16 w-16 text-white/90" />
      </div>
    );
  }
  const [cover, ...rest] = trip.photos;
  return (
    <>
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:hidden"
        aria-label={`Fotos (${trip.photos.length})`}
      >
        {trip.photos.map((path, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={path}
            src={photoUrl(path)}
            alt={i === 0 ? trip.title : `Foto ${i + 1} da viagem`}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            className={`aspect-[4/3] shrink-0 snap-center rounded-xl object-cover ${trip.photos.length === 1 ? "w-full" : "w-[88%]"}`}
          />
        ))}
      </div>
      <div className={`hidden gap-2 sm:grid ${rest.length > 0 ? "sm:grid-cols-[2fr_1fr]" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(cover!)}
          alt={trip.title}
          fetchPriority="high"
          className="aspect-[4/3] w-full rounded-xl object-cover"
        />
        {rest.length > 0 && (
          <div className="grid grid-rows-2 gap-2">
            {rest.slice(0, 2).map((path, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={path}
                src={photoUrl(path)}
                alt={`Foto ${i + 2} da viagem`}
                loading="lazy"
                className="h-full w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft">{children}</li>
  );
}

/** "Pix" ou "Pix ou cartão", com o valor no cartão quando for diferente. */
function paymentText(trip: PublicTrip): string {
  const deadline = trip.payment_deadline_hours
    ? ` Pague em até ${deadlineText(trip.payment_deadline_hours)} depois de garantir a vaga.`
    : "";
  return methodsText(trip) + deadline;
}

function methodsText(trip: PublicTrip): string {
  if (!trip.accepts_card) return "Pagamento por Pix.";
  const solo =
    trip.card_price_cents && trip.price_cents !== null && trip.card_price_cents !== trip.price_cents
      ? trip.card_price_cents
      : null;
  const duo =
    trip.card_pillion_price_cents &&
    trip.pillion_price_cents !== null &&
    trip.card_pillion_price_cents !== trip.pillion_price_cents
      ? trip.card_pillion_price_cents
      : null;
  if (!solo && !duo) return "Pix ou cartão de crédito.";
  const parts = [solo && `${formatBRL(solo)} piloto`, duo && `${formatBRL(duo)} com garupa`].filter(
    Boolean,
  );
  return `Pix ou cartão de crédito (no cartão: ${parts.join(", ")}).`;
}
