"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { CONFIRM_WORD, TRASH_DAYS, confirmWordOk } from "@/lib/trash";

type State = { errors?: { word?: string; password?: string; reason?: string; form?: string } };

/**
 * Exclusão em três passos: 1) aviso com o que se perde (e a planilha para baixar antes),
 * 2) digitar EXCLUIR, 3) senha da conta. Usado pelo organizador e pela administração
 * (que também escreve o motivo).
 */
export function DeleteTripForm({
  action,
  summary,
  consequences,
  spreadsheetHref,
  askReason = false,
  buttonLabel = "Excluir viagem",
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  /** Ex.: "4 confirmados (2 pagos), 1 na fila, 3 fotos e 2 avisos". */
  summary: string;
  consequences: string[];
  spreadsheetHref?: string;
  askReason?: boolean;
  buttonLabel?: string;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [understood, setUnderstood] = useState(false);
  const [word, setWord] = useState("");
  // Controlados: o formulário é limpo depois de cada envio, e o motivo não pode se perder.
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState<State, FormData>(action, {});
  const errors = state.errors ?? {};

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="min-h-11 w-full rounded-lg border border-danger/40 px-4 font-medium text-danger hover:bg-danger-soft sm:w-auto"
      >
        {buttonLabel}…
      </button>
    );
  }

  const cancel = () => {
    setStep(0);
    setUnderstood(false);
    setWord("");
    setReason("");
  };

  return (
    <div className="space-y-4 rounded-xl border border-danger/40 p-4">
      <ol className="flex gap-2 text-xs font-medium text-muted" aria-label="Passos">
        <li className={step === 1 ? "text-danger" : ""}>1. Aviso</li>
        <li aria-hidden>›</li>
        <li className={step === 2 ? "text-danger" : ""}>2. Confirmar</li>
      </ol>

      {step === 1 ? (
        <div className="space-y-3">
          <p className="font-semibold text-danger">Você vai excluir esta viagem</p>
          <p className="text-sm">
            Ela tem <strong>{summary}</strong>.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
            <li>
              Fica {TRASH_DAYS} dias na lixeira. Depois disso, a viagem, os inscritos, as fotos e
              os avisos são apagados de vez e não dá para recuperar.
            </li>
          </ul>
          {spreadsheetHref && (
            <a href={spreadsheetHref} className="btn-secondary inline-flex">
              📊 Baixar planilha dos inscritos antes
            </a>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-danger)]"
            />
            Entendi o que acontece com a viagem e os inscritos.
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!understood}
              onClick={() => setStep(2)}
              className="min-h-11 rounded-lg bg-danger px-4 font-medium text-surface disabled:opacity-40"
            >
              Continuar
            </button>
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          {askReason && (
            <div className="space-y-1">
              <label className="field-label" htmlFor="delete-reason">
                Motivo (fica na auditoria e o organizador vê)
              </label>
              <textarea
                id="delete-reason"
                name="reason"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                placeholder="Ex.: denúncia de golpe confirmada."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="field-input py-3 text-base"
              />
              {errors.reason && <p className="field-error">{errors.reason}</p>}
            </div>
          )}
          <div className="space-y-1">
            <label className="field-label" htmlFor="confirm-word">
              Digite <strong className="font-mono">{CONFIRM_WORD}</strong> para confirmar
            </label>
            <input
              id="confirm-word"
              name="confirm_word"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="field-input font-mono"
              aria-invalid={!!errors.word}
            />
            {errors.word && <p className="field-error">{errors.word}</p>}
          </div>
          <div className="space-y-1">
            <label className="field-label" htmlFor="confirm-password">
              Sua senha da Routa
            </label>
            <input
              id="confirm-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field-input"
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          {errors.form && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
              {errors.form}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {confirmWordOk(word) ? (
              <SubmitButton
                pendingText="Excluindo…"
                className="min-h-11 rounded-lg bg-danger px-4 font-medium text-surface disabled:opacity-60"
              >
                {buttonLabel}
              </SubmitButton>
            ) : (
              <button
                type="button"
                disabled
                className="min-h-11 rounded-lg bg-danger px-4 font-medium text-surface opacity-40"
              >
                {buttonLabel}
              </button>
            )}
            <button type="button" onClick={cancel} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
