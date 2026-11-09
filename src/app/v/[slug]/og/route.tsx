import { ImageResponse } from "next/og";
import { formatDateRangeBR } from "@/lib/format";
import { getPublicTrip } from "@/lib/public-trip";

/**
 * Cartão de prévia (1200×630) para viagens sem foto.
 * Fundo liso para o PNG ficar leve (o WhatsApp ignora imagens pesadas).
 * Atenção (Satori): div com mais de um filho precisa de display: flex. Por isso o texto
 * dinâmico vai numa template string só, e não como "Texto {variavel}".
 */
export async function GET(_req: Request, { params }: RouteContext<"/v/[slug]/og">) {
  const { slug } = await params;
  const trip = await getPublicTrip(slug);
  if (!trip) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#c2410c",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 700 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="none" stroke="white" strokeWidth="2.5" />
            <path d="M16 5.5 20 16h-8z" fill="#fed7aa" />
            <path d="M16 26.5 12 16h8z" fill="white" />
          </svg>
          Routa
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 40, opacity: 0.9 }}>{`Bora pra ${trip.destination}?`}</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{trip.title}</div>
        </div>
        <div style={{ display: "flex", fontSize: 40 }}>
          {`📅 ${formatDateRangeBR(trip.start_date, trip.end_date)}`}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
