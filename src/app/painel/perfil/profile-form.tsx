"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { saveProfile, type ProfileState } from "../actions";

export function ProfileForm({
  initial,
  email,
  isNew,
}: {
  initial: { name: string; whatsapp: string };
  email: string | null;
  isNew: boolean;
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(saveProfile, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {email && (
        <p className="text-base text-stone-600">
          Logado como <strong className="break-all">{email}</strong>
        </p>
      )}

      <div>
        <label htmlFor="name" className="field-label">
          Seu nome
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          className="field-input"
        />
        {errors.name && (
          <p id="name-error" className="field-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="whatsapp" className="field-label">
          WhatsApp com DDD
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          placeholder="(11) 99999-8888"
          defaultValue={values.whatsapp}
          aria-invalid={errors.whatsapp ? true : undefined}
          aria-describedby={errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"}
          className="field-input"
        />
        {errors.whatsapp ? (
          <p id="whatsapp-error" className="field-error" role="alert">
            {errors.whatsapp}
          </p>
        ) : (
          <p id="whatsapp-hint" className="field-hint">
            É para onde os inscritos mandam o comprovante do Pix.
          </p>
        )}
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}

      <SubmitButton pendingText="Salvando…">{isNew ? "Bora!" : "Salvar"}</SubmitButton>
    </form>
  );
}
