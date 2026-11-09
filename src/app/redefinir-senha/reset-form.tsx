"use client";

import { useActionState, useState } from "react";
import { PasswordInput, passwordStrength } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword, type ResetState } from "./actions";

export function ResetForm() {
  const [state, formAction] = useActionState<ResetState, FormData>(updatePassword, {});
  const [password, setPassword] = useState("");
  const strength = passwordStrength(password);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="password" className="field-label">
          Nova senha
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={!!state.error}
          describedBy="password-hint"
          onChange={setPassword}
        />
        <p id="password-hint" className={state.error ? "field-error" : "field-hint"} role={state.error ? "alert" : undefined}>
          {state.error ?? "Pelo menos 8 caracteres. Misture letras e números."}
          {strength && !state.error && ` Força: ${strength}.`}
        </p>
      </div>
      <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}
