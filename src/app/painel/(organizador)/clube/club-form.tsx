"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { CLUB_COLOR_PRESETS, clubThemeStyle, isHexColor } from "@/lib/club-colors";
import type { ClubField, ClubState, ClubValues } from "@/lib/club";
import { resizeToJpeg } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import { PHOTOS_BUCKET, photoUrl } from "@/lib/trips";
import { saveClubPage } from "./actions";

const HINTS: Partial<Record<ClubField, string>> = {
  page_slug: "Só letras minúsculas, números e hífen. Dá para mudar depois, mas o link antigo para de funcionar.",
  page_bio: "Quem vocês são, que tipo de rolê fazem, para quem é. Até 800 caracteres.",
  page_instagram: "Só o @, sem o link.",
};

export function ClubForm({
  initial,
  organizerId,
  siteUrl,
}: {
  initial: ClubValues;
  organizerId: string;
  siteUrl: string;
}) {
  const [state, formAction] = useActionState<ClubState, FormData>(saveClubPage, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [slug, setSlug] = useState(values.page_slug);
  const [color, setColor] = useState(values.page_color || CLUB_COLOR_PRESETS[0]!.hex);
  const [logo, setLogo] = useState(values.page_logo_path);
  const [cover, setCover] = useState(values.page_cover_path);
  const [name, setName] = useState(values.page_name);

  const field = (f: ClubField) => ({
    id: f,
    name: f,
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": errors[f] ? `${f}-error` : HINTS[f] ? `${f}-hint` : undefined,
  });
  const message = (f: ClubField) =>
    errors[f] ? (
      <p id={`${f}-error`} className="field-error" role="alert">
        {errors[f]}
      </p>
    ) : HINTS[f] ? (
      <p id={`${f}-hint`} className="field-hint">
        {HINTS[f]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.saved && (
        <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success" role="status">
          Página salva.{" "}
          {values.page_enabled === "on" && values.page_slug && (
            <Link href={`/c/${values.page_slug}`} target="_blank" className="underline">
              Ver a página
            </Link>
          )}
        </p>
      )}
      {errors.form && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
          {errors.form}
        </p>
      )}

      <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <h2 className="section-title">Página</h2>
        <div className="space-y-5">
          <label className="choice">
            <input
              type="checkbox"
              name="page_enabled"
              defaultChecked={values.page_enabled === "on"}
              className="h-4 w-4 accent-brand"
            />
            Página no ar (qualquer pessoa com o link pode ver)
          </label>
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <label htmlFor="page_name" className="field-label">
                Nome do clube
              </label>
              <input
                {...field("page_name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Ex.: Moto Clube Estrada Real"
                className="field-input"
              />
              {message("page_name")}
            </div>
            <div>
              <label htmlFor="page_slug" className="field-label">
                Endereço da página
              </label>
              <div className="mt-1.5 flex items-center rounded-lg border border-line-strong bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <span className="shrink-0 pl-3 text-sm text-muted">/c/</span>
                <input
                  {...field("page_slug")}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  maxLength={40}
                  autoComplete="off"
                  placeholder="moto-clube-x"
                  className="min-h-11 w-full min-w-0 rounded-lg bg-transparent px-1 py-2 text-base text-ink outline-none sm:min-h-10 sm:text-sm"
                />
              </div>
              {message("page_slug")}
              {slug && <p className="field-hint break-all">{`${siteUrl}/c/${slug}`}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <h2 className="section-title">Sobre o clube</h2>
        <div className="space-y-5">
          <div>
            <label htmlFor="page_bio" className="field-label">
              Descrição
            </label>
            <textarea
              {...field("page_bio")}
              defaultValue={values.page_bio}
              rows={5}
              maxLength={800}
              className="field-input"
            />
            {message("page_bio")}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <label htmlFor="page_city" className="field-label">
                Cidade <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                {...field("page_city")}
                defaultValue={values.page_city}
                maxLength={60}
                placeholder="Ex.: Campinas, SP"
                className="field-input"
              />
              {message("page_city")}
            </div>
            <div>
              <label htmlFor="page_instagram" className="field-label">
                Instagram <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                {...field("page_instagram")}
                defaultValue={values.page_instagram}
                maxLength={60}
                placeholder="motoclubex"
                autoComplete="off"
                className="field-input"
              />
              {message("page_instagram")}
            </div>
          </div>
          <label className="choice">
            <input
              type="checkbox"
              name="page_show_whatsapp"
              defaultChecked={values.page_show_whatsapp === "on"}
              className="h-4 w-4 accent-brand"
            />
            Mostrar o botão &quot;Falar no WhatsApp&quot; (com o número do seu perfil)
          </label>
        </div>
      </section>

      <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="space-y-1">
          <h2 className="section-title">Visual</h2>
          <p className="text-sm text-muted">A cor vale para a página e para as viagens do clube.</p>
        </div>
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <ImageField
              label="Logo"
              hint="Quadrado, de preferência. JPG, PNG ou WebP."
              name="page_logo_path"
              kind="logo"
              path={logo}
              onChange={setLogo}
              organizerId={organizerId}
              error={errors.page_logo_path}
            />
            <ImageField
              label="Capa"
              hint="Foto horizontal do grupo na estrada."
              name="page_cover_path"
              kind="capa"
              path={cover}
              onChange={setCover}
              organizerId={organizerId}
              error={errors.page_cover_path}
            />
          </div>

          <fieldset>
            <legend className="field-label">Cor do clube</legend>
            <input type="hidden" name="page_color" value={color} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {CLUB_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => setColor(preset.hex)}
                  aria-label={preset.label}
                  aria-pressed={color === preset.hex}
                  title={preset.label}
                  className="h-9 w-9 rounded-full border border-line-strong ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm">
                <input
                  type="color"
                  value={isHexColor(color) ? color : "#c2410c"}
                  onChange={(e) => setColor(e.target.value.toLowerCase())}
                  className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
                Outra cor
              </label>
            </div>
            {errors.page_color && (
              <p className="field-error" role="alert">
                {errors.page_color}
              </p>
            )}
          </fieldset>

          <div className="club-theme space-y-2 rounded-xl border border-line p-4" style={clubThemeStyle(color)}>
            <p className="text-xs text-muted">Prévia (ajustamos o tom para ficar legível no claro e no escuro)</p>
            <div className="flex flex-wrap items-center gap-3">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(logo)} alt="" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <span className="font-semibold">{name || "Seu clube"}</span>
              <span className="btn-primary pointer-events-none w-auto">Quero ir</span>
              <span className="text-sm font-medium text-accent">Ver viagem →</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingText="Salvando…">Salvar página</SubmitButton>
      </div>
    </form>
  );
}

function ImageField({
  label,
  hint,
  name,
  kind,
  path,
  onChange,
  organizerId,
  error,
}: {
  label: string;
  hint: string;
  name: string;
  kind: "logo" | "capa";
  path: string;
  onChange: (path: string) => void;
  organizerId: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const blob = await resizeToJpeg(file, kind === "logo" ? 512 : 1920);
      const newPath = `${organizerId}/clube/${kind}-${crypto.randomUUID()}.jpg`;
      const { error: err } = await createClient()
        .storage.from(PHOTOS_BUCKET)
        .upload(newPath, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (err) throw err;
      onChange(newPath);
    } catch {
      setUploadError("Não deu para enviar. Tenta outra imagem (JPG, PNG ou WebP).");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="field-label">{label}</p>
      <input type="hidden" name={name} value={path} />
      <div className="mt-1.5 flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted ${kind === "logo" ? "h-16 w-16" : "h-16 w-28"}`}
        >
          {path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(path)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-faint">sem {kind}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
          >
            {busy ? "Enviando…" : path ? "Trocar" : "Enviar"}
          </button>
          {path && !busy && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex min-h-9 items-center px-2 text-sm text-muted hover:text-danger"
            >
              Remover
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Escolher ${kind}`}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <p className={uploadError || error ? "field-error" : "field-hint"} role={uploadError || error ? "alert" : undefined}>
        {uploadError ?? error ?? hint}
      </p>
    </div>
  );
}
