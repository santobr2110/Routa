import type { Metadata } from "next";
import { clubThemeStyle } from "@/lib/club-colors";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDateRangeBR } from "@/lib/format";
import { getPublicTrip } from "@/lib/public-trip";
import { turnstileSiteKey } from "@/lib/registration-guard";
import { RegistrationForm } from "./registration-form";

export async function generateMetadata({
  params,
}: PageProps<"/v/[slug]/inscricao">): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  // A página de inscrição não precisa aparecer em buscadores.
  return { title: trip ? `Inscrição · ${trip.title}` : "Inscrição", robots: { index: false } };
}

export default async function InscricaoPage({ params }: PageProps<"/v/[slug]/inscricao">) {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  if (!trip) notFound();

  const dates = formatDateRangeBR(trip.start_date, trip.end_date);

  return (
    <div
      className={`flex flex-1 flex-col ${trip.club?.color ? "club-theme" : ""}`}
      style={clubThemeStyle(trip.club?.color)}
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Routa, página inicial">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-12 sm:px-6">
        <Link
          href={`/v/${trip.slug}`}
          className="inline-flex min-h-11 sm:min-h-9 items-center font-semibold text-accent"
        >
          ← Ver a viagem
        </Link>

        <div className="space-y-1">
          <p className="text-base font-semibold text-accent">{trip.destination}</p>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight break-words">
            {trip.title}
          </h1>
          <p className="text-base text-muted">📅 {dates}</p>
        </div>

        {trip.registration_open ? (
          <RegistrationForm
            trip={{
              slug: trip.slug,
              title: trip.title,
              pricingMode: trip.pricing_mode,
              priceCents: trip.price_cents,
              pillionPriceCents: trip.pillion_price_cents,
              acceptsPillion: trip.accepts_pillion,
              requiresPlate: trip.requires_plate ?? false,
              convoy: trip.convoy ?? null,
              isFull: trip.spots_left === 0,
              termsText: trip.terms_text,
            }}
            turnstileSiteKey={turnstileSiteKey}
          />
        ) : (
          <p
            className="rounded-xl border border-line bg-surface p-5 text-base font-semibold"
            role="status"
          >
            As inscrições desta viagem estão encerradas.
          </p>
        )}
      </main>
    </div>
  );
}
