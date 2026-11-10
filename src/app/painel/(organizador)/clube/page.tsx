import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { ClubForm } from "./club-form";

export const metadata: Metadata = { title: "Página do clube" };

export default async function ClubePage() {
  const { organizer } = await requireOrganizer();
  const supabase = await createClient();
  const { data: page, error } = await supabase
    .from("organizers")
    .select(
      "page_enabled, page_slug, page_name, page_bio, page_city, page_instagram, page_show_whatsapp, page_color, page_logo_path, page_cover_path",
    )
    .eq("id", organizer.id)
    .single();
  if (error) throw error;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="page-title">Página do clube</h1>
          <p className="text-sm text-muted">
            Uma página só do seu clube, com logo, cor, as próximas viagens e o que vocês já
            rodaram. Bom para pôr na bio do Instagram e mandar no grupo.
          </p>
        </div>
        {page.page_enabled && page.page_slug && (
          <Link href={`/c/${page.page_slug}`} target="_blank" className="btn-secondary">
            Ver a página ↗
          </Link>
        )}
      </div>
      <ClubForm
        organizerId={organizer.id}
        siteUrl={siteUrl}
        initial={{
          page_enabled: page.page_enabled ? "on" : "",
          page_slug: page.page_slug ?? slugify(organizer.name).slice(0, 40).replace(/-+$/, ""),
          page_name: page.page_name ?? organizer.name,
          page_bio: page.page_bio ?? "",
          page_city: page.page_city ?? "",
          page_instagram: page.page_instagram ?? "",
          page_show_whatsapp: page.page_show_whatsapp ? "on" : "",
          page_color: page.page_color ?? "",
          page_logo_path: page.page_logo_path ?? "",
          page_cover_path: page.page_cover_path ?? "",
        }}
      />
    </div>
  );
}
