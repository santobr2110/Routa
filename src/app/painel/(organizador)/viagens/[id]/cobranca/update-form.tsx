"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { addTripUpdate, type UpdateState } from "./actions";

/** Caixa para publicar um aviso no mural da viagem. Limpa depois de publicar. */
export function UpdateForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState<UpdateState, FormData>(addTripUpdate.bind(null, tripId), {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <label htmlFor="body" className="field-label">
        Novo aviso
      </label>
      <textarea
        id="body"
        name="body"
        rows={3}
        maxLength={2000}
        placeholder="Ex.: A saída mudou para 6h30, no mesmo posto. Levem capa de chuva!"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "body-error" : "body-hint"}
        className="field-input"
      />
      {state.error ? (
        <p id="body-error" className="field-error" role="alert">
          {state.error}
        </p>
      ) : (
        <p id="body-hint" className="field-hint">
          Aparece na página de cada inscrito. Para avisar na hora, mande também pelo WhatsApp
          (modelo &quot;Aviso ao grupo&quot; abaixo).
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton pendingText="Publicando…">Publicar no mural</SubmitButton>
      </div>
    </form>
  );
}
