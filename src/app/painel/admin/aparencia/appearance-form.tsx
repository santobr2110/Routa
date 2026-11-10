"use client";

import { useActionState, useState } from "react";
import { ColorPicker } from "@/components/color-picker";
import { HeroImageField } from "@/components/hero-image-field";
import { SubmitButton } from "@/components/submit-button";
import { ROUTA_COLOR, siteThemeStyle } from "@/lib/club-colors";
import { saveAppearance, type AppearanceState } from "./actions";

type Values = { login_image_path: string; panel_image_path: string; brand_color: string };

export function AppearanceForm({ initial }: { initial: Values }) {
  const [state, formAction] = useActionState<AppearanceState, FormData>(saveAppearance, {});
  const [login, setLogin] = useState(initial.login_image_path);
  const [panel, setPanel] = useState(initial.panel_image_path);
  const [color, setColor] = useState(initial.brand_color);
  const [dirty, setDirty] = useState(false);
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} className="space-y-5">
      <input type="hidden" name="login_image_path" value={login} />
      <input type="hidden" name="panel_image_path" value={panel} />
      <input type="hidden" name="brand_color" value={color} />

      <Section title="Cor principal" hint="Botões, links e destaques em todo o site.">
        <fieldset>
          <legend className="field-label">Cor do site</legend>
          <ColorPicker value={color || ROUTA_COLOR} onChange={change(setColor)} />
        </fieldset>
        <ColorPreview color={color || ROUTA_COLOR} />
        <p className="text-xs text-muted">
          A gente ajusta o tom para ficar legível no claro e no escuro. As cores de situação
          (verde = pago, vermelho = vencido) e as dos gráficos não mudam.
        </p>
        {color && color !== ROUTA_COLOR && (
          <button
            type="button"
            onClick={() => change(setColor)("")}
            className="text-sm font-medium text-accent hover:underline"
          >
            Voltar ao laranja Routa
          </button>
        )}
      </Section>

      <Section title="Tela de login" hint="A foto que recebe quem entra em /entrar.">
        <HeroImageField kind="login" folder="site" path={login} onChange={change(setLogin)} />
      </Section>

      <Section
        title="Painel"
        hint="A capa da visão geral do admin e dos organizadores que não escolheram uma foto na Página do clube."
      >
        <HeroImageField kind="panel" folder="site" path={panel} onChange={change(setPanel)} />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <SubmitButton pendingText="Salvando…" className="btn-primary w-auto">
          Salvar aparência
        </SubmitButton>
        {dirty ? (
          <p className="text-sm text-warn">Mudanças ainda não salvas.</p>
        ) : state.saved ? (
          <p className="text-sm text-success" role="status">
            Salvo. O site já está com o visual novo.
          </p>
        ) : null}
        {state.error && (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="space-y-1">
        <h2 className="section-title">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Botão, link e etiqueta com a cor escolhida, lado a lado no modo claro e no escuro. */
function ColorPreview({ color }: { color: string }) {
  const vars = (siteThemeStyle(color) ?? {}) as Record<string, string>;
  const modes = [
    {
      label: "Modo claro",
      page: "#fafaf9",
      ink: "#1c1917",
      brand: vars["--club-brand-light"],
      on: vars["--club-on-brand-light"],
      accent: vars["--club-accent-light"],
      soft: vars["--club-soft-light"],
    },
    {
      label: "Modo escuro",
      page: "#0b1120",
      ink: "#f5f5f4",
      brand: vars["--club-brand-dark-mode"],
      on: vars["--club-on-brand-dark-mode"],
      accent: vars["--club-accent-dark"],
      soft: vars["--club-soft-dark"],
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {modes.map((m) => (
        <div
          key={m.label}
          className="space-y-3 rounded-xl p-4 ring-1 ring-line"
          style={{ background: m.page, color: m.ink }}
        >
          <p className="text-xs opacity-70">{m.label}</p>
          <span
            className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold"
            style={{ background: m.brand, color: m.on }}
          >
            Quero ir
          </span>
          <p className="text-sm">
            Veja o <span style={{ color: m.accent }} className="font-medium underline">roteiro</span>
          </p>
          <span
            className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ background: m.soft }}
          >
            Destaque
          </span>
        </div>
      ))}
      <div
        className="space-y-3 rounded-xl bg-[#0b1120] p-4 text-white ring-1 ring-line"
        // Laranja Routa = os tons originais do globals.css (o site não aplica tema nenhum).
        style={color === ROUTA_COLOR ? undefined : vars}
      >
        <p className="text-xs text-white/70">Sobre a foto (painel e login)</p>
        <p className="text-xs font-medium tracking-[0.14em] text-hero-accent uppercase">
          Próxima saída
        </p>
        <ul className="flex gap-1" aria-hidden>
          {["paid", "paid", "confirmed", "free"].map((s, i) => (
            <li key={i} className="convoy-seat h-6 w-6" data-state={s} />
          ))}
        </ul>
      </div>
    </div>
  );
}
