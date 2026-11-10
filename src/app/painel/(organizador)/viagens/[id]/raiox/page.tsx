import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { bikeSpec } from "@/lib/bike-specs";
import { describeBike } from "@/lib/bikes";
import type { ConvoyRider, ConvoySettings } from "@/lib/convoy";
import { createClient } from "@/lib/supabase/server";
import { TripHeader } from "../../trip-header";
import { RaioXView } from "./view";

export const metadata: Metadata = { title: "Raio-X do comboio" };

export default async function RaioXPage({ params }: PageProps<"/painel/viagens/[id]/raiox">) {
  await requireOrganizer();
  const { id } = await params;
  const supabase = await createClient();

  // O RLS só devolve a viagem, os inscritos e as respostas do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, title, status, start_date, end_date, destination, level, terrain, convoy_range, convoy_experience, convoy_skills, longest_stretch_km",
    )
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: regs, error } = await supabase
    .from("registrations")
    .select("id, name, bike, bike_brand, bike_model, bike_year, bike_color, has_pillion, status")
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    .order("created_at");
  if (error) throw error;
  const ids = (regs ?? []).map((r) => r.id);
  const { data: profiles, error: profilesError } = ids.length
    ? await supabase.from("convoy_profiles").select("*").in("registration_id", ids)
    : { data: [], error: null };
  if (profilesError) throw profilesError;
  const byReg = new Map((profiles ?? []).map((p) => [p.registration_id, p]));

  const settings: ConvoySettings = {
    range: trip.convoy_range,
    experience: trip.convoy_experience,
    skills: trip.convoy_skills,
    longest_stretch_km: trip.longest_stretch_km,
  };
  const toRider = (r: NonNullable<typeof regs>[number]): ConvoyRider => ({
    id: r.id,
    name: r.name,
    bike: describeBike({ ...r, bike_year: null, bike_color: null }),
    has_pillion: r.has_pillion,
    profile: byReg.get(r.id) ?? null,
    spec: r.bike_brand && r.bike_model ? bikeSpec(r.bike_brand, r.bike_model) : null,
  });
  const riders = (regs ?? []).filter((r) => r.status === "confirmed").map(toRider);
  const waitlist = (regs ?? []).filter((r) => r.status === "waitlist").map(toRider);
  return (
    <div className="space-y-6">
      <TripHeader trip={trip} current="raiox" inscritos={riders.length + waitlist.length} />
      <RaioXView trip={trip} settings={settings} riders={riders} waitlist={waitlist} />
    </div>
  );
}
