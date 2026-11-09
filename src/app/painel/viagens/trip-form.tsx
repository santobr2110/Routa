"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  LEVEL_LABELS,
  TERRAIN_LABELS,
  type TripField,
  type TripFormState,
  type TripFormValues,
} from "@/lib/trips";

const MAPS_HINT = "No Google Maps: Compartilhar > Copiar link.";

const HINTS: Partial<Record<TripField, string>> = {
  title: "Aparece em destaque na página e na prévia do WhatsApp.",
  description: "Paradas, quilometragem, onde vão dormir, o que está incluso no rateio…",
  departure_point_url: MAPS_HINT,
  return_point: "Deixa vazio se for o mesmo local da saída.",
  return_point_url: MAPS_HINT,
  return_time: "Previsão de chegada no último dia.",
  capacity: "1 vaga = 1 moto. Quem leva garupa ocupa uma vaga só.",
  price: "Valor de quem vai sozinho na moto.",
  pillion_price: "Valor fechado da dupla. Deixa vazio se a viagem não aceita garupa.",
  terrain_percent: "Ex.: 80 = 80% da viagem nesse terreno.",
  pix_key: "Só aparece para quem garantiu a vaga.",
  terms_text:
    "Já vem com um texto padrão. Ajuste do jeito que fizer sentido pro seu grupo. O inscrito precisa aceitar para se inscrever.",
};

type Action = (prev: TripFormState, formData: FormData) => Promise<TripFormState>;

/** id do formulário: os botões de status no topo da página usam form={TRIP_FORM_ID}. */
export const TRIP_FORM_ID = "trip-form";

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
  const formRef = useRef<HTMLFormElement>(null);

  // Se voltou com erro, leva a tela até o primeiro campo com problema
  // (importante quando o envio veio de um botão lá no topo).
  useEffect(() => {
    if (!state.errors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
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
    <form ref={formRef} id={TRIP_FORM_ID} action={formAction} className="space-y-8" noValidate>
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
            Roteiro e detalhes <span className="font-normal text-muted">(opcional)</span>
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
              Data de saída
            </label>
            <input {...field("start_date")} type="date" required className="field-input" />
            {message("start_date")}
          </div>
          <div>
            <label htmlFor="end_date" className="field-label">
              Data de retorno
            </label>
            <input {...field("end_date")} type="date" required className="field-input" />
            {message("end_date")}
          </div>
        </div>

        <PlaceFields
          kind="departure"
          title="Saída"
          pointLabel="Local de saída"
          pointPlaceholder="Ex.: Posto Graal, km 52 da Anhanguera"
          timeLabel="Horário"
          field={field}
          message={message}
        />
        <PlaceFields
          kind="return"
          title="Retorno"
          pointLabel="Local de retorno"
          optional
          pointPlaceholder="Ex.: Praça central de Jaraguá do Sul"
          timeLabel="Horário previsto"
          field={field}
          message={message}
        />
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
          legend="Terreno predominante"
          options={TERRAIN_LABELS}
          defaultValue={values.terrain}
          error={errors.terrain}
        />
        <div>
          <label htmlFor="terrain_percent" className="field-label">
            Quanto % da viagem é nesse terreno?
          </label>
          <div className="relative">
            <input
              {...field("terrain_percent")}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              required
              className="field-input pr-12"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-lg text-muted">
              %
            </span>
          </div>
          {message("terrain_percent")}
        </div>
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
        <div>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 text-lg has-checked:border-brand has-checked:bg-brand-soft">
            <input
              type="checkbox"
              name="requires_plate"
              defaultChecked={values.requires_plate === "on"}
              className="h-5 w-5 accent-brand"
            />
            Pedir a placa da moto na inscrição
          </label>
          <p className="mt-1 text-sm text-muted">
            Ligue só se precisar (check-in, pousada, seguro). A placa só aparece para você e é
            apagada 90 dias depois da viagem.
          </p>
        </div>
      </Section>

      <Section title="Pagamento">
        <RadioGroup
          name="pricing_mode"
          legend="Valor"
          options={{ fixed: "Valor fixo por moto", split: "A definir / rateio" }}
          defaultValue={values.pricing_mode}
          error={errors.pricing_mode}
          onChange={setPricingMode}
        />

        {pricingMode === "fixed" ? (
          <>
            <MoneyField name="price" label="Valor piloto" field={field} message={message} />
            <MoneyField
              name="pillion_price"
              label="Valor piloto + garupa"
              optional
              field={field}
              message={message}
            />
          </>
        ) : (
          <>
            <input type="hidden" name="price" value="" />
            <input type="hidden" name="pillion_price" value="" />
            <p className="rounded-xl bg-surface-muted px-4 py-3 text-ink-soft">
              Depois da inscrição, a pessoa vê sua chave Pix e o aviso de que você vai passar o
              valor.
            </p>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 text-lg has-checked:border-brand has-checked:bg-brand-soft">
              <input
                type="checkbox"
                name="accepts_pillion"
                defaultChecked={values.accepts_pillion === "on"}
                className="h-5 w-5 accent-brand"
              />
              Aceita garupa
            </label>
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
          <p className="font-semibold text-success" role="status">
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
    <section className="space-y-5 rounded-2xl border border-line bg-surface p-4 sm:p-6">
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
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line-strong bg-surface px-4 text-lg has-checked:border-brand has-checked:bg-brand-soft"
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

type FieldProps = (name: TripField) => {
  id: string;
  name: string;
  defaultValue: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};
type MessageFn = (name: TripField) => React.ReactNode;

/** Local (texto + horário + link do Maps) da saída ou do retorno. */
function PlaceFields({
  kind,
  title,
  pointLabel,
  pointPlaceholder,
  timeLabel,
  optional = false,
  field,
  message,
}: {
  kind: "departure" | "return";
  title: string;
  pointLabel: string;
  pointPlaceholder: string;
  timeLabel: string;
  optional?: boolean;
  field: FieldProps;
  message: MessageFn;
}) {
  const point = `${kind}_point` as const;
  const url = `${kind}_point_url` as const;
  const time = `${kind}_time` as const;
  const opt = optional && <span className="font-normal text-muted">(opcional)</span>;

  return (
    <fieldset className="space-y-4 rounded-xl border border-line p-4">
      <legend className="px-1 text-lg font-bold">{title}</legend>
      <div>
        <label htmlFor={point} className="field-label">
          {pointLabel} {opt}
        </label>
        <input
          {...field(point)}
          required={!optional}
          maxLength={200}
          placeholder={pointPlaceholder}
          className="field-input"
        />
        {message(point)}
      </div>
      <div>
        <label htmlFor={time} className="field-label">
          {timeLabel} {opt}
        </label>
        <input {...field(time)} type="time" required={!optional} className="field-input" />
        {message(time)}
      </div>
      <div>
        <label htmlFor={url} className="field-label">
          Link do Maps <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          {...field(url)}
          type="url"
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          className="field-input"
        />
        {message(url)}
      </div>
    </fieldset>
  );
}

function MoneyField({
  name,
  label,
  optional = false,
  field,
  message,
}: {
  name: "price" | "pillion_price";
  label: string;
  optional?: boolean;
  field: FieldProps;
  message: MessageFn;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label} {optional && <span className="font-normal text-muted">(opcional)</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 mt-1 -translate-y-1/2 text-lg text-muted">
          R$
        </span>
        <input {...field(name)} inputMode="decimal" placeholder="0,00" className="field-input pl-12" />
      </div>
      {message(name)}
    </div>
  );
}
