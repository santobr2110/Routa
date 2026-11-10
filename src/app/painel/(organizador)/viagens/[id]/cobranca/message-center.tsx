"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { formatBRL, formatBrPhone, formatDueBR, parseBRL, whatsappLink } from "@/lib/format";
import { pixPayload, pixTxid } from "@/lib/pix";

export type CenterTrip = {
  id: string;
  title: string;
  dates: string;
  fixed: boolean;
  pixKey: string;
  organizerName: string;
  departurePoint: string;
  departureUrl: string | null;
  departureTime: string | null;
  acceptsCard: boolean;
};

export type CenterPerson = {
  id: string;
  name: string;
  whatsapp: string;
  status: "confirmed" | "waitlist";
  paid: boolean;
  amountCents: number | null;
  /** Link de cartão desta pessoa (piloto ou dupla) e o valor no cartão, se aceita cartão. */
  card: { url: string; amountCents: number | null } | null;
  /** Prazo para pagar (ISO) e se já venceu. */
  dueAt: string | null;
  overdue: boolean;
  /** Link da página do inscrito (/i/{token}). */
  link: string;
};

type TemplateKey = "cobrar" | "vespera" | "aviso";

const TEMPLATES: Record<
  TemplateKey,
  { label: string; description: string; who: (p: CenterPerson) => boolean }
> = {
  cobrar: {
    label: "Cobrar quem não pagou",
    description: "Confirmados com pagamento pendente. Vai o valor e o Pix copia e cola de cada um.",
    who: (p) => p.status === "confirmed" && !p.paid,
  },
  vespera: {
    label: "Lembrete da véspera",
    description: "Todos os confirmados: local e horário da saída.",
    who: (p) => p.status === "confirmed",
  },
  aviso: {
    label: "Aviso ao grupo",
    description: "Todos os confirmados. Mudança de roteiro, horário, chuva… você escreve.",
    who: (p) => p.status === "confirmed",
  },
};

function defaultText(key: TemplateKey, trip: CenterTrip): string {
  const me = trip.organizerName.split(" ")[0];
  if (key === "cobrar")
    return [
      `Oi, {nome}! Aqui é ${me}, da viagem ${trip.title} (${trip.dates}).`,
      "Falta só o Pix da sua vaga{valor}{prazo}. É só copiar o código abaixo e colar no app do banco, em Pix copia e cola:",
      "",
      "{pix}",
      "",
      ...(trip.acceptsCard ? ["Prefere cartão de crédito? {cartao}", ""] : []),
      "Se já pagou, me manda o comprovante que eu marco aqui. Valeu! 🏍️",
      "",
      "Sua página da inscrição: {link}",
    ].join("\n");
  if (key === "vespera")
    return [
      `Oi, {nome}! Amanhã é dia de ${trip.title}! 🏍️`,
      `Saída: ${trip.departurePoint}${trip.departureTime ? `, às ${trip.departureTime.slice(0, 5)}` : ""}.`,
      ...(trip.departureUrl ? [`Mapa: ${trip.departureUrl}`] : []),
      "Tanque cheio, documentos em dia e capa de chuva na mala. Bora de cara pro vento!",
      "",
      "Tudo da viagem na sua página: {link}",
    ].join("\n");
  return `Oi, {nome}! Aqui é ${me}, da viagem ${trip.title}. \n\nTudo da viagem na sua página da inscrição: {link}`;
}

const STORAGE = "routa:enviados";

// Quando cada mensagem foi aberta no WhatsApp (só neste navegador, no localStorage).
const SENT_EVENT = "routa:enviados";

function readSent(): string {
  try {
    return localStorage.getItem(STORAGE) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribeSent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SENT_EVENT, onChange);
  };
}

function recordSent(key: string) {
  try {
    const all = JSON.parse(readSent()) as Record<string, number>;
    all[key] = Date.now();
    localStorage.setItem(STORAGE, JSON.stringify(all));
  } catch {
    // sem armazenamento (aba anônima): só não lembra
  }
  window.dispatchEvent(new Event(SENT_EVENT));
}

const SENT_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Central de mensagens da viagem: escolhe o modelo, ajusta o texto e manda pelo WhatsApp,
 * uma pessoa por vez (o navegador só deixa abrir uma conversa por clique).
 */
