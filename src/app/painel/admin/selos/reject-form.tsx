"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

/** Recusar exige um motivo (o organizador vê no perfil). */
export function RejectForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 w-full rounded-lg border border-line px-4 text-sm font-medium text-danger hover:bg-danger-soft sm:w-auto"
      >
        Recusar
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <label className="field-label" htmlFor="reason">
        Motivo (o organizador vai ver)
      </label>
      <textarea
        id="reason"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        rows={3}
        placeholder="Ex.: o número do certificado não confere com o Cadastur."
        className="field-input py-3 text-base"
      />
      <SubmitButton pendingText="Recusando…">Confirmar recusa</SubmitButton>
    </form>
  );
}
