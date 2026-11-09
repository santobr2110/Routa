"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, formAction] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="space-y-3 rounded-2xl border-2 border-accent/30 bg-brand-soft p-5" role="status">
        <p className="text-xl font-bold">Confira seu e-mail 📬</p>
        <p className="text-lg">
          Se existir uma conta com <strong className="break-all">{state.email}</strong>, mandamos
          um link para criar uma senha nova. Se não chegar em 1 minuto, olhe o spam.
        </p>
        <Link href="/entrar" className="inline-flex min-h-12 items-center font-semibold text-accent">
          ← Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="field-label">
          E-mail da sua conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          placeholder="voce@exemplo.com"
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "email-error" : undefined}
          className="field-input"
        />
        {state.error && (
          <p id="email-error" className="field-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton pendingText="Enviando…">Receber link para nova senha</SubmitButton>
      <Link href="/entrar" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Voltar para o login
      </Link>
    </form>
  );
}
