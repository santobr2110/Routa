"use client";

import { useFormStatus } from "react-dom";

/** Botão "Remover" que pede confirmação antes de enviar o formulário. */
export function RemoveButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`Remover ${name} da viagem?\n\nSe tiver alguém na lista de espera, o primeiro ganha a vaga.`)) {
          e.preventDefault();
        }
      }}
      className="inline-flex min-h-11 sm:min-h-9 items-center rounded-xl px-3 font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
    >
      {pending ? "Removendo…" : "Remover da viagem"}
    </button>
  );
}
