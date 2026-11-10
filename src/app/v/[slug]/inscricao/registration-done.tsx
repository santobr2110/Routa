"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton, PixQr } from "@/components/pix-qr";
import { formatBRL, formatDueBR, whatsappLink } from "@/lib/format";
import { PIX_KEY_LABELS as PIX_KEY_LABEL, formatPixKey, parsePixKey, pixPayload, pixTxid } from "@/lib/pix";
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

  const pixKey = result.pix_key ?? "";
  const parsedKey = parsePixKey(pixKey);
  const pixCode = pixPayload({
    key: pixKey,
    name: result.organizer_name,
    amountCents: amount,
    txid: pixTxid(result.registration_id),
  });

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

      <div className="card space-y-5 p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {pixCode && (
            <div className="flex flex-col items-center gap-2">
              <PixQr code={pixCode} />
              <p className="text-xs text-muted">Aponte a câmera do app do banco</p>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="text-sm text-muted">
                Valor {result.has_pillion ? "(piloto + garupa)" : "(piloto)"}
              </p>
              {amount !== null ? (
                <p className="text-3xl font-semibold tabular-nums">{formatBRL(amount)}</p>
              ) : (
                <p className="font-semibold">
                  {result.organizer_name} vai te passar o valor do rateio. No Pix, é só digitar o
                  valor.
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted">
                Pix para {result.organizer_name}
                {parsedKey && ` · ${PIX_KEY_LABEL[parsedKey.type]}`}
              </p>
              <p className="font-medium break-all">
                {parsedKey ? formatPixKey(parsedKey) : pixKey}
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {pixCode && (
                <CopyButton
                  text={pixCode}
                  label="Copiar Pix copia e cola"
                  copiedLabel="Código copiado! ✅"
                  className="btn-primary"
                />
              )}
              <CopyButton text={parsedKey?.value ?? pixKey} label="Copiar só a chave" copiedLabel="Chave copiada! ✅" />
            </div>
            {result.payment_due_at && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn">
                Pague até {formatDueBR(result.payment_due_at)}. Depois disso, a vaga pode ir para
                quem está na lista de espera.
              </p>
            )}
            {pixCode && (
              <p className="text-xs text-muted">
                No app do banco: Pix → Pix copia e cola → cole o código.
                {amount !== null && " O valor já vem preenchido."} Confira o nome de quem recebe
                antes de pagar.
              </p>
            )}
          </div>
        </div>
      </div>

      {result.card && (
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-medium">Prefere cartão de crédito?</p>
            <p className="text-sm text-muted">
              {result.card.amount_cents !== null
                ? `${formatBRL(result.card.amount_cents)} no cartão`
                : "Valor combinado com o organizador"}
              , pela página de pagamento {cardProvider(result.card.url)}.
            </p>
          </div>
          <a
            href={result.card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary shrink-0"
          >
            Pagar no cartão
          </a>
        </div>
      )}

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

      <p className="rounded-xl bg-surface-muted px-4 py-3 text-ink-soft">
        📸 Tira um print desta tela: ela some se você fechar o navegador. Sua inscrição fica
        guardada com o organizador.
      </p>

      <BackLink slug={trip.slug} />
    </section>
  );
}

function BackLink({ slug }: { slug: string }) {
  return (
    <Link href={`/v/${slug}`} className="inline-flex min-h-11 sm:min-h-9 items-center font-semibold text-accent">
      ← Voltar para a viagem
    </Link>
  );
}

/** Nome da empresa do link, para a pessoa saber para onde vai. */
function cardProvider(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "do organizador";
  }
  const known: [RegExp, string][] = [
    [/(^|\.)(mpago\.la|mpago\.li|mercadopago\.com(\.br)?)$/, "do Mercado Pago"],
    [/(^|\.)infinitepay\.io$/, "da InfinitePay"],
    [/(^|\.)(pagseguro\.uol\.com\.br|pagseguro\.com\.br|pagbank\.com\.br)$/, "do PagBank"],
    [/(^|\.)(sumup\.com|sumupstore\.com)$/, "da SumUp"],
    [/(^|\.)stone\.com\.br$/, "da Stone"],
    [/(^|\.)(asaas\.com)$/, "do Asaas"],
    [/(^|\.)(nubank\.com\.br)$/, "do Nubank"],
  ];
  return known.find(([re]) => re.test(host))?.[1] ?? `(${host})`;
}
