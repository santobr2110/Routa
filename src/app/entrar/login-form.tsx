"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});
  const error = state.error;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="field-label">
          E-mail
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
          aria-invalid={error ? true : undefined}
          className="field-input"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="field-label">
            Senha
          </label>
          <Link href="/esqueci-senha" className="font-semibold text-accent underline">
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          invalid={!!error}
          describedBy={error ? "login-error" : undefined}
        />
      </div>

      {error && (
        <p id="login-error" className="field-error text-base" role="alert">
          {error}
        </p>
      )}

      <SubmitButton pendingText="Entrando…" className="btn-primary w-full sm:w-full">
        Entrar
      </SubmitButton>

      <p className="text-center text-base">
        Primeira vez aqui?{" "}
        <Link href="/cadastro" className="font-semibold text-accent underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
