import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { describeBike, formatPlate } from "@/lib/bikes";
import { formatBRL, formatBrPhone, formatDateTimeBR, formatDueBR, whatsappLink } from "@/lib/format";
import { pixPayload, pixTxid } from "@/lib/pix";
import { REGISTRATION_COLUMNS, amountDue, changedRecently, isOverdue } from "@/lib/registrations";
import { createClient } from "@/lib/supabase/server";
import { cancelRegistration, releaseRegistration } from "./actions";
import { PaymentToggle } from "./payment-toggle";
import { RemoveButton } from "./remove-button";
import { TripHeader } from "../../trip-header";

export const metadata: Metadata = { title: "Inscritos" };

const FILTERS = {
  todos: "Todos",
  pendentes: "Pendentes",
  vencidos: "Prazo vencido",
  pagos: "Pagos",
} as const;
type Filter = keyof typeof FILTERS;

export default async function InscritosPage({
  params,
  searchParams,
}: PageProps<"/painel/viagens/[id]/inscritos">) {
  const { organizer } = await requireOrganizer();
  const { id } = await params;
  const { filtro, promovido, removido, liberado, erro } = await searchParams;
  const filter: Filter =
    typeof filtro === "string" && filtro in FILTERS ? (filtro as Filter) : "todos";

  const supabase = await createClient();
  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, title, status, start_date, end_date, destination, capacity, pricing_mode, price_cents, pillion_price_cents, pix_key, card_enabled, card_url, card_pillion_url, card_price_cents, card_pillion_price_cents, payment_deadline_hours, payment_deadline_action",
    )
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: registrations, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    // A ordem da fila é queued_at (quem perde a vaga por prazo vai para o fim).
    .order("queued_at")
    .order("created_at");
  if (error) throw error;

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const paidCount = confirmed.filter((r) => r.payment_status === "paid").length;
  const overdue = confirmed.filter((r) => isOverdue(r));
  const shown = confirmed.filter(
    (r) =>
      filter === "todos" ||
      (filter === "pagos"
        ? r.payment_status === "paid"
        : filter === "vencidos"
          ? isOverdue(r)
          : r.payment_status === "pending"),
  );

  // Quem acabou de sair da fila (veio na URL depois de remover ou liberar alguém).
  const promotedIds = typeof promovido === "string" ? promovido.split(",") : [];
  const promoted = confirmed.filter((r) => promotedIds.includes(r.id));
  const released = waitlist.find((r) => r.id === liberado);
  // Mudanças da fila nos últimos 7 dias (inclusive as automáticas), para avisar as pessoas.
  const recentPromoted = confirmed.filter(
    (r) => changedRecently(r.promoted_at) && !promotedIds.includes(r.id),
  );
  const recentReleased = waitlist.filter(
    (r) => changedRecently(r.released_at) && r.id !== liberado,
  );
  const pixCode = (registrationId: string, amount: number | null) =>
    pixPayload({
      key: trip.pix_key,
      name: organizer.name,
      amountCents: amount,
      txid: pixTxid(registrationId),
    });
  const cardText = (hasPillion: boolean) => {
    if (!trip.card_enabled || !trip.card_url) return "";
    const url = hasPillion ? (trip.card_pillion_url ?? trip.card_url) : trip.card_url;
    const amount =
      trip.pricing_mode !== "fixed"
        ? null
        : hasPillion
          ? (trip.card_pillion_price_cents ?? trip.pillion_price_cents)
          : (trip.card_price_cents ?? trip.price_cents);
    return `\n\nPrefere cartão de crédito? ${amount ? `${formatBRL(amount)} por este link: ` : "É por este link: "}${url}`;
  };
  const promotedMessage = (r: (typeof confirmed)[number]) => {
    const due = amountDue(trip, r.has_pillion);
    return [
      `Oi, ${r.name.split(" ")[0]}! Abriu uma vaga no ${trip.title} e ela é sua! 🎉`,
      due !== null ? `O valor é ${formatBRL(due)}.` : "Já te passo o valor do rateio.",
      r.payment_due_at ? `Para garantir, pague até ${formatDueBR(r.payment_due_at)}.` : "",
      pixCode(r.id, due)
        ? `Pix copia e cola (é só colar no app do banco):\n\n${pixCode(r.id, due)}\n\nMe manda o comprovante por aqui.`
        : `Minha chave Pix: ${trip.pix_key}. Me manda o comprovante por aqui.`,
      cardText(r.has_pillion),
    ]
      .filter(Boolean)
      .join(" ");
  };

  const releasedMessage = (r: { name: string }) =>
    `Oi, ${r.name.split(" ")[0]}! Aqui é ${organizer.name.split(" ")[0]}, da viagem ${trip.title}. O prazo para pagar a sua vaga venceu e ela foi para quem estava na lista de espera. Você continua na lista: se abrir vaga de novo, eu te aviso. Se quiser conversar, é só responder aqui.`;

  const greeting = (name: string) =>
    `Oi, ${name.split(" ")[0]}! Aqui é ${organizer.name.split(" ")[0]}, da viagem ${trip.title}.`;

  return (
    <div className="space-y-6">
      <TripHeader trip={trip} current="inscritos" inscritos={registrations.length} />

      {erro === "remover" && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 font-medium text-danger" role="alert">
          Não deu para remover. Tenta de novo.
        </p>
      )}
      {removido && promoted.length === 0 && (
        <p className="rounded-xl bg-success-soft px-4 py-3 font-medium text-success" role="status">
          Inscrito removido.
        </p>
      )}
      {erro === "liberar" && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 font-medium text-danger" role="alert">
          Não deu para liberar a vaga. Pode ser que a pessoa já tenha pago ou que a fila esteja
          vazia. Atualize a página.
        </p>
      )}
      {released && (
        <div className="space-y-3 rounded-xl border border-line bg-surface-muted p-4" role="status">
          <p className="font-medium">
            Vaga liberada. {released.name} foi para o fim da lista de espera. Avise pelo
            WhatsApp.
          </p>
          <a
            href={whatsappLink(released.whatsapp, releasedMessage(released))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Avisar {released.name.split(" ")[0]} no WhatsApp
          </a>
        </div>
      )}
      {promoted.map((r) => (
        <div
          key={r.id}
          className="space-y-3 rounded-xl border border-success/40 bg-success-soft p-4"
          role="status"
        >
          <p className="text-base font-semibold text-success">
            {released ? "" : "Inscrito removido. "}
            {r.name} saiu da lista de espera e ganhou a vaga! Avise pelo WhatsApp.
          </p>
          <a
            href={whatsappLink(r.whatsapp, promotedMessage(r))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Avisar {r.name.split(" ")[0]} no WhatsApp
          </a>
        </div>
      ))}

      {(recentPromoted.length > 0 || recentReleased.length > 0) && (
        <details className="card p-4">
          <summary className="cursor-pointer font-medium">
            Mudanças na fila nos últimos 7 dias ({recentPromoted.length + recentReleased.length})
          </summary>
          <p className="mt-2 text-sm text-muted">
            Inclui as feitas sozinhas pelo prazo de pagamento. Avise cada pessoa pelo WhatsApp.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {recentPromoted.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  <span className="font-medium">{r.name}</span> subiu da fila em{" "}
                  {formatDateTimeBR(r.promoted_at!)}
                </span>
                <a
                  href={whatsappLink(r.whatsapp, promotedMessage(r))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-muted"
                >
                  Avisar que ganhou a vaga
                </a>
              </li>
            ))}
            {recentReleased.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  <span className="font-medium">{r.name}</span> perdeu a vaga por prazo em{" "}
                  {formatDateTimeBR(r.released_at!)}
                </span>
                <a
                  href={whatsappLink(r.whatsapp, releasedMessage(r))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-muted"
                >
                  Avisar que foi para a fila
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {overdue.length > 0 && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn" role="note">
          {overdue.length} confirmado(s) com o prazo de pagamento vencido.{" "}
          {waitlist.length > 0
            ? trip.payment_deadline_action === "release"
              ? "A vaga é liberada sozinha em até 15 minutos, ou libere agora em cada um."
              : "Libere a vaga em cada um para o próximo da fila subir."
            : "Ninguém na lista de espera: as vagas continuam com eles."}{" "}
          <Link href="?filtro=vencidos" className="underline">
            Ver
          </Link>
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Vagas" value={`${confirmed.length} de ${trip.capacity}`} />
        <Stat label="Pagos" value={`${paidCount} de ${confirmed.length}`} />
        <Stat label="Na fila" value={String(waitlist.length)} />
      </dl>

      {registrations.length > 0 && (
        <a
          href={`/painel/viagens/${trip.id}/inscritos/planilha`}
          download
          className="btn-secondary"
        >
          📊 Baixar planilha (Excel)
        </a>
      )}

      <section className="space-y-3">
        <h2 className="section-title">Confirmados</h2>
        {confirmed.length > 0 && (
          <nav className="flex gap-2" aria-label="Filtrar por pagamento">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Link
                key={f}
                href={f === "todos" ? "?" : `?filtro=${f}`}
                aria-current={filter === f ? "page" : undefined}
                className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-sm text-ink-soft hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
              >
                {FILTERS[f]}
              </Link>
            ))}
          </nav>
        )}

        {confirmed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-muted">
            Ninguém se inscreveu ainda. Manda o link no grupo! 🏍️
          </p>
        ) : shown.length === 0 ? (
          <p className="text-muted">
            {filter === "pagos" ? "Ninguém marcado como pago ainda." : "Todo mundo já pagou. 🎉"}
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {shown.map((r) => {
              const due = amountDue(trip, r.has_pillion);
              return (
                <li key={r.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                  <div>
                    <p className="text-base font-semibold break-words">{r.name}</p>
                    <p className="text-muted">
                      🏍️ {describeBike(r)}
                      {r.has_pillion && ` · garupa: ${r.pillion_name}`}
                    </p>
                    <p className="font-semibold">
                      {due !== null ? formatBRL(due) : "Valor a definir"}
                      <span className="font-normal text-muted">
                        {r.has_pillion ? " (piloto + garupa)" : " (piloto)"}
                      </span>
                    </p>
                    {r.payment_status === "pending" && r.payment_due_at && (
                      <p
                        className={`mt-1 text-sm ${isOverdue(r) ? "font-medium text-danger" : "text-muted"}`}
                      >
                        {isOverdue(r) ? "Prazo vencido em " : "Pagar até "}
                        {formatDueBR(r.payment_due_at)}
                      </p>
                    )}
                  </div>
                  {isOverdue(r) && waitlist.length > 0 && (
                    <form action={releaseRegistration.bind(null, trip.id, r.id)}>
                      <button
                        type="submit"
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-danger hover:bg-danger-soft"
                      >
                        Liberar vaga para {waitlist[0]!.name.split(" ")[0]} (1º da fila)
                      </button>
                    </form>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <PaymentToggle tripId={trip.id} registrationId={r.id} status={r.payment_status} />
                    <WhatsAppButton phone={r.whatsapp} text={greeting(r.name)} />
                  </div>
                  <Details r={r} />
                  <form action={cancelRegistration.bind(null, trip.id, r.id)}>
                    <RemoveButton name={r.name} />
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {waitlist.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="section-title">Lista de espera</h2>
            <p className="text-muted">
              Em ordem de chegada (quem perde a vaga por prazo vai para o fim). Quando abrir vaga, o
              primeiro sobe sozinho; avise a pessoa pelo WhatsApp.
            </p>
          </div>
          <ol className="grid gap-3 lg:grid-cols-2">
            {waitlist.map((r, i) => (
              <li key={r.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <div>
                  <p className="text-base font-semibold break-words">
                    {i + 1}º · {r.name}
                  </p>
                  <p className="text-muted">
                    🏍️ {describeBike(r)}
                    {r.has_pillion && ` · garupa: ${r.pillion_name}`}
                  </p>
                  {r.released_at && (
                    <p className="text-sm text-muted">
                      Perdeu a vaga por prazo em {formatDateTimeBR(r.released_at)}
                    </p>
                  )}
                </div>
                <WhatsAppButton phone={r.whatsapp} text={greeting(r.name)} />
                <Details r={r} />
                <form action={cancelRegistration.bind(null, trip.id, r.id)}>
                  <RemoveButton name={r.name} />
                </form>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="section-title">{value}</dd>
    </div>
  );
}

function WhatsAppButton({ phone, text }: { phone: string; text: string }) {
  return (
    <a
      href={whatsappLink(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 sm:min-h-9 w-full items-center justify-center rounded-xl border border-line-strong bg-surface px-4 font-semibold"
    >
      💬 WhatsApp {formatBrPhone(phone)}
    </a>
  );
}

type Row = {
  email: string;
  bike_plate: string | null;
  emergency_name: string;
  emergency_phone: string;
  created_at: string;
};

/** E-mail, placa, contato de emergência e data, recolhidos para não poluir o cartão. */
function Details({ r }: { r: Row }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 sm:min-h-9 cursor-pointer list-none items-center font-semibold text-accent">
        <span className="group-open:hidden">Ver mais</span>
        <span className="hidden group-open:inline">Ver menos</span>
      </summary>
      <dl className="space-y-1 text-ink-soft">
        <div>
          <dt className="inline font-semibold">E-mail: </dt>
          <dd className="inline break-all">{r.email}</dd>
        </div>
        {r.bike_plate && (
          <div>
            <dt className="inline font-semibold">Placa: </dt>
            <dd className="inline">{formatPlate(r.bike_plate)}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Emergência: </dt>
          <dd className="inline">
            {r.emergency_name} ·{" "}
            <a href={`tel:+${r.emergency_phone}`} className="font-semibold text-accent underline">
              {formatBrPhone(r.emergency_phone)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Inscrição: </dt>
          <dd className="inline">{formatDateTimeBR(r.created_at)}</dd>
        </div>
      </dl>
    </details>
  );
}
