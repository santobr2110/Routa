import { REGISTRATION_COLUMNS } from "@/lib/registrations";
import { buildRegistrationsWorkbook } from "@/lib/registrations-xlsx";
import { createClient } from "@/lib/supabase/server";

/** Planilha Excel (.xlsx) formatada com os inscritos de uma viagem. */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/painel/viagens/[id]/inscritos/planilha">,
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Response("Não autorizado", { status: 401 });

  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select("slug, title, start_date, end_date, capacity, pricing_mode, price_cents, pillion_price_cents")
    .eq("id", id)
    .maybeSingle();
  if (!trip) return new Response("Viagem não encontrada", { status: 404 });

  const { data: rows, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("trip_id", id)
    .neq("status", "cancelled")
    .order("queued_at")
    .order("created_at");
  if (error) return new Response("Erro ao gerar a planilha", { status: 500 });

  const file = await buildRegistrationsWorkbook(trip, rows);

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inscritos-${trip.slug}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
