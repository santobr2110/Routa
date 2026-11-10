import Link from "next/link";
import { Logo } from "@/components/logo";
import { PaymentBox } from "@/components/payment-box";
import { convoyOn } from "@/lib/convoy";
import { ThemeToggle } from "@/components/theme-toggle";
import { clubThemeStyle } from "@/lib/club-colors";
import { ConvoySection } from "./convoy-section";
import { formatBRL, formatDateBR, formatDateRangeBR, formatDateTimeBR, formatDueBR, whatsappLink } from "@/lib/format";
import type { RegistrationPage } from "@/lib/registration-page";
import { photoUrl } from "@/lib/trips";

/** Página do inscrito: vaga, pagamento, avisos e informações da viagem. */
export function RegistrationView({ page, token }: { page: RegistrationPage; token: string }) {
  const { registration: r, trip, organizer, payment, updates } = page;
  const firstName = r.name.trim().split(/\s+/)[0];
  const club = organizer.club;
  const talk = (text: string) => whatsappLink(organizer.whatsapp, text);
  const hello = `Oi, ${organizer.name.split(" ")[0]}! Sou ${r.name}, inscrito(a) no ${trip.title}.`;

  return (
    <div
      className={`flex flex-1 flex-col pb-16 ${club?.color ? "club-theme" : ""}`}
      style={clubThemeStyle(club?.color)}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Routa, página inicial" className="inline-block">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {trip.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(trip.cover)}
              alt=""
              className="aspect-[16/9] w-full rounded-xl object-cover sm:aspect-square sm:w-28"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted">Oi, {firstName}! Esta é a sua inscrição em</p>
            <h1 className="page-title break-words">{trip.title}</h1>
            <p className="text-sm text-ink-soft">
              {trip.destination} · {formatDateRangeBR(trip.start_date, trip.end_date)}
              {trip.departure_time && ` · saída às ${trip.departure_time}`}
            </p>
            <p className="text-sm text-muted">
              Organização:{" "}
              {club ? (
                <Link href={`/c/${club.slug}`} className="font-medium text-accent hover:underline">
                  {club.name}
                </Link>
              ) : (
                organizer.name
              )}
            </p>
          </div>
        </section>

        {trip.deleted && (
          <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
            <p className="font-semibold">Esta viagem foi excluída</p>
            <p>
              Ela não vai mais acontecer pela Routa. Se você já pagou, fale com o organizador sobre a
              devolução.
            </p>
          </div>
        )}

        {trip.unavailable && !trip.deleted && (
          <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn" role="alert">
            Esta viagem está fora do ar na Routa no momento. Fale com o organizador para saber
            mais.
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {!trip.deleted && <Status page={page} />}

            {r.status === "confirmed" && r.payment_status === "pending" && payment && (
              <PaymentBox
                registrationId={r.id}
                organizerName={organizer.name}
                pixKey={payment.pix_key}
                amountCents={r.amount_cents}
                hasPillion={r.has_pillion}
                dueAt={r.payment_due_at}
                card={payment.card}
              />
            )}

            {r.status !== "cancelled" && !trip.deleted && convoyOn(page.convoy) && (
              <ConvoySection
                token={token}
                convoy={page.convoy}
                bike={{ brand: r.bike_brand ?? "", model: r.bike_model ?? "" }}
              />
            )}

            {r.status !== "cancelled" && (
              <section className="space-y-3">
                <h2 className="section-title">Avisos do organizador</h2>
                {updates.length === 0 ? (
                  <p className="card p-4 text-sm text-muted">
                    Nenhum aviso por enquanto. Quando {organizer.name.split(" ")[0]} publicar
                    alguma novidade da viagem, ela aparece aqui.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {updates.map((u) => (
                      <li key={u.id} className="card space-y-1 p-4">
                        <p className="text-xs text-muted">{formatDateTimeBR(u.created_at)}</p>
                        <p className="text-[15px] whitespace-pre-line text-ink">{u.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            <section className="space-y-3">
              <h2 className="section-title">A viagem</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Place
                  title="Saída"
                  when={`${formatDateBR(trip.start_date)}${trip.departure_time ? ` às ${trip.departure_time}` : ""}`}
                  where={trip.departure_point}
                  url={trip.departure_point_url}
                />
                <Place
                  title="Retorno"
                  when={`${formatDateBR(trip.end_date)}${trip.return_time ? `, previsão ${trip.return_time}` : ""}`}
                  where={trip.return_point ?? "Mesmo local da saída"}
                  url={trip.return_point_url}
                />
              </div>
              {trip.description && (
                <details className="card group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium sm:min-h-10">
                    Roteiro
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                    {trip.description}
                  </p>
                </details>
              )}
              <details className="card group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium sm:min-h-10">
                  Termo de responsabilidade que você aceitou
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="space-y-2 px-4 pb-4">
                  <p className="text-xs text-muted">Aceito em {formatDateTimeBR(r.terms_accepted_at)}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                    {r.terms_text_accepted}
                  </p>
                </div>
              </details>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="card space-y-3 p-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Sua inscrição</p>
              <dl className="space-y-2 text-sm">
                <Row label="Piloto">{r.name}</Row>
                {r.has_pillion && <Row label="Garupa">{r.pillion_name}</Row>}
                <Row label="Moto">{r.bike}</Row>
                <Row label="Inscrição em">{formatDateTimeBR(r.created_at)}</Row>
                {r.amount_cents !== null && r.status !== "cancelled" && (
                  <Row label="Valor">{formatBRL(r.amount_cents)}</Row>
                )}
              </dl>
            </div>
            <div className="card space-y-3 p-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Organização</p>
              <p className="font-medium">{organizer.name}</p>
              <a href={talk(hello)} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
                Falar no WhatsApp
              </a>
              {r.status !== "cancelled" && (
                <p className="text-xs text-muted">
                  Precisa desistir ou trocar algum dado?{" "}
                  <a
                    href={talk(`${hello} Preciso falar sobre a minha inscrição.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    Fale com o organizador
                  </a>
                  .
                </p>
              )}
            </div>
            <p className="px-1 text-xs text-muted">
              Este link é só seu: quem tiver o link vê a sua inscrição. Guarde e não compartilhe
              no grupo.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

/** Situação da vaga em destaque. */
function Status({ page }: { page: RegistrationPage }) {
  const r = page.registration;
  if (r.status === "cancelled") {
    return (
      <div className="rounded-xl bg-surface-muted p-5" role="status">
        <p className="text-lg font-semibold">Sua inscrição foi cancelada</p>
        <p className="text-sm text-ink-soft">
          {r.cancelled_at && `Em ${formatDateTimeBR(r.cancelled_at)}. `}Se acha que foi engano,
          fale com o organizador.
        </p>
      </div>
    );
  }
  if (r.status === "waitlist") {
    return (
      <div className="rounded-xl bg-warn-soft p-5 text-warn" role="status">
        <p className="text-lg font-semibold">
          Você está na lista de espera{r.waitlist_position ? `: ${r.waitlist_position}º lugar` : ""}
        </p>
        <p className="text-sm">
          {r.released_at
            ? `O prazo de pagamento venceu em ${formatDateTimeBR(r.released_at)} e a vaga foi para a fila. `
            : ""}
          Se abrir uma vaga, você sobe sozinho(a) por ordem da fila e o organizador te avisa. Não
          precisa pagar nada agora.
        </p>
      </div>
    );
  }
  if (r.payment_status === "paid") {
    return (
      <div className="rounded-xl bg-success-soft p-5 text-success" role="status">
        <p className="text-lg font-semibold">Vaga garantida e paga ✅</p>
        <p className="text-sm">Tudo certo! Agora é só esperar o dia da saída. Bora de cara pro vento!</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-brand-soft p-5" role="status">
      <p className="text-lg font-semibold">Vaga garantida · falta o pagamento</p>
      <p className="text-sm text-ink-soft">
        {r.payment_due_at
          ? `Pague até ${formatDueBR(r.payment_due_at)} e mande o comprovante para o organizador.`
          : "Faça o pagamento e mande o comprovante para o organizador. Quando ele confirmar, aparece aqui como pago."}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function Place({ title, when, where, url }: { title: string; when: string; where: string; url: string | null }) {
  return (
    <div className="card space-y-1 p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <p className="font-medium">{when}</p>
      <p className="text-sm text-ink-soft">{where}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 sm:min-h-8"
        >
          Abrir no mapa ↗
        </a>
      )}
    </div>
  );
}
