"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  LEVEL_LABELS,
  TERRAIN_LABELS,
  type TripField,
  type TripFormState,
  type TripFormValues,
} from "@/lib/trips";

const HINTS: Partial<Record<TripField, string>> = {
  title:
    "Aparece em destaque na página e na prévia do WhatsApp.",
  description:
    "Paradas, quilometragem, onde vão dormir, o que está incluso no rateio…",
  meeting_point_url:
    "No Google Maps: Compartilhar > Copiar link.",
  capacity:
    "1 vaga = 1 moto. Quem leva garupa ocupa uma vaga só.",
  price:
    "Quem leva garupa paga 2×.",
  pix_key:
    "Só aparece para quem garantiu a vaga.",
  terms_text:
    "Já vem com um texto padrão. Ajuste do jeito que fizer sentido pro seu grupo. O inscrito precisa aceitar para se inscrever.",
};

type Action = (prev: TripFormState, formData: FormData) => Promise<TripFormState>;

export function TripForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial: TripFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<TripFormState, FormData>(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [pricingMode, setPricingMode] = useState(values.pricing_mode);

  /** Props de acessibilidade e erro comuns a todos os campos. */
  const field = (name: TripField) => ({
    id: name,
    name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name]
      ? `${name}-error`
      : HINTS[name]
        ? `${name}-hint`
        : undefined,
  });

  const message = (name: TripField) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error" role="alert">
        {errors[name]}
      </p>
    ) : HINTS[name] ? (
      <p id={`${name}-hint`} className="field-hint">
        {HINTS[name]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <Section title="A viagem">
        <div>
          <label htmlFor="title" className="field-label">
            Título
          </label>
          <input
            {...field("title")}
            required
            maxLength={100}
            placeholder="Ex.: Bate-volta na Serra do Rio do Rastro"
            className="field-input"
          />
          {message("title")}
        </div>

        <div>
          <label htmlFor="destination" className="field-label">
            Destino
          </label>
          <input
            {...field("destination")}
            required
            maxLength={80}
            placeholder="Ex.: Serra do Rio do Rastro (SC)"
            className="field-input"
          />
          {message("destination")}
        </div>

        <div>
          <label htmlFor="description" className="field-label">
            Roteiro e detalhes <span className="font-normal text-stone-600">(opcional)</span>
          </label>
          <textarea
            {...field("description")}
            rows={6}
            maxLength={5000}
            className="field-input py-3"
          />
          {message("description")}
        </div>
      </Section>

      <Section title="Quando e onde">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="start_date" className="field-label">
              Saída
            </label>
            <input {...field("start_date")} type="date" required className="field-input" />
            {message("start_date")}
          </div>
          <div>
            <label htmlFor="end_date" className="field-label">
              Volta
            </label>
            <input {...field("end_date")} type="date" required className="field-input" />
            {message("end_date")}
          </div>
        </div>

        <div>
          <label htmlFor="meeting_point" className="field-label">
            Ponto de encontro
          </label>
          <input
            {...field("meeting_point")}
            required
            maxLength={200}
            placeholder="Ex.: Posto Graal, km 52 da Anhanguera, às 6h"
            className="field-input"
          />
          {message("meeting_point")}
        </div>

        <div>
          <label htmlFor="meeting_point_url" className="field-label">
            Link do Maps <span className="font-normal text-stone-600">(opcional)</span>
          </label>
          <input
            {...field("meeting_point_url")}
            type="url"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            className="field-input"
          />
          {message("meeting_point_url")}
        </div>
      </Section>

      <Section title="Pra quem é">
        <RadioGroup
          name="level"
          legend="Nível exigido"
          options={LEVEL_LABELS}
          defaultValue={values.level}
          error={errors.level}
        />
        <RadioGroup
          name="terrain"
          legend="Tipo de terreno"
          options={TERRAIN_LABELS}
          defaultValue={values.terrain}
          error={errors.terrain}
        />
        <div>
          <label htmlFor="capacity" className="field-label">
            Vagas (motos)
          </label>
          <input
            {...field("capacity")}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            required
            className="field-input"
          />
          {message("capacity")}
        </div>
      </Section>

      <Section title="Pagamento">
        <RadioGroup
          name="pricing_mode"
          legend="Valor"
          options={{ fixed: "Valor fixo por pessoa", split: "A definir / rateio" }}
          defaultValue={values.pricing_mode}
          error={errors.pricing_mode}
          onChange={setPricingMode}
        />

        {pricingMode === "fixed" ? (
          <div>
            <label htmlFor="price" className="field-label">
              Valor por pessoa
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 mt-1 -translate-y-1/2 text-lg text-stone-600">
                R$
              </span>
              <input
                {...field("price")}
                inputMode="decimal"
                placeholder="350,00"
                className="field-input pl-12"
              />
            </div>
            {message("price")}
          </div>
        ) : (
          <>
            <input type="hidden" name="price" value="" />
            <p className="rounded-xl bg-stone-100 px-4 py-3 text-stone-700">
              Depois da inscrição, a pessoa vê sua chave Pix e o aviso de que você vai passar o
              valor.
            </p>
          </>
        )}

        <div>
          <label htmlFor="pix_key" className="field-label">
            Sua chave Pix
          </label>
          <input
            {...field("pix_key")}
            required
            maxLength={140}
            autoComplete="off"
            className="field-input"
          />
          {message("pix_key")}
        </div>
      </Section>

      <Section title="Termo de responsabilidade">
        <div>
          <label htmlFor="terms_text" className="field-label">
            Texto do termo
          </label>
          <textarea
            {...field("terms_text")}
            rows={12}
            maxLength={10000}
            className="field-input py-3 text-base"
          />
          {message("terms_text")}
        </div>
      </Section>

      <div className="space-y-3">
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        {Object.keys(errors).length > 0 && !errors.form && (
          <p className="field-error" role="alert">
            Tem campo para corrigir aí em cima.
          </p>
        )}
        {state.saved && (
          <p className="font-semibold text-green-800" role="status">
            Salvo! ✅
          </p>
        )}
        <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function RadioGroup({
  name,
  legend,
  options,
  defaultValue,
  error,
  onChange,
}: {
  name: string;
  legend: string;
  options: Record<string, string>;
  defaultValue: string;
  error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className="mt-2 grid gap-2">
        {Object.entries(options).map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg has-checked:border-brand has-checked:bg-brand-soft"
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={defaultValue === value}
              onChange={() => onChange?.(value)}
              className="h-5 w-5 accent-brand"
            />
            {label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