export function MessageCenter({
  trip,
  people,
}: {
  trip: CenterTrip;
  people: CenterPerson[];
}) {
  const [template, setTemplate] = useState<TemplateKey>(
    people.some(TEMPLATES.cobrar.who) ? "cobrar" : "vespera",
  );
  const [texts, setTexts] = useState<Record<TemplateKey, string>>({
    cobrar: defaultText("cobrar", trip),
    vespera: defaultText("vespera", trip),
    aviso: defaultText("aviso", trip),
  });
  const [splitValue, setSplitValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const sentRaw = useSyncExternalStore(subscribeSent, readSent, () => "{}");
  const sent = useMemo(() => {
    try {
      return JSON.parse(sentRaw) as Record<string, number>;
    } catch {
      return {};
    }
  }, [sentRaw]);

  const recipients = useMemo(() => people.filter(TEMPLATES[template].who), [people, template]);
  const sentKey = (p: CenterPerson) => `${trip.id}:${template}:${p.id}`;
  const splitCents = trip.fixed ? null : parseBRL(splitValue);

  function messageFor(p: CenterPerson): string {
    const amount = trip.fixed ? p.amountCents : splitCents;
    const pix =
      pixPayload({
        key: trip.pixKey,
        name: trip.organizerName,
        amountCents: amount,
        txid: pixTxid(p.id),
      }) ?? `Chave Pix: ${trip.pixKey}`;
    return texts[template]
      .replaceAll("{nome}", p.name.split(" ")[0] ?? p.name)
      .replaceAll("{valor}", amount ? ` (${formatBRL(amount)})` : "")
      .replaceAll("{pix}", pix)
      .replaceAll("{link}", p.link)
      .replaceAll(
        "{prazo}",
        p.dueAt ? (p.overdue ? ` (o prazo era ${formatDueBR(p.dueAt)})` : `, até ${formatDueBR(p.dueAt)}`) : "",
      )
      .replaceAll(
        "{cartao}",
        p.card
          ? `${p.card.amountCents ? `${formatBRL(p.card.amountCents)} por este link: ` : "É por este link: "}${p.card.url}`
          : "",
      );
  }

  function markSent(p: CenterPerson) {
    recordSent(sentKey(p));
  }

  function choose(key: TemplateKey) {
    setTemplate(key);
    setCursor(0);
  }

  const pending = recipients.filter((p) => !sent[sentKey(p)]);
  const next = pending[cursor % Math.max(pending.length, 1)];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <section className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="field-label">Mensagem</legend>
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => {
            const count = people.filter(TEMPLATES[key].who).length;
            return (
              <label key={key} className="choice items-start">
                <input
                  type="radio"
                  name="template"
                  checked={template === key}
                  onChange={() => choose(key)}
                  className="mt-1 h-4 w-4 accent-brand"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">
                    {TEMPLATES[key].label}{" "}
                    <span className="font-normal text-muted">({count})</span>
                  </span>
                  <span className="block text-sm text-muted">{TEMPLATES[key].description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {template === "cobrar" && !trip.fixed && (
          <div>
            <label htmlFor="split" className="field-label">
              Valor do rateio por moto (opcional)
            </label>
            <input
              id="split"
              inputMode="decimal"
              placeholder="Ex.: 350,00"
              value={splitValue}
              onChange={(e) => setSplitValue(e.target.value)}
              className="field-input max-w-48"
            />
            <p className="field-hint">
              Se preencher, o valor vai na mensagem e já entra no Pix copia e cola.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="text" className="field-label">
            Texto
          </label>
          <textarea
            id="text"
            rows={9}
            value={texts[template]}
            onChange={(e) => setTexts({ ...texts, [template]: e.target.value })}
            className="field-input font-[inherit]"
          />
          <p className="field-hint">
            {"{nome}"} vira o primeiro nome de cada pessoa, {"{link}"} o link da página dela
            {template === "cobrar" &&
              `, {valor} o valor dela, {prazo} o prazo dela, {pix} o Pix copia e cola com o valor certo${trip.acceptsCard ? ", {cartao} o link do cartão com o valor no cartão" : ""}`}
            .{" "}
            <button
              type="button"
              onClick={() => setTexts({ ...texts, [template]: defaultText(template, trip) })}
              className="font-medium text-accent hover:underline"
            >
              Voltar ao texto padrão
            </button>
          </p>
        </div>

        {recipients[0] && (
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Ver como fica para {recipients[0].name.split(" ")[0]}
            </summary>
            <p className="mt-3 text-sm break-words whitespace-pre-wrap text-ink-soft">
              {messageFor(recipients[0])}
            </p>
          </details>
        )}
      </section>

      <section className="space-y-4">
        {recipients.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            {template === "cobrar"
              ? "Ninguém com pagamento pendente. 🎉"
              : "Ainda não há confirmados nesta viagem."}
          </p>
        ) : (
          <>
            <div className="card space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-medium">Enviar em sequência</h2>
                <span className="text-sm text-muted tabular-nums">
                  {recipients.length - pending.length} de {recipients.length} enviadas
                </span>
              </div>
              {next ? (
                <>
                  <a
                    href={whatsappLink(next.whatsapp, messageFor(next))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markSent(next)}
                    className="btn-primary w-full"
                  >
                    Abrir WhatsApp de {next.name.split(" ")[0]}
                  </a>
                  <p className="text-xs text-muted">
                    Abre a conversa com o texto pronto. Envie lá, volte aqui e clique de novo para a
                    próxima pessoa.
                    {pending.length > 1 && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => setCursor(cursor + 1)}
                          className="font-medium text-accent hover:underline"
                        >
                          Pular {next.name.split(" ")[0]}
                        </button>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-success">Todo mundo desta lista já recebeu. ✅</p>
              )}
            </div>

            <ul className="card divide-y divide-line">
              {recipients.map((p) => {
                const at = sent[sentKey(p)];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted">
                        {formatBrPhone(p.whatsapp)}
                        {template === "cobrar" && trip.fixed && p.amountCents !== null &&
                          ` · ${formatBRL(p.amountCents)}`}
                        {template === "cobrar" && p.overdue && " · prazo vencido"}
                        {at && ` · enviada ${SENT_FORMAT.format(at)}`}
                      </p>
                    </div>
                    <a
                      href={whatsappLink(p.whatsapp, messageFor(p))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(p)}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-muted"
                    >
                      {at ? "Abrir de novo" : "WhatsApp"}
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">
              &quot;Enviada&quot; quer dizer que a conversa foi aberta por aqui, neste navegador. A
              Routa não manda nada sozinha. Quando o Pix cair, marque como pago na aba Inscritos.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
