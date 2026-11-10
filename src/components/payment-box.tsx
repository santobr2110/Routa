"use client";

import { CopyButton, PixQr } from "@/components/pix-qr";
import { formatBRL, formatDueBR } from "@/lib/format";
import { PIX_KEY_LABELS, formatPixKey, parsePixKey, pixPayload, pixTxid } from "@/lib/pix";
import { registrationUrl } from "@/lib/site";

/**
 * Pagamento da vaga: QR Code e Pix copia e cola com o valor exato, a chave como reserva,
 * o prazo (se houver) e o cartão (se o organizador aceitar). Usado na tela de vaga
 * garantida e na página do inscrito.
 */
export function PaymentBox({
  registrationId,
  organizerName,
  pixKey,
  amountCents,
  hasPillion,
  dueAt,
  card,
}: {
  registrationId: string;
  organizerName: string;
  pixKey: string;
  amountCents: number | null;
  hasPillion: boolean;
  dueAt: string | null;
  card: { url: string; amount_cents: number | null } | null;
}) {
  const parsedKey = parsePixKey(pixKey);
  const pixCode = pixPayload({
    key: pixKey,
    name: organizerName,
    amountCents,
    txid: pixTxid(registrationId),
  });

  return (
    <div className="space-y-4">
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
                Valor {hasPillion ? "(piloto + garupa)" : "(piloto)"}
              </p>
              {amountCents !== null ? (
                <p className="text-3xl font-semibold tabular-nums">{formatBRL(amountCents)}</p>
              ) : (
                <p className="font-semibold">
                  {organizerName} vai te passar o valor do rateio. No Pix, é só digitar o valor.
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted">
                Pix para {organizerName}
                {parsedKey && ` · ${PIX_KEY_LABELS[parsedKey.type]}`}
              </p>
              <p className="font-medium break-all">{parsedKey ? formatPixKey(parsedKey) : pixKey}</p>
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
              <CopyButton
                text={parsedKey?.value ?? pixKey}
                label="Copiar só a chave"
                copiedLabel="Chave copiada! ✅"
              />
            </div>
            {dueAt && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn">
                Pague até {formatDueBR(dueAt)}. Depois disso, a vaga pode ir para quem está na
                lista de espera.
              </p>
            )}
            {pixCode && (
              <p className="text-xs text-muted">
                No app do banco: Pix → Pix copia e cola → cole o código.
                {amountCents !== null && " O valor já vem preenchido."} Confira o nome de quem
                recebe antes de pagar.
              </p>
            )}
          </div>
        </div>
      </div>

      {card && (
        <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-medium">Prefere cartão de crédito?</p>
            <p className="text-sm text-muted">
              {card.amount_cents !== null
                ? `${formatBRL(card.amount_cents)} no cartão`
                : "Valor combinado com o organizador"}
              , pela página de pagamento {cardProvider(card.url)}.
            </p>
          </div>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary shrink-0"
          >
            Pagar no cartão
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * "Guarde seu link": copiar ou mandar para si mesmo no WhatsApp o link da página do inscrito.
 * O link é pessoal (quem tem o link vê a inscrição), então o texto pede para não espalhar.
 */
export function SaveLink({ token, tripTitle }: { token: string; tripTitle: string }) {
  const url = registrationUrl(token);
  const text = `Minha inscrição no ${tripTitle} (Routa): ${url}`;
  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-brand-soft p-4">
      <div className="space-y-0.5">
        <p className="font-medium">Guarde o link da sua inscrição</p>
        <p className="text-sm text-ink-soft">
          Lá você vê a sua vaga, o pagamento, as informações da viagem e os avisos do organizador,
          quando quiser. O link é só seu: não compartilhe no grupo.
        </p>
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Mandar para mim no WhatsApp
        </a>
        <CopyButton text={url} label="Copiar link" copiedLabel="Link copiado! ✅" />
        <a href={`/i/${token}`} className="btn-secondary">
          Abrir minha página
        </a>
      </div>
    </div>
  );
}

/** Nome da empresa do link, para a pessoa saber para onde vai. */
export function cardProvider(url: string): string {
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
