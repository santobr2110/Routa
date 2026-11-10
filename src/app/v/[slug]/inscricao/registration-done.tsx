"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PaymentBox, SaveLink } from "@/components/payment-box";
import { formatBRL, whatsappLink } from "@/lib/format";
import type { RegisterResult } from "./actions";
import type { FormTrip } from "./registration-form";

/** Tela depois de enviar: chave Pix (confirmado) ou aviso da lista de espera. */
export function RegistrationDone({
  trip,
  result,
  name,
}: {
  trip: FormTrip;
  result: RegisterResult;
  name: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstName = name.trim().split(/\s+/)[0];

  // Leva o foco (e a tela) para o resultado, que substitui o formulário.
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);

  if (result.status === "waitlist") {
    return (
      <section className="space-y-4 rounded-xl border border-line bg-surface p-5" role="status">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Você está na lista de espera, {firstName}! ⏳
        </h2>
        <p className="text-base">
          As vagas lotaram, mas sua inscrição ficou guardada na fila, por ordem de chegada. Se
          abrir uma vaga, <strong>{result.organizer_name}</strong> te chama no WhatsApp.
        </p>
        <p className="text-muted">Não precisa pagar nada agora.</p>
        {result.access_token && <SaveLink token={result.access_token} tripTitle={trip.title} />}
        <BackLink slug={trip.slug} />
      </section>
    );
  }

  const amount = result.amount_cents;
  const message = [
    `Oi, ${result.organizer_name}! Sou ${name.trim()} e me inscrevi no ${trip.title}.`,
    amount !== null
      ? `Segue o comprovante do Pix de ${formatBRL(amount)}.`
      : "Qual o valor pra eu fazer o Pix?",
  ].join(" ");

  return (
    <section className="space-y-5" role="status">
      <div className="space-y-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none sm:text-3xl">
          Vaga garantida, {firstName}! 🏍️
        </h2>
        <p className="text-base text-ink-soft">
          Agora é só pagar {result.card ? "(Pix ou cartão)" : "o Pix"} e mandar o comprovante pro
          organizador.
        </p>
      </div>

      <PaymentBox
        registrationId={result.registration_id}
        organizerName={result.organizer_name}
        pixKey={result.pix_key ?? ""}
        amountCents={amount}
        hasPillion={result.has_pillion}
        dueAt={result.payment_due_at ?? null}
        card={result.card ?? null}
      />

      {result.access_token && <SaveLink token={result.access_token} tripTitle={trip.title} />}

      {result.organizer_whatsapp && (
        <a
          href={whatsappLink(result.organizer_whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Mandar comprovante no WhatsApp
        </a>
      )}

      {!result.access_token && (
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-ink-soft">
          📸 Tira um print desta tela: ela some se você fechar o navegador. Sua inscrição fica
          guardada com o organizador.
        </p>
      )}

      <BackLink slug={trip.slug} />
    </section>
  );
}

function BackLink({ slug }: { slug: string }) {
  return (
    <div>
      <Link href={`/v/${slug}`} className="inline-flex min-h-11 items-center font-semibold text-accent sm:min-h-9">
        ← Voltar para a viagem
      </Link>
    </div>
  );
}
