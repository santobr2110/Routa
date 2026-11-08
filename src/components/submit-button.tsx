"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que se desabilita e muda o texto enquanto o formulário envia. */
export function SubmitButton({
  children,
  pendingText = "Enviando…",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
