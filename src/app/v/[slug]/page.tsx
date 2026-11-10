import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateRangeBR } from "@/lib/format";
import { getPublicTrip } from "@/lib/public-trip";
import { tripUrl } from "@/lib/site";
import { photoUrl } from "@/lib/trips";
import { TripView, spotsText } from "./trip-view";

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

export default async function PublicTripPage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  if (!trip) notFound();
  return <TripView trip={trip} />;
}
