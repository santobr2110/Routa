import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { formatBRL, formatBrPhone, formatDateTimeBR, whatsappLink } from "@/lib/format";
import { REGISTRATION_COLUMNS, amountDue } from "@/lib/registrations";
import { createClient } from "@/lib/supabase/server";
import { cancelRegistration } from "./actions";
import { PaymentToggle } from "./payment-toggle";
import { RemoveButton } from "./remove-button";

export const metadata: Metadata = { title: "Inscritos" };

const FILTERS = { todos: "Todos", pendentes: "Pendentes", pagos: "Pagos" } as const;
type Filter = keyof typeof FILTERS;

export default async function InscritosPage({
  params,
  searchParams,
}: PageProps<"/painel/viagens/[id]/inscritos">) {
  const { organizer } = await requireOrganizer();
  const { id } = await params;
  const { filtro, promovido, removido, erro } = await searchParams;
  const filter: Filter = filtro === "pendentes" || filtro === "pagos" ? filtro : "todos";

  const supabase = await createClient();
  // O RLS só devolve a viagem e as inscrições do próprio organizador.
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, capacity, pricing_mode, price_cents, pillion_price_cents, pix_key")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: registrations, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("trip_id", trip.id)
    .neq("status", "cancelled")
    .order("created_at");
  if (error) throw error;

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const paidCount = confirmed.filter((r) => r.payment_status === "paid").length;
  const shown = confirmed.filter(
    (r) =>
      filter === "todos" ||
      (filter === "pagos" ? r.payment_status === "paid" : r.payment_status === "pending"),
  );

  // Quem acabou de sair da fila (veio na URL depois de remover alguém).
  const promotedIds = typeof promovido === "string" ? promovido.split(",") : [];
  const promoted = confirmed.filter((r) => promotedIds.includes(r.id));
  const promotedMessage = (r: (typeof confirmed)[number]) => {
    const due = amountDue(trip, r.has_pillion);
    return [
      `Oi, ${r.name.split(" ")[0]}! Abriu uma vaga no ${trip.title} e ela é sua! 🎉`,
      due !== null ? `O valor é ${formatBRL(due)}.` : "Já te passo o valor do rateio.",
      `Minha chave Pix: ${trip.pix_key}. Me manda o comprovante por aqui.`,
    ].join(" ");
  };

  const greeting = (name: string) =>
    `Oi, ${name.split(" ")[0]}! Aqui é ${organizer.name.split(" ")[0]}, da viagem ${trip.title}.`;

  return (
    <div className="space-y-6">
      <Link
        href={`/painel/viagens/${trip.id}`}
        className="inline-flex min-h-12 items-center font-semibold text-accent"
      >
        ← Voltar para a viagem
      </Link>

      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Inscritos</h1>
        <p className="text-lg text-muted break-words">{trip.title}</p>
      </div>

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
      {promoted.map((r) => (
        <div
          key={r.id}
          className="space-y-3 rounded-2xl border-2 border-success/40 bg-success-soft p-4"
          role="status"
        >
          <p className="text-lg font-semibold text-success">
            Inscrito removido. {r.name} saiu da lista de espera e ganhou a vaga! Avise pelo
            WhatsApp.
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
        <h2 className="text-xl font-bold">Confirmados</h2>
        {confirmed.length > 0 && (
          <nav className="flex gap-2" aria-label="Filtrar por pagamento">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Link
                key={f}
                href={f === "todos" ? "?" : `?filtro=${f}`}
                aria-current={filter === f ? "page" : undefined}
                className="inline-flex min-h-12 items-center rounded-full border-2 border-line-strong px-4 font-semibold aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
              >
                {FILTERS[f]}
              </Link>
            ))}
          </nav>
        )}

        {confirmed.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line-strong p-6 text-center text-muted">
            Ninguém se inscreveu ainda. Manda o link no grupo! 🏍️
          </p>
        ) : shown.length === 0 ? (
          <p className="text-muted">
            {filter === "pagos" ? "Ninguém marcado como pago ainda." : "Todo mundo já pagou. 🎉"}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((r) => {
              const due = amountDue(trip, r.has_pillion);
              return (
                <li key={r.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <div>
                    <p className="text-lg font-bold break-words">{r.name}</p>
                    <p className="text-muted">
                      🏍️ {r.bike}
                      {r.has_pillion && ` · garupa: ${r.pillion_name}`}
                    </p>
                    <p className="font-semibold">
                      {due !== null ? formatBRL(due) : "Valor a definir"}
                      <span className="font-normal text-muted">
                        {r.has_pillion ? " (piloto + garupa)" : " (piloto)"}
                      </span>
                    </p>
                  </div>
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
            <h2 className="text-xl font-bold">Lista de espera</h2>
            <p className="text-muted">
              Em ordem de chegada. Quando abrir vaga, o primeiro sobe sozinho; avise a pessoa pelo
              WhatsApp.
            </p>
          </div>
          <ol className="space-y-3">
            {waitlist.map((r, i) => (
              <li key={r.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                <div>
                  <p className="text-lg font-bold break-words">
                    {i + 1}º · {r.name}
                  </p>
                  <p className="text-muted">
                    🏍️ {r.bike}
                    {r.has_pillion && ` · garupa: ${r.pillion_name}`}
                  </p>
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
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function WhatsAppButton({ phone, text }: { phone: string; text: string }) {
  return (
    <a
      href={whatsappLink(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-line-strong bg-surface px-4 font-semibold"
    >
      💬 WhatsApp {formatBrPhone(phone)}
    </a>
  );
}

type Row = {
  email: string;
  emergency_name: string;
  emergency_phone: string;
  created_at: string;
};

/** E-mail, contato de emergência e data, recolhidos para não poluir o cartão. */
function Details({ r }: { r: Row }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center font-semibold text-accent">
        <span className="group-open:hidden">Ver mais</span>
        <span className="hidden group-open:inline">Ver menos</span>
      </summary>
      <dl className="space-y-1 text-ink-soft">
        <div>
          <dt className="inline font-semibold">E-mail: </dt>
          <dd className="inline break-all">{r.email}</dd>
        </div>
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
