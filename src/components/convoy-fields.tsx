"use client";

import { useState } from "react";
import { CC_BAND_LABELS, STYLE_LABELS, bikeSpec, type CcBand } from "@/lib/bike-specs";
import {
  EXPERIENCE_LABELS,
  OFFROAD_LABELS,
  SKILL_LABELS,
  type ConvoyField,
  type ConvoyProfile,
  type ConvoySettings,
  type Experience,
  type Offroad,
  type Skill,
} from "@/lib/convoy";

/**
 * Perguntas do Raio-X do comboio. Usado na inscrição e na página do inscrito.
 * Só mostra o que o organizador ligou; a cilindrada só é perguntada se o modelo
 * não estiver na tabela da Routa.
 */
export function ConvoyFields({
  settings,
  bike,
  defaults,
  errors = {},
  title = "Raio-X do comboio",
}: {
  settings: ConvoySettings;
  bike: { brand: string; model: string };
  defaults?: Partial<ConvoyProfile> | null;
  errors?: Partial<Record<ConvoyField, string>>;
  title?: string;
}) {
  const [unknown, setUnknown] = useState(!!defaults?.range_unknown);
  const spec = bikeSpec(bike.brand, bike.model);
  const tag = (mode: ConvoySettings["range"]) =>
    mode === "optional" && <span className="font-normal text-muted"> (opcional)</span>;
  const err = (k: ConvoyField) =>
    errors[k] && (
      <p id={`${k}-error`} className="field-error" role="alert">
        {errors[k]}
      </p>
    );

  return (
    <section className="card space-y-6 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="section-title">🏍️ {title}</h2>
        <p className="text-muted">
          Ajuda o organizador a montar um comboio seguro: paradas, ritmo e quem ajuda quem. Só ele
          vê suas respostas; o grupo vê só um resumo, sem nomes.
        </p>
      </div>

      {settings.range !== "off" && (
        <div>
          <label htmlFor="convoy_range_km" className="field-label">
            Quantos km sua moto faz com o tanque cheio?{tag(settings.range)}
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <div className="relative w-40">
              <input
                id="convoy_range_km"
                name="convoy_range_km"
                type="number"
                inputMode="numeric"
                min={30}
                max={2000}
                placeholder="Ex.: 280"
                disabled={unknown}
                defaultValue={defaults?.range_km ?? ""}
                aria-invalid={errors.convoy_range ? true : undefined}
                aria-describedby={errors.convoy_range ? "convoy_range-error" : "convoy_range-hint"}
                className="field-input mt-0 pr-10 disabled:opacity-50"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
                km
              </span>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-10">
              <input
                type="checkbox"
                name="convoy_range_unknown"
                checked={unknown}
                onChange={(e) => setUnknown(e.target.checked)}
                className="h-5 w-5 accent-brand"
              />
              Não sei
            </label>
          </div>
          <p id="convoy_range-hint" className="mt-1 text-sm text-muted">
            É a autonomia: do tanque cheio até a reserva acabar, num ritmo de viagem.
            {settings.longest_stretch_km &&
              ` O maior trecho sem posto desta viagem tem ${settings.longest_stretch_km} km.`}
          </p>
          {err("convoy_range")}
        </div>
      )}

      {settings.experience !== "off" && (
        <div className="space-y-4">
          <fieldset aria-describedby={errors.convoy_experience ? "convoy_experience-error" : undefined}>
            <legend className="field-label">
              Sua experiência em viagens de moto{tag(settings.experience)}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(Object.entries(EXPERIENCE_LABELS) as [Experience, string][]).map(([k, label]) => (
                <label key={k} className="choice">
                  <input
                    type="radio"
                    name="convoy_experience"
                    value={k}
                    defaultChecked={defaults?.experience === k}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">E na terra?{tag(settings.experience)}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.entries(OFFROAD_LABELS) as [Offroad, string][]).map(([k, label]) => (
                <label key={k} className="choice">
                  <input
                    type="radio"
                    name="convoy_offroad"
                    value={k}
                    defaultChecked={defaults?.offroad === k}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {err("convoy_experience")}
        </div>
      )}

      {settings.skills !== "off" && (
        <fieldset>
          <legend className="field-label">
            Pode ajudar o grupo com…{" "}
            <span className="font-normal text-muted">(marque o que valer)</span>
          </legend>
          <div className="mt-2 grid gap-2">
            {(Object.entries(SKILL_LABELS) as [Skill, string][]).map(([k, label]) => (
              <label key={k} className="choice">
                <input
                  type="checkbox"
                  name="convoy_skills"
                  value={k}
                  defaultChecked={defaults?.skills?.includes(k)}
                  className="h-5 w-5 shrink-0 accent-brand"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {bike.brand.trim() && bike.model.trim() && (
        spec ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft">
            Sua moto: {spec.cc}cc · {STYLE_LABELS[spec.style]}
          </p>
        ) : (
          <div>
            <label htmlFor="convoy_cc_band" className="field-label">
              Cilindrada da moto <span className="font-normal text-muted">(opcional)</span>
            </label>
            <select
              id="convoy_cc_band"
              name="convoy_cc_band"
              defaultValue={defaults?.cc_band ?? ""}
              className="field-input"
            >
              <option value="">Escolha a faixa</option>
              {(Object.entries(CC_BAND_LABELS) as [CcBand, string][]).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {err("convoy_cc_band")}
          </div>
        )
      )}
    </section>
  );
}
