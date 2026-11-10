"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PasswordInput, passwordStrength } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { changePassword, type ChangePasswordState } from "./password-actions";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  const errors = state.errors ?? {};

  return (
    <section aria-labelledby="change-password-title" className="space-y-4 border-t border-line pt-8">
      <h2 id="change-password-title" className="text-2xl font-semibold tracking-tight">
        Trocar senha
      </h2>

      {state.savedAt && !state.errors && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-base font-semibold" role="status">
          Senha trocada ✅ Use a nova da próxima vez que entrar.
        </p>
      )}

      {/* key: depois de salvar, remonta o formulário e limpa os campos. */}
      <form key={state.savedAt ?? 0} action={formAction} className="space-y-5" noValidate>
        <div>
          <label htmlFor="current_password" className="field-label">
            Senha atual
          </label>
          <PasswordInput
            id="current_password"
            name="current_password"
            autoComplete="current-password"
            invalid={!!errors.current}
            describedBy={errors.current ? "current-error" : "current-hint"}
          />
          {errors.current ? (
            <p id="current-error" className="field-error" role="alert">
              {errors.current}
            </p>
          ) : (
            <p id="current-hint" className="field-hint">
              Não lembra?{" "}
              <Link href="/esqueci-senha" className="font-semibold text-accent underline">
                Recebe um link por e-mail
              </Link>
              .
            </p>
          )}
        </div>

        <NewPasswordField error={errors.next} />

        {errors.form && (
          <p className="field-error text-base" role="alert">
            {errors.form}
          </p>
        )}

        <SubmitButton pendingText="Trocando…">Trocar senha</SubmitButton>
      </form>
    </section>
  );
}

function NewPasswordField({ error }: { error?: string }) {
  const [password, setPassword] = useState("");
  const strength = passwordStrength(password);

  return (
    <div>
      <label htmlFor="new_password" className="field-label">
        Senha nova
      </label>
      <PasswordInput
        id="new_password"
        name="new_password"
        autoComplete="new-password"
        invalid={!!error}
        describedBy="new-password-hint"
        onChange={setPassword}
      />
      <p id="new-password-hint" className={error ? "field-error" : "field-hint"} role={error ? "alert" : undefined}>
        {error ?? "Pelo menos 8 caracteres. Misture letras e números."}
        {strength && !error && ` Força: ${strength}.`}
      </p>
    </div>
  );
}
