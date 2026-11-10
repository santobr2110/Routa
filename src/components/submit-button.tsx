"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que se desabilita e muda o texto enquanto o formulário envia. */
export function SubmitButton({
  children,
  pendingText = "Enviando…",
  className = "btn-primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  /** Opcional: vai junto no envio (ex.: name="intent" value="disable"). */
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // Com vários botões no mesmo formulário, só o que foi clicado mostra "enviando".
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-busy={mine}>
      {mine ? pendingText : children}
    </button>
  );
}
