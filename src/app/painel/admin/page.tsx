import type { Metadata } from "next";
import {
  PERIODS,
  requireAdmin,
  type AdminTripRow,
  type Analytics,
  type Dashboard,
  type PeriodKey,
} from "@/lib/admin";
import { getSiteSettings, imageUrl } from "@/lib/site-settings";
import { AdminOverview } from "./overview";

export const metadata: Metadata = {
  title: "Admin · Visão geral",
  robots: { index: false },
};

export default async function AdminPage({
  searchParams,
}: PageProps<"/painel/admin">) {
  const sp = await searchParams;
  const period: PeriodKey =
    typeof sp.periodo === "string" && sp.periodo in PERIODS
      ? (sp.periodo as PeriodKey)
      : "30";
  const { days, bucket } = PERIODS[period];

  const { user, supabase } = await requireAdmin();
  const [dashboard, analytics, upcoming, me, site] = await Promise.all([
    supabase.rpc("admin_dashboard"),
    supabase.rpc("admin_analytics", { p_days: days, p_bucket: bucket }),
    // Saídas que ainda vão acontecer em toda a plataforma (capa e instrumentos).
    supabase.rpc("admin_list_trips", {
      p_status: "published",
      p_period: "upcoming",
      p_limit: 200,
    }),
    supabase.from("organizers").select("name").eq("id", user.id).maybeSingle(),
    getSiteSettings(),
  ]);
  if (dashboard.error) throw dashboard.error;
  if (analytics.error) throw analytics.error;
  if (upcoming.error) throw upcoming.error;
  const name = me.data?.name ?? user.email?.split("@")[0] ?? "admin";

  return (
    <AdminOverview
      dashboard={dashboard.data as unknown as Dashboard}
      analytics={analytics.data as unknown as Analytics}
      period={period}
      firstName={name.split(" ")[0] ?? name}
      heroImage={imageUrl(site.panel_image_path)}
      upcoming={
        (upcoming.data as unknown as { rows: AdminTripRow[] }).rows.filter(
          (t) => !t.admin_hidden_at && !t.organizer_suspended_at,
        )
      }
    />
  );
}
