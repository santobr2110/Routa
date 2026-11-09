import ExcelJS from "exceljs";
import { formatBRL, formatBrPhone, formatDateRangeBR, formatDateTimeBR } from "@/lib/format";
import { describeBike, formatPlate } from "@/lib/bikes";
import { amountDue } from "@/lib/registrations";
import type { Database } from "@/types/database";

type Trip = Pick<
  Database["public"]["Tables"]["trips"]["Row"],
  | "title"
  | "start_date"
  | "end_date"
  | "capacity"
  | "pricing_mode"
  | "price_cents"
  | "pillion_price_cents"
>;

type Registration = Pick<
  Database["public"]["Tables"]["registrations"]["Row"],
  | "name"
  | "whatsapp"
  | "email"
  | "bike"
  | "bike_brand"
  | "bike_model"
  | "bike_year"
  | "bike_color"
  | "bike_plate"
  | "has_pillion"
  | "pillion_name"
  | "emergency_name"
  | "emergency_phone"
  | "payment_status"
  | "status"
  | "created_at"
>;

// Cores da Routa (ARGB) e de apoio.
const BRAND = "FFC2410C";
const WHITE = "FFFFFFFF";
const BORDER = "FFD6D3D1";
const ZEBRA = "FFFAFAF9";
const PAID = { fill: "FFDCFCE7", font: "FF166534" };
const PENDING = { fill: "FFFEF3C7", font: "FF78350F" };
const MUTED = "FF78716C";

const BRL_FORMAT = '"R$" #,##0.00';

const COLUMNS = [
  { key: "status", header: "Situação", width: 16 },
  { key: "payment", header: "Pagamento", width: 13 },
  { key: "amount", header: "Valor", width: 14 },
  { key: "name", header: "Nome", width: 28 },
  { key: "whatsapp", header: "WhatsApp", width: 17 },
  { key: "email", header: "E-mail", width: 30 },
  { key: "bike", header: "Moto", width: 30 },
  { key: "plate", header: "Placa", width: 11 },
  { key: "pillion", header: "Garupa", width: 22 },
  { key: "emergency_name", header: "Contato de emergência", width: 24 },
  { key: "emergency_phone", header: "Telefone de emergência", width: 20 },
  { key: "created_at", header: "Data da inscrição", width: 18 },
] as const;

/**
 * Data/hora como o Excel deve mostrar no horário de Brasília. O Excel não tem fuso:
 * montamos uma data "UTC" com os números do relógio de Brasília.
 */
function brasiliaDate(iso: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return new Date(
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute),
  );
}

/**
 * Monta a planilha dos inscritos de uma viagem, já formatada. Devolve o arquivo .xlsx.
 * (No .xlsx o texto é gravado como texto: um nome começando com "=" não vira fórmula.)
 */
export async function buildRegistrationsWorkbook(
  trip: Trip,
  registrations: Registration[],
  now = new Date(),
): Promise<ArrayBuffer> {
  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const paid = confirmed.filter((r) => r.payment_status === "paid");
  const sum = (rows: Registration[]) =>
    rows.reduce((total, r) => total + (amountDue(trip, r.has_pillion) ?? 0), 0);
  const fixed = trip.pricing_mode === "fixed";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Routa";
  wb.created = now;
  const ws = wb.addWorksheet("Inscritos", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  });
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const lastCol = COLUMNS.length;

  // Cabeçalho do documento: título, datas e resumo.
  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell(1, 1).value = `${trip.title} · Inscritos`;
  ws.getCell(1, 1).font = { bold: true, size: 16, color: { argb: BRAND } };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell(2, 1).value =
    `${formatDateRangeBR(trip.start_date, trip.end_date)} · ` +
    `Planilha gerada em ${formatDateTimeBR(now.toISOString())} pela Routa`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: MUTED } };

  ws.mergeCells(3, 1, 3, lastCol);
  ws.getCell(3, 1).value = [
    `Vagas: ${confirmed.length} de ${trip.capacity}`,
    `Pagos: ${paid.length} de ${confirmed.length}`,
    `Na fila: ${waitlist.length}`,
    ...(fixed ? [`A receber: ${formatBRL(sum(confirmed))}`, `Recebido: ${formatBRL(sum(paid))}`] : []),
  ].join("   ·   ");
  ws.getCell(3, 1).font = { bold: true, size: 11 };

  // Linha de títulos da tabela.
  const headerRow = ws.getRow(5);
  headerRow.values = COLUMNS.map((c) => c.header);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  // Uma linha por inscrito: confirmados primeiro, depois a fila (em ordem de chegada).
  const ordered = [...confirmed, ...waitlist];
  ordered.forEach((r, i) => {
    const due = amountDue(trip, r.has_pillion);
    const isConfirmed = r.status === "confirmed";
    const row = ws.addRow({
      status: isConfirmed ? "Confirmado" : `Lista de espera (${i - confirmed.length + 1}º)`,
      payment: isConfirmed ? (r.payment_status === "paid" ? "Pago" : "Pendente") : "",
      amount: due !== null ? due / 100 : "A definir",
      name: r.name,
      whatsapp: formatBrPhone(r.whatsapp),
      email: r.email,
      bike: describeBike(r),
      plate: r.bike_plate ? formatPlate(r.bike_plate) : "",
      pillion: r.has_pillion ? r.pillion_name ?? "" : "",
      emergency_name: r.emergency_name,
      emergency_phone: formatBrPhone(r.emergency_phone),
      created_at: brasiliaDate(r.created_at),
    });
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      if (!isConfirmed) cell.font = { italic: true, color: { argb: MUTED } };
    });

    row.getCell("amount").numFmt = BRL_FORMAT;
    row.getCell("created_at").numFmt = "dd/mm/yyyy hh:mm";
    if (isConfirmed) {
      const colors = r.payment_status === "paid" ? PAID : PENDING;
      const payment = row.getCell("payment");
      payment.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.fill } };
      payment.font = { bold: true, color: { argb: colors.font } };
      payment.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  // Filtro nos títulos (as setinhas do Excel) e totais com fórmula, para continuar
  // certos se o organizador mudar "Pendente" para "Pago" na própria planilha.
  const firstData = 6;
  const lastData = 5 + ordered.length;
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(lastData, 5), column: lastCol } };

  if (fixed && ordered.length > 0) {
    const range = (col: string) => `${col}${firstData}:${col}${lastData}`;
    const totals: [string, string, number][] = [
      [
        "Total a receber (confirmados)",
        `SUMIFS(${range("C")},${range("A")},"Confirmado")`,
        sum(confirmed) / 100,
      ],
      [
        "Já recebido (pagos)",
        `SUMIFS(${range("C")},${range("A")},"Confirmado",${range("B")},"Pago")`,
        sum(paid) / 100,
      ],
    ];
    ws.addRow([]);
    for (const [label, formula, result] of totals) {
      const row = ws.addRow({ payment: label, amount: { formula, result } });
      ws.mergeCells(row.number, 1, row.number, 2);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true };
      row.getCell(1).alignment = { horizontal: "right" };
      row.getCell("amount").numFmt = BRL_FORMAT;
      row.getCell("amount").font = { bold: true };
    }
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
