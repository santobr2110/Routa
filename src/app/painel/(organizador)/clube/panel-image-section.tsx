"use client";

import { useState, useTransition } from "react";
import { HeroImageField } from "@/components/hero-image-field";
import { createClient } from "@/lib/supabase/client";
import { PHOTOS_BUCKET } from "@/lib/trips";
import { savePanelImage } from "./panel-image-actions";

/** "Imagem do seu painel": a foto da capa da visão geral do organizador. Salva na hora. */
export function PanelImageSection({
  organizerId,
  initial,
  coverPath,
  sitePanelPath,
}: {
  organizerId: string;
  initial: string;
  /** Capa da página do clube, para o atalho "Usar a capa do clube". */
  coverPath: string | null;
  /** Imagem padrão escolhida pela administração (aparece quando não há uma própria). */
  sitePanelPath: string | null;
}) {
  const [path, setPath] = useState(initial);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    const previous = path;
    setPath(next);
    setStatus(null);
    startTransition(async () => {
      const result = await savePanelImage(next);
      if (!result.ok) setPath(previous);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  // Copia a capa (em vez de apontar para ela): trocar a capa depois não apaga a foto do painel.
  function applyCover() {
    if (!coverPath) return;
    const copy = `${organizerId}/clube/panel-${crypto.randomUUID()}.jpg`;
    startTransition(async () => {
      const { error } = await createClient().storage.from(PHOTOS_BUCKET).copy(coverPath, copy);
      if (error) {
        setStatus("error");
        return;
      }
      save(copy);
    });
  }

  return (
    <section className="card grid gap-5 p-4 sm:p-5 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="space-y-1">
        <h2 className="section-title">Imagem do seu painel</h2>
        <p className="text-sm text-muted">
          A foto da capa da sua visão geral, atrás da próxima saída e do comboio. Só você vê.
          Vale mesmo com a página do clube desligada.
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <HeroImageField
          kind="panel"
          folder={`${organizerId}/clube`}
          path={path}
          onChange={save}
          fallbackPath={sitePanelPath}
          fallbackLabel="a foto padrão da Routa"
          disabled={pending}
          extraActions={
            coverPath && (
              <button
                type="button"
                onClick={applyCover}
                disabled={pending}
                className="btn-secondary w-auto"
              >
                Usar a capa do clube
              </button>
            )
          }
        />
        <p className="min-h-5 text-sm" role="status">
          {pending ? (
            <span className="text-muted">Salvando…</span>
          ) : status === "saved" ? (
            <span className="text-success">Salvo. Já aparece no seu painel.</span>
          ) : status === "error" ? (
            <span className="text-danger">Não deu para salvar. Tenta de novo.</span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
