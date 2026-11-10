import type { Metadata } from "next";
import {
  PERIODS,
  requireAdmin,
  type Analytics,
  type Dashboard,
  type PeriodKey,
} from "@/lib/admin";
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

  const { supabase } = await requireAdmin();
  const [dashboard, analytics] = await Promise.all([
    supabase.rpc("admin_dashboard"),
    supabase.rpc("admin_analytics", { p_days: days, p_bucket: bucket }),
  ]);
  if (dashboard.error) throw dashboard.error;
  if (analytics.error) throw analytics.error;

  return (
    <AdminOverview
      dashboard={dashboard.data as unknown as Dashboard}
      analytics={analytics.data as unknown as Analytics}
      period={period}
    />
  );
}
