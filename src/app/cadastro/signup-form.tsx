"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PasswordInput, passwordStrength } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { signUp, type SignUpState } from "./actions";

const STRENGTH = {
  fraca: { label: "Fraca", className: "text-danger" },
  ok: { label: "Ok", className: "text-warn" },
  forte: { label: "Forte", className: "text-success" },
} as const;

export function SignUpForm() {
  const [state, formAction] = useActionState<SignUpState, FormData>(signUp, {});
  const [password, setPassword] = useState("");
  const errors = state.errors ?? {};
  const strength = passwordStrength(password);

  if (state.sent) {
    return (
      <div className="space-y-3 rounded-xl border border-accent/30 bg-brand-soft p-5" role="status">
        <p className="section-title">Confira seu e-mail 📬</p>
        <p className="text-base">
          Mandamos um link para <strong className="break-all">{state.email}</strong>. Toque nele
          para confirmar a conta. Se não chegar em 1 minuto, olhe o spam.
        </p>
        <p className="text-ink-soft">
          Já tinha conta com esse e-mail? Então{" "}
          <Link href="/entrar" className="font-semibold text-accent underline">
            entre
          </Link>{" "}
          ou use{" "}
          <Link href="/esqueci-senha" className="font-semibold text-accent underline">
            Esqueci minha senha
          </Link>
          .
        </p>
      </div>
    );
  }

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
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="field-input"
        />
        {errors.email && (
          <p id="email-error" className="field-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Crie uma senha
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          describedBy="password-hint"
          onChange={setPassword}
        />
        <p id="password-hint" className={errors.password ? "field-error" : "field-hint"} role={errors.password ? "alert" : undefined}>
          {errors.password ?? "Pelo menos 8 caracteres. Misture letras e números."}
          {strength && !errors.password && (
            <>
              {" "}
              Força: <strong className={STRENGTH[strength].className}>{STRENGTH[strength].label}</strong>
            </>
          )}
        </p>
      </div>

      {errors.form && (
        <p className="field-error text-base" role="alert">
          {errors.form}
        </p>
      )}

      <SubmitButton pendingText="Criando…">Criar conta</SubmitButton>

      <p className="text-center text-base">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-accent underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
