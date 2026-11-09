import { formatBrPhone, formatDateTimeBR } from "@/lib/format";
import { REGISTRATION_COLUMNS, amountDue } from "@/lib/registrations";
import { createClient } from "@/lib/supabase/server";

/**
 * Planilha dos inscritos de uma viagem. Abre direto no Excel e no Google Planilhas:
 * ponto e vírgula como separador (padrão do Excel em português) e BOM para os acentos.
 */
export async function GET(_req: Request, { params }: RouteContext<"/painel/viagens/[id]/inscritos/csv">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Response("Não autorizado", { status: 401 });

  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, pricing_mode, price_cents, pillion_price_cents")
    .eq("id", id)
    .maybeSingle();
  if (!trip) return new Response("Viagem não encontrada", { status: 404 });

  const { data: rows, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    .order("status") // confirmed antes de waitlist
    .order("created_at");
  if (error) return new Response("Erro ao gerar a planilha", { status: 500 });

  const header = [
    "Situação",
    "Pagamento",
    "Valor",
    "Nome",
    "WhatsApp",
    "E-mail",
    "Moto",
    "Garupa",
    "Contato de emergência",
    "Telefone de emergência",
    "Data da inscrição",
  ];

  const lines = rows.map((r) => {
    const due = amountDue(trip, r.has_pillion);
    return [
      r.status === "confirmed" ? "Confirmado" : "Lista de espera",
      r.status === "confirmed" ? (r.payment_status === "paid" ? "Pago" : "Pendente") : "",
      // Número com vírgula decimal, para o Excel em português somar a coluna.
      due !== null ? (due / 100).toFixed(2).replace(".", ",") : "A definir",
      r.name,
      formatBrPhone(r.whatsapp),
      r.email,
      r.bike,
      r.has_pillion ? (r.pillion_name ?? "") : "",
      r.emergency_name,
      formatBrPhone(r.emergency_phone),
      formatDateTimeBR(r.created_at),
    ];
  });

  const csv = "﻿" + [header, ...lines].map((cols) => cols.map(cell).join(";")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscritos-${trip.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Uma célula do CSV: entre aspas e com aspas internas dobradas.
 * Texto que começa com = + - @ ganha um apóstrofo, para a planilha não executar como fórmula.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
