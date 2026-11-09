"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTOS_BUCKET, photoUrl } from "@/lib/trips";
import { addPhoto, removePhoto, setCoverPhoto } from "./actions";

type Photo = { id: string; storage_path: string; position: number };

const MAX_SIDE = 1600; // px no lado maior
const JPEG_QUALITY = 0.82;

/** Reduz a foto no navegador (economiza o 4G de quem está na estrada) e converte para JPEG. */
async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob falhou"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}

export function PhotoManager({
  tripId,
  organizerId,
  photos,
}: {
  tripId: string;
  organizerId: string;
  photos: Photo[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = uploading !== null || isPending;
  const remaining = MAX_PHOTOS - photos.length;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const files = Array.from(fileList).slice(0, remaining);
    const skipped = fileList.length - files.length;
    const supabase = createClient();

    for (const [i, file] of files.entries()) {
      setUploading(files.length > 1 ? `Enviando foto ${i + 1} de ${files.length}…` : "Enviando foto…");
      try {
        const blob = await resizeToJpeg(file);
        const path = `${organizerId}/${tripId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (uploadError) throw uploadError;

        const result = await addPhoto(tripId, path);
        if (result.error) {
          await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
          setError(result.error);
          break;
        }
      } catch {
        setError("Não deu para enviar uma das fotos. Tenta com outra (JPG, PNG ou WebP).");
        break;
      }
    }

    if (skipped > 0) {
      setError((e) => e ?? `Só cabem ${MAX_PHOTOS} fotos. ${skipped} ficou(aram) de fora.`);
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-stone-200">
              <div className="relative aspect-[4/3] bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(photo.storage_path)}
                  alt={i === 0 ? "Foto de capa" : `Foto ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-brand px-2 py-0.5 text-sm font-semibold text-white">
                    Capa
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                {i !== 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setCoverPhoto(photo.id))}
                    className="min-h-12 border-t border-stone-200 font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Usar como capa
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Remover esta foto?")) run(() => removePhoto(photo.id));
                  }}
                  className="min-h-12 border-t border-stone-200 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <div>
          <input
            ref={inputRef}
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
          <label
            htmlFor="photos"
            aria-disabled={busy}
            className="btn-secondary cursor-pointer aria-disabled:cursor-wait aria-disabled:opacity-60"
          >
            {uploading ?? (photos.length === 0 ? "📷 Adicionar fotos" : `📷 Adicionar mais (${remaining})`)}
          </label>
        </div>
      ) : (
        <p className="field-hint">Já tem {MAX_PHOTOS} fotos. Remova uma para trocar.</p>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
