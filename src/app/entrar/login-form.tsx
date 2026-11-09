"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="space-y-4 rounded-2xl border-2 border-accent/30 bg-brand-soft p-5" role="status">
        <p className="text-xl font-bold">Confira seu e-mail 📬</p>
        <p className="text-lg">
          Mandamos um link de acesso para <strong className="break-all">{state.email}</strong>.
          Toque nele para entrar. Se não chegar em 1 minuto, olhe o spam.
        </p>
        <form action={formAction}>
          <input type="hidden" name="email" value={state.email} />
          <SubmitButton className="btn-secondary" pendingText="Reenviando…">
            Reenviar link
          </SubmitButton>
        </form>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="field-label">
          Seu e-mail
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
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : "email-hint"}
          className="field-input"
        />
        {error ? (
          <p id="email-error" className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <p id="email-hint" className="field-hint">
            Sem senha: a gente manda um link de acesso.
          </p>
        )}
      </div>

      <SubmitButton pendingText="Enviando o link…">Receber link de acesso</SubmitButton>
    </form>
  );
}
