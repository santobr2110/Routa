"use client";

import { useActionState, useState } from "react";
import { ConvoyFields } from "@/components/convoy-fields";
import { SubmitButton } from "@/components/submit-button";
import { CC_BAND_LABELS } from "@/lib/bike-specs";
import {
  EXPERIENCE_SHORT,
  SKILL_SHORT,
  type ConvoySummary,
} from "@/lib/convoy";
import type { RegistrationPage } from "@/lib/registration-page";
import { saveConvoy, type ConvoyFormState } from "./actions";

type Convoy = NonNullable<RegistrationPage["convoy"]>;

/** Raio-X na página do inscrito: responder/editar e ver o resumo anônimo do grupo. */
export function ConvoySection({
  token,
  convoy,
  bike,
}: {
  token: string;
  convoy: Convoy;
  bike: { brand: string; model: string };
}) {
  const [state, formAction] = useActionState<ConvoyFormState, FormData>(
    saveConvoy.bind(null, token),
    {},
  );
  const answered = !!convoy.profile;
  const [editing, setEditing] = useState(false);
  const showForm = convoy.can_edit && (!answered || editing) && !state.savedAt;

  return (
    <section className="space-y-3" id="raio-x">
      <h2 className="section-title">Raio-X do comboio</h2>

      {state.savedAt && (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success" role="status">
          Respostas salvas. Valeu! O organizador já consegue ver. 🤙
        </p>
      )}

      {showForm ? (
        <form action={formAction} className="space-y-3">
          {!answered && (
            <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm">
              <strong>Falta só isso:</strong> responda o Raio-X para o organizador montar um
              comboio seguro. Leva 1 minuto.
            </p>
          )}
          <ConvoyFields
            settings={convoy}
            bike={bike}
            defaults={convoy.profile}
            errors={state.errors}
            title={answered ? "Editar minhas respostas" : "Suas respostas"}
          />
          {state.errors?.form && (
            <p className="field-error text-base" role="alert">
              {state.errors.form}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText="Salvando…">Salvar respostas</SubmitButton>
            {answered && (
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        answered && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <p className="text-ink-soft">✅ Você já respondeu o Raio-X.</p>
            {convoy.can_edit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-medium text-accent underline"
              >
                Editar respostas
              </button>
            )}
          </div>
        )
      )}

      {convoy.summary && convoy.summary.bikes > 0 && <GroupSummary s={convoy.summary} />}
    </section>
  );
}

function GroupSummary({ s }: { s: ConvoySummary }) {
  const bands = (Object.keys(CC_BAND_LABELS) as (keyof typeof CC_BAND_LABELS)[]).filter(
    (k) => s.cc_bands[k] > 0,
  );
  const exp = (Object.keys(EXPERIENCE_SHORT) as (keyof typeof EXPERIENCE_SHORT)[]).filter(
    (k) => s.experience[k] > 0,
  );
  const skills = (Object.keys(SKILL_SHORT) as (keyof typeof SKILL_SHORT)[]).filter(
    (k) => s.skills[k] > 0,
  );
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-medium">O comboio até agora</p>
        <p className="text-xs text-muted">
          {plural(s.bikes, "moto confirmada", "motos confirmadas")} ·{" "}
          {plural(s.answered, "respondeu", "responderam")} · sem nomes
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {bands.length > 0 && (
          <div>
            <dt className="text-xs text-muted">Cilindradas</dt>
            {bands.map((k) => (
              <dd key={k}>
                {CC_BAND_LABELS[k]}: <strong>{s.cc_bands[k]}</strong>
              </dd>
            ))}
          </div>
        )}
        {exp.length > 0 && (
          <div>
            <dt className="text-xs text-muted">Experiência</dt>
            {exp.map((k) => (
              <dd key={k}>
                {EXPERIENCE_SHORT[k]}: <strong>{s.experience[k]}</strong>
              </dd>
            ))}
          </div>
        )}
        {skills.length > 0 && (
          <div>
            <dt className="text-xs text-muted">Quem pode ajudar</dt>
            {skills.map((k) => (
              <dd key={k}>
                {SKILL_SHORT[k]}: <strong>{s.skills[k]}</strong>
              </dd>
            ))}
          </div>
        )}
      </dl>
    </div>
  );
}
