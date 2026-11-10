"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

/** Botão que abre um campo de motivo antes de uma ação de moderação. */
export function ReasonForm({
  action,
  label,
  confirmLabel,
  pendingText,
  placeholder,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  confirmLabel: string;
  pendingText: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 w-full rounded-lg border border-line px-4 text-sm font-medium text-danger hover:bg-danger-soft sm:w-auto"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-2 rounded-xl border border-line p-3"
    >
      <label className="field-label" htmlFor="reason">
        Motivo (fica registrado e o organizador vê)
      </label>
      <textarea
        id="reason"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        rows={3}
        placeholder={placeholder}
        className="field-input py-3 text-base"
      />
      <SubmitButton pendingText={pendingText}>{confirmLabel}</SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="min-h-9 w-full text-sm font-medium text-ink-soft sm:w-auto"
      >
        Cancelar
      </button>
    </form>
  );
}
