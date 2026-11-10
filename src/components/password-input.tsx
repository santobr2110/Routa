"use client";

import { useState } from "react";

/** Campo de senha com botão de mostrar/ocultar (ajuda muito no celular). */
export function PasswordInput({
  id,
  name,
  autoComplete,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={72}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="field-input pr-24"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute top-1/2 right-2 mt-1 min-h-11 sm:min-h-9 -translate-y-1/2 rounded-lg px-3 font-semibold text-accent"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

/** Força da senha bem simples: tamanho e variedade de caracteres. */
export function passwordStrength(password: string): "fraca" | "ok" | "forte" | null {
  if (!password) return null;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(password)).length;
  if (password.length < 8 || kinds < 2) return "fraca";
  if (password.length >= 12 && kinds >= 3) return "forte";
  return "ok";
}
