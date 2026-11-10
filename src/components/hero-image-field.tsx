"use client";

import { useRef, useState } from "react";
import estrada from "@/assets/estrada-comboio.jpg";
import { IMAGE_SPECS, type ImageKind } from "@/lib/image-specs";
import { resizeToJpeg } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import { PHOTOS_BUCKET, photoUrl } from "@/lib/trips";

/**
 * Campo de imagem de capa (login ou painel), comum ao admin e à Página do clube:
 * orientação de tamanho, prévia de como fica com o texto por cima (computador e celular)
 * e aviso quando a foto é vertical ou pequena. A foto é reduzida no navegador (1920 px, JPEG)
 * e enviada direto ao Storage em `{folder}/{kind}-{uuid}.jpg`.
 */
export function HeroImageField({
  kind,
  folder,
  path,
  onChange,
  fallbackPath,
  fallbackLabel = "a foto padrão da Routa",
  extraActions,
  disabled,
}: {
  kind: ImageKind;
  /** Pasta no bucket: "site" (admin) ou "{organizer_id}/clube". */
  folder: string;
  path: string;
  onChange: (path: string) => void;
  /** O que aparece quando está vazio (ex.: a imagem padrão do admin, para o clube). */
  fallbackPath?: string | null;
  fallbackLabel?: string;
  extraActions?: React.ReactNode;
  disabled?: boolean;
}) {
  const spec = IMAGE_SPECS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const preview = path ? photoUrl(path) : fallbackPath ? photoUrl(fallbackPath) : estrada.src;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      const notes: string[] = [];
      if (height > width) {
        notes.push(
          `A foto é vertical (${width} × ${height}). Ela vai ser cortada em cima e embaixo. Prefira uma foto deitada (${spec.ratio}).`,
        );
      }
      if (width < spec.min.w || height < spec.min.h) {
        notes.push(
          `A foto é pequena (${width} × ${height}) e pode ficar borrada em telas grandes. O mínimo é ${spec.min.w} × ${spec.min.h}; o ideal, ${spec.ideal.w} × ${spec.ideal.h}.`,
        );
      }
      setWarnings(notes);

      const blob = await resizeToJpeg(file, 1920, 0.82);
      const newPath = `${folder}/${kind}-${crypto.randomUUID()}.jpg`;
      const { error: err } = await createClient()
        .storage.from(PHOTOS_BUCKET)
        .upload(newPath, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (err) throw err;
      onChange(newPath);
    } catch {
      setError("Não deu para enviar. Tenta outra imagem (JPG, PNG ou WebP).");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-surface-muted/60 p-3 text-sm">
        <p className="font-medium">
          Tamanho ideal: {spec.ideal.w} × {spec.ideal.h} px ({spec.ratio}, foto deitada)
        </p>
        <p className="text-muted">
          Mínimo {spec.min.w} × {spec.min.h} px · JPG, PNG ou WebP · a gente reduz e otimiza
          antes de enviar.
        </p>
        <p className="mt-1 text-muted">{spec.focus}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3" aria-label="Prévia">
        <Frame label="Computador" kind={kind} src={preview} device="desktop" />
        <Frame label="Celular" kind={kind} src={preview} device="phone" />
      </div>
      <p className="text-xs text-muted">
        {path ? "Imagem escolhida." : `Sem imagem própria: usando ${fallbackLabel}.`}
      </p>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
          <li className="text-xs">A imagem foi enviada mesmo assim. Troque se não ficar bom na prévia.</li>
        </ul>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id={`hero-${kind}-${folder}`}
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={busy || disabled}
        />
        <label
          htmlFor={`hero-${kind}-${folder}`}
          className={`btn-secondary w-auto cursor-pointer ${busy || disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "Enviando…" : path ? "Trocar imagem" : "Escolher imagem"}
        </label>
        {path && (
          <button
            type="button"
            onClick={() => {
              setWarnings([]);
              onChange("");
            }}
            disabled={busy || disabled}
            className="btn-secondary w-auto"
          >
            Voltar à padrão
          </button>
        )}
        {extraActions}
      </div>
    </div>
  );
}

/** Miniatura da tela com o degradê e o texto no lugar, para ver o corte antes de salvar. */
function Frame({
  label,
  kind,
  src,
  device,
}: {
  label: string;
  kind: ImageKind;
  src: string;
  device: "desktop" | "phone";
}) {
  const phone = device === "phone";
  // Mesmas proporções e posição de corte das telas de verdade.
  const box =
    kind === "panel"
      ? phone
        ? "aspect-[9/14] w-28"
        : "aspect-[16/7] w-64 sm:w-80"
      : phone
        ? "aspect-[1/1] w-28"
        : "aspect-[10/11] w-48";
  const position = kind === "panel" ? "object-[70%_center]" : "object-[62%_center]";
  const gradient = phone
    ? "bg-gradient-to-t from-[#0b1120] via-[#0b1120]/60 to-transparent"
    : "bg-gradient-to-r from-[#0b1120]/95 via-[#0b1120]/55 to-transparent";
  return (
    <figure className="space-y-1">
      <div className={`relative overflow-hidden rounded-lg bg-[#0b1120] ring-1 ring-line ${box}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className={`absolute inset-0 h-full w-full object-cover ${position}`} />
        <div className={`absolute inset-0 ${gradient}`} aria-hidden />
        <div
          className={`absolute flex flex-col gap-1 ${phone ? "inset-x-2 bottom-2" : "top-3 bottom-3 left-3 w-1/2 justify-end"}`}
          aria-hidden
        >
          <span className="h-1.5 w-1/2 rounded bg-white/60" />
          <span className="h-2.5 w-full rounded bg-white/90" />
          {kind === "panel" && (
            <span className="mt-0.5 flex gap-0.5">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-sm bg-hero-brand" />
              ))}
            </span>
          )}
          <span className="mt-0.5 h-2 w-1/3 rounded bg-white" />
        </div>
        {kind === "panel" && !phone && (
          <span
            className="absolute right-3 bottom-3 text-2xl leading-none font-semibold text-white"
            aria-hidden
          >
            5
          </span>
        )}
      </div>
      <figcaption className="text-xs text-muted">{label}</figcaption>
    </figure>
  );
}
