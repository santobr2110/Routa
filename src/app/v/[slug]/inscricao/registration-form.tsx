"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Turnstile } from "@/components/turnstile";
import { BIKE_BRANDS, maxBikeYear, modelsFor } from "@/lib/bikes";
import { formatBRL } from "@/lib/format";
import type { PricingMode } from "@/types/database";
import {
  registerForTrip,
  type RegisterField,
  type RegisterState,
  type RegisterValues,
} from "./actions";
import { RegistrationDone } from "./registration-done";

export type FormTrip = {
  slug: string;
  title: string;
  pricingMode: PricingMode;
  priceCents: number | null;
  pillionPriceCents: number | null;
  acceptsPillion: boolean;
  requiresPlate: boolean;
  isFull: boolean;
  termsText: string;
};

const EMPTY: RegisterValues = {
  name: "",
  whatsapp: "",
  email: "",
  bike_brand: "",
  bike_model: "",
  bike_year: "",
  bike_color: "",
  bike_plate: "",
  has_pillion: "no",
  pillion_name: "",
  emergency_name: "",
  emergency_phone: "",
  terms: "",
};

export function RegistrationForm({
  trip,
  turnstileSiteKey,
}: {
  trip: FormTrip;
  /** Vazio = anti-robô desligado (computador de desenvolvimento). */
  turnstileSiteKey: string;
}) {
  const [state, formAction] = useActionState<RegisterState, FormData>(
    registerForTrip.bind(null, trip.slug),
    {},
  );
  const values = state.values ?? EMPTY;
  const errors = state.errors ?? {};
  const [hasPillion, setHasPillion] = useState(values.has_pillion === "yes");
  const [brand, setBrand] = useState(values.bike_brand);
  const models = modelsFor(brand);

  if (state.result) {
    return <RegistrationDone trip={trip} result={state.result} name={values.name} />;
  }

  const fixed = trip.pricingMode === "fixed" && trip.priceCents !== null;

  /** Props comuns: id, nome, valor, acessibilidade e erro. */
  const field = (name: RegisterField) => ({
    id: name,
    name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    className: "field-input",
  });
  const error = (name: RegisterField) =>
    errors[name] && (
      <p id={`${name}-error`} className="field-error" role="alert">
        {errors[name]}
      </p>
    );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {trip.isFull && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn" role="status">
          As vagas lotaram. Se você enviar, entra na <strong>lista de espera</strong> e o
          organizador te avisa se abrir vaga.
        </p>
      )}

      <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-xl font-bold">Seus dados</h2>
        <div>
          <label htmlFor="name" className="field-label">
            Nome completo
          </label>
          <input {...field("name")} autoComplete="name" required maxLength={80} />
          {error("name")}
        </div>
        <div>
          <label htmlFor="whatsapp" className="field-label">
            WhatsApp com DDD
          </label>
          <input
            {...field("whatsapp")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 99999-8888"
            required
          />
          {error("whatsapp")}
        </div>
        <div>
          <label htmlFor="email" className="field-label">
            E-mail
          </label>
          <input
            {...field("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
          {error("email")}
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-xl font-bold">Sua moto</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="bike_brand" className="field-label">
              Marca
            </label>
            <input
              {...field("bike_brand")}
              list="bike-brands"
              placeholder="Ex.: Honda"
              autoComplete="off"
              required
              maxLength={40}
              onChange={(e) => setBrand(e.target.value)}
            />
            <datalist id="bike-brands">
              {BIKE_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {error("bike_brand")}
          </div>
          <div>
            <label htmlFor="bike_model" className="field-label">
              Modelo
            </label>
            <input
              {...field("bike_model")}
              list="bike-models"
              placeholder="Ex.: XRE 300"
              autoComplete="off"
              required
              maxLength={60}
            />
            <datalist id="bike-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {error("bike_model")}
          </div>
          <div>
            <label htmlFor="bike_year" className="field-label">
              Ano <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              {...field("bike_year")}
              type="number"
              inputMode="numeric"
              min={1950}
              max={maxBikeYear()}
              placeholder="Ex.: 2022"
            />
            {error("bike_year")}
          </div>
          <div>
            <label htmlFor="bike_color" className="field-label">
              Cor <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input {...field("bike_color")} placeholder="Ex.: vermelha" maxLength={30} />
            {error("bike_color")}
          </div>
        </div>
        {trip.requiresPlate && (
          <div>
            <label htmlFor="bike_plate" className="field-label">
              Placa
            </label>
            <input
              {...field("bike_plate")}
              placeholder="ABC1D23"
              autoComplete="off"
              autoCapitalize="characters"
              required
              maxLength={8}
              className="field-input uppercase"
            />
            <p className="mt-1 text-sm text-muted">
              O organizador pediu a placa (check-in, pousada ou seguro). Só ele vê, e ela é
              apagada 90 dias depois da viagem.
            </p>
            {error("bike_plate")}
          </div>
        )}
      </section>

      {trip.acceptsPillion ? (
        <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <fieldset aria-describedby={errors.has_pillion ? "has_pillion-error" : undefined}>
            <legend className="text-xl font-bold">Vai levar garupa?</legend>
            <div className="mt-3 grid gap-2">
              {[
                { value: "no", label: "Vou sozinho(a)", price: trip.priceCents },
                { value: "yes", label: "Vou com garupa", price: trip.pillionPriceCents },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 text-lg has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input
                    type="radio"
                    name="has_pillion"
                    value={option.value}
                    defaultChecked={values.has_pillion === option.value}
                    onChange={() => setHasPillion(option.value === "yes")}
                    className="h-5 w-5 accent-brand"
                  />
                  <span className="flex-1">{option.label}</span>
                  {fixed && option.price !== null && (
                    <span className="font-bold">{formatBRL(option.price)}</span>
                  )}
                </label>
              ))}
            </div>
            {error("has_pillion")}
          </fieldset>
          {hasPillion && (
            <div>
              <label htmlFor="pillion_name" className="field-label">
                Nome da garupa
              </label>
              <input {...field("pillion_name")} required maxLength={80} />
              {error("pillion_name")}
            </div>
          )}
        </section>
      ) : (
        <>
          <input type="hidden" name="has_pillion" value="no" />
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-ink-soft">
            Esta viagem não aceita garupa.
            {fixed && ` Valor: ${formatBRL(trip.priceCents!)}.`}
          </p>
        </>
      )}

      <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Contato de emergência</h2>
          <p className="text-muted">Alguém que não está na viagem, pra avisar se precisar.</p>
        </div>
        <div>
          <label htmlFor="emergency_name" className="field-label">
            Nome
          </label>
          <input {...field("emergency_name")} required maxLength={80} />
          {error("emergency_name")}
        </div>
        <div>
          <label htmlFor="emergency_phone" className="field-label">
            Telefone com DDD
          </label>
          <input
            {...field("emergency_phone")}
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-8888"
            required
          />
          {error("emergency_phone")}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-xl font-bold">
            Termo de responsabilidade
            <span aria-hidden className="text-base text-accent group-open:hidden">
              Ler
            </span>
          </summary>
          <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line text-ink-soft">
            {trip.termsText}
          </p>
        </details>
        <label className="flex min-h-14 cursor-pointer items-start gap-3 text-lg">
          <input
            type="checkbox"
            name="terms"
            defaultChecked={values.terms === "on"}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
            className="mt-1 h-6 w-6 shrink-0 accent-brand"
          />
          <span>Li e aceito o termo de responsabilidade.</span>
        </label>
        {error("terms")}
      </section>

      <div className="space-y-3">
        {errors.form && (
          <p className="field-error text-base" role="alert">
            {errors.form}
          </p>
        )}
        {Object.keys(errors).length > 0 && !errors.form && (
          <p className="field-error text-base" role="alert">
            Tem campo para corrigir aí em cima.
          </p>
        )}
        {turnstileSiteKey && (
          <Turnstile siteKey={turnstileSiteKey} resetKey={state.attempt ?? 0} />
        )}
        <SubmitButton pendingText="Enviando…">
          {trip.isFull ? "Entrar na lista de espera" : "Garantir minha vaga"}
        </SubmitButton>
        <p className="text-sm text-muted">
          Seu WhatsApp, o contato de emergência e os dados da moto só aparecem para o
          organizador desta viagem.{" "}
          <Link href="/privacidade" className="font-semibold text-accent underline">
            Política de privacidade
          </Link>
        </p>
      </div>
    </form>
  );
}
