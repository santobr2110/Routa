import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompassIcon, Logo } from "@/components/logo";
import { formatBRL, formatDateRangeBR } from "@/lib/format";
import { getPublicTrip, type PublicTrip } from "@/lib/public-trip";
import { tripUrl } from "@/lib/site";
import { LEVEL_LABELS, TERRAIN_LABELS, photoUrl } from "@/lib/trips";

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  if (!trip) return { title: "Viagem não encontrada" };

  const dates = formatDateRangeBR(trip.start_date, trip.end_date);
  const title = `Bora pra ${trip.destination}?`;
  const description = `${trip.title} · ${dates}. ${spotsText(trip)}. Organização: ${trip.organizer_name}.`;
  // Com foto: a capa (JPEG já reduzido no upload). Sem foto: cartão gerado em /v/[slug]/og.
  const image = trip.photos[0]
    ? { url: photoUrl(trip.photos[0]), alt: trip.title }
    : { url: `/v/${trip.slug}/og`, width: 1200, height: 630, alt: trip.title };

  return {
    title: `${trip.title} · ${dates}`,
    description,
    alternates: { canonical: tripUrl(trip.slug) },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Routa",
      url: tripUrl(trip.slug),
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

function spotsText(trip: PublicTrip): string {
  if (trip.status === "closed") return "Inscrições encerradas";
  if (trip.spots_left === 0) return "Lotou, mas tem lista de espera";
  return trip.spots_left === 1 ? "Última vaga!" : `${trip.spots_left} vagas`;
}

export default async function PublicTripPage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  if (!trip) notFound();

  const dates = formatDateRangeBR(trip.start_date, trip.end_date);
  const isOpen = trip.status === "published";
  const isFull = trip.spots_left === 0;

  return (
    <div className="flex flex-1 flex-col pb-32">
      <header className="mx-auto w-full max-w-2xl px-4 py-3">
        <Link href="/" aria-label="Routa, página inicial" className="inline-block">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-6">
        <Photos trip={trip} />

        <div className="space-y-6 px-4">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-brand">{trip.destination}</p>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight break-words">
              {trip.title}
            </h1>
            <p className="text-xl font-semibold">📅 {dates}</p>
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="Perfil da viagem">
            <Chip>Nível: {LEVEL_LABELS[trip.level]}</Chip>
            <Chip>Terreno: {TERRAIN_LABELS[trip.terrain]}</Chip>
          </ul>

          <dl className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            <Info label="Valor">
              {trip.pricing_mode === "fixed" && trip.price_cents !== null ? (
                <>
                  <span className="text-xl font-bold">{formatBRL(trip.price_cents)}</span> por
                  pessoa
                  <span className="block text-stone-600">
                    Com garupa: {formatBRL(trip.price_cents * 2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold">A definir</span>
                  <span className="block text-stone-600">
                    Rateio entre o grupo: o organizador passa o valor.
                  </span>
                </>
              )}
            </Info>
            <Info label="Vagas">
              <span className="font-bold">{spotsText(trip)}</span>
              <span className="block text-stone-600">
                {trip.capacity} motos no total. Piloto e garupa ocupam uma vaga.
              </span>
            </Info>
            <Info label="Encontro">
              {trip.meeting_point}
              {trip.meeting_point_url && (
                <a
                  href={trip.meeting_point_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex min-h-12 items-center font-semibold text-brand underline underline-offset-4"
                >
                  📍 Abrir no mapa
                </a>
              )}
            </Info>
            <Info label="Organização">{trip.organizer_name}</Info>
          </dl>

          {trip.description && (
            <section className="space-y-2">
              <h2 className="text-xl font-bold">Roteiro</h2>
              <p className="text-lg whitespace-pre-line text-stone-800">{trip.description}</p>
            </section>
          )}

          <details className="group rounded-2xl border border-stone-200 bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 text-lg font-bold">
              Termo de responsabilidade
              <span aria-hidden className="transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="px-4 pb-4 whitespace-pre-line text-stone-700">{trip.terms_text}</p>
          </details>
        </div>
      </main>

      {/* Botão fixo no rodapé: fácil de achar com o polegar. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {isOpen ? (
            <Link href={`/v/${trip.slug}/inscricao`} className="btn-primary">
              {isFull ? "Entrar na lista de espera" : "Quero ir! 🏍️"}
            </Link>
          ) : (
            <p className="flex min-h-14 items-center justify-center rounded-xl bg-stone-100 text-lg font-semibold text-stone-700">
              Inscrições encerradas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Photos({ trip }: { trip: PublicTrip }) {
  if (trip.photos.length === 0) {
    return (
      <div className="flex aspect-[2/1] items-center justify-center bg-gradient-to-br from-brand to-brand-dark sm:mx-4 sm:rounded-2xl">
        <CompassIcon className="h-20 w-20 text-white" />
      </div>
    );
  }
  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
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
          className={`aspect-[4/3] shrink-0 snap-center rounded-2xl object-cover ${
            trip.photos.length === 1 ? "w-full" : "w-[88%]"
          }`}
        />
      ))}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full bg-brand-soft px-3 py-1.5 text-base font-semibold text-brand-dark">
      {children}
    </li>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3 text-lg">
      <dt className="font-semibold text-stone-600">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
