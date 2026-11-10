import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClubPage } from "@/lib/club";
import { siteUrl } from "@/lib/site";
import { photoUrl } from "@/lib/trips";
import { ClubView } from "./club-view";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubPage(slug);
  if (!club) return { title: "Clube não encontrado" };

  const open = club.upcoming.filter((t) => t.registration_open).length;
  const description =
    club.bio?.slice(0, 160) ??
    `Viagens de moto do ${club.name}${open ? `: ${open} viagem(ns) com inscrição aberta` : ""}.`;
  const url = `${siteUrl}/c/${club.slug}`;
  const image = club.cover_path ?? club.logo_path;

  return {
    title: club.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Routa",
      url,
      title: `${club.name} · viagens de moto`,
      description,
      images: image ? [{ url: photoUrl(image), alt: club.name }] : undefined,
    },
  };
}

export default async function ClubPublicPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const club = await getClubPage(slug);
  if (!club) notFound();
  return <ClubView club={club} />;
}
