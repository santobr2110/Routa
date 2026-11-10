import Link from "next/link";
import { CompassIcon, Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ClubPage } from "@/lib/club";
import { clubThemeStyle } from "@/lib/club-colors";
import { formatBRL, formatBrPhone, formatDateBR, formatDateRangeBR, whatsappLink } from "@/lib/format";
import { LEVEL_LABELS, TERRAIN_LABELS, photoUrl } from "@/lib/trips";
import type { TripLevel, TripTerrain } from "@/types/database";

const nf = new Intl.NumberFormat("pt-BR");
const SINCE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "long",
  year: "numeric",
});

/** Página pública do clube: identidade, números, próximas viagens e viagens realizadas. */
export function ClubView({ club }: { club: ClubPage }) {
  const stats = [
    { label: "viagens realizadas", value: club.stats.trips_done },
    { label: "viajantes levados", value: club.stats.travelers },
    ...(club.stats.returning > 0
      ? [{ label: "voltaram para mais de uma", value: club.stats.returning }]
      : []),
  ];

  return (
    <div
      className={`flex flex-1 flex-col pb-16 ${club.color ? "club-theme" : ""}`}
      style={clubThemeStyle(club.color)}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Routa, página inicial" className="inline-block">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 sm:px-6">
        <section>
          <div className="relative overflow-hidden rounded-2xl">
            {club.cover_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(club.cover_path)}
                alt=""
                fetchPriority="high"
                className="aspect-[3/1] w-full object-cover sm:aspect-[4/1]"
              />
            ) : (
              <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-brand to-brand-dark sm:aspect-[4/1]">
                <CompassIcon className="h-14 w-14 text-on-brand/80" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            {/* Só o logo sobe sobre a capa; o nome fica abaixo dela, legível. */}
            <div className="flex items-start gap-4">
              <div className="relative z-10 -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-page bg-surface sm:-mt-12 sm:h-24 sm:w-24">
                {club.logo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(club.logo_path)} alt={`Logo ${club.name}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-brand text-2xl font-semibold text-on-brand">
                    {club.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 pt-3">
                <h1 className="page-title break-words">{club.name}</h1>
                <p className="text-sm text-muted">
                  {[club.city, `na Routa desde ${SINCE.format(new Date(club.since))}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {club.whatsapp && (
                <a
                  href={whatsappLink(club.whatsapp, `Oi! Vi a página do ${club.name} na Routa.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  aria-label={`Falar no WhatsApp ${formatBrPhone(club.whatsapp)}`}
                >
                  Falar no WhatsApp
                </a>
              )}
              {club.instagram && (
                <a
                  href={`https://instagram.com/${club.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  @{club.instagram}
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {club.bio ? (
              <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">
                {club.bio}
              </p>
            ) : (
              <p className="text-ink-soft">Viagens de moto organizadas por {club.organizer_name}.</p>
            )}
            {club.cadastur && (
              <span
                className="flex w-fit items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
                title={`Válido até ${formatDateBR(club.cadastur.valid_until)}`}
              >
                ✓ Agente de turismo verificado – Cadastur
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 self-start lg:grid-cols-1">
            {stats.map((s) => (
              <div key={s.label} className="card px-4 py-3">
                <dd className="text-2xl font-semibold tabular-nums">{nf.format(s.value)}</dd>
                <dt className="text-sm text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-4">
          <h2 className="section-title">Próximas viagens</h2>
          {club.upcoming.length === 0 ? (
            <p className="card p-6 text-center text-sm text-muted">
              Nenhuma viagem aberta agora.
              {club.instagram && " Acompanhe o Instagram do clube para saber da próxima."}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {club.upcoming.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/v/${t.slug}`}
                    className="card group block overflow-hidden transition-colors hover:border-line-hover"
                  >
                    {t.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl(t.cover)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[16/9] items-center justify-center bg-brand-soft">
                        <CompassIcon className="h-10 w-10 text-accent" />
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <div>
                        <p className="text-xs font-medium text-accent">{t.destination}</p>
                        <p className="font-semibold break-words group-hover:text-accent">{t.title}</p>
                        <p className="text-sm text-ink-soft">{formatDateRangeBR(t.start_date, t.end_date)}</p>
                      </div>
                      <p className="text-xs text-muted">
                        {LEVEL_LABELS[t.level as TripLevel]} · {TERRAIN_LABELS[t.terrain as TripTerrain]}
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="font-semibold">
                          {t.pricing_mode === "fixed" && t.price_cents !== null
                            ? formatBRL(t.price_cents)
                            : "Rateio"}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            !t.registration_open
                              ? "bg-surface-muted text-muted"
                              : t.spots_left === 0
                                ? "bg-warn-soft text-warn"
                                : "bg-success-soft text-success"
                          }`}
                        >
                          {!t.registration_open
                            ? "Inscrições encerradas"
                            : t.spots_left === 0
                              ? "Lista de espera"
                              : t.spots_left === 1
                                ? "Última vaga"
                                : `${t.spots_left} vagas`}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {club.past.length > 0 && (
          <section className="space-y-4">
            <h2 className="section-title">Já rodamos</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {club.past.map((t) => (
                <li key={t.slug} className="card overflow-hidden">
                  {t.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(t.cover)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted">
                      <CompassIcon className="h-8 w-8 text-faint" />
                    </div>
                  )}
                  <div className="space-y-0.5 p-3">
                    <p className="text-sm font-medium break-words">{t.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateBR(t.start_date)} · {t.travelers}{" "}
                      {t.travelers === 1 ? "viajante" : "viajantes"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="mx-auto mt-12 w-full max-w-6xl px-4 text-center text-xs text-muted sm:px-6">
        Viagens organizadas com a{" "}
        <Link href="/" className="font-medium text-accent hover:underline">
          Routa
        </Link>
        . Bora de cara pro vento?
      </footer>
    </div>
  );
}
