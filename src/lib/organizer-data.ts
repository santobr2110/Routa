import { createClient } from "@/lib/supabase/server";
import {
  STATS_REG_COLUMNS,
  STATS_TRIP_COLUMNS,
  type StatsReg,
  type StatsTrip,
} from "./organizer-stats";

const PAGE = 1000; // limite de linhas por pedido no Supabase

/**
 * Todas as viagens e inscrições do organizador logado (o RLS só devolve as dele).
 * Lê em páginas para não esbarrar no limite de 1000 linhas.
 */
export async function loadOrganizerData(): Promise<{ trips: StatsTrip[]; regs: StatsReg[] }> {
  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select(STATS_TRIP_COLUMNS)
    .order("start_date");
  if (error) throw error;

  const regs: StatsReg[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error: regError } = await supabase
      .from("registrations")
      .select(STATS_REG_COLUMNS)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (regError) throw regError;
    regs.push(...data);
    if (data.length < PAGE) break;
  }
  return { trips, regs };
}
