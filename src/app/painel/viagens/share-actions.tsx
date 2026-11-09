"use client";

import { useState } from "react";

/** Ver a página, mandar no WhatsApp com a mensagem padrão e copiar o link. */
export function ShareActions({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-bold">Chama a galera</h2>
      <p className="break-all text-muted">{url}</p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
      >
        Mandar no WhatsApp
      </a>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={copy} className="btn-secondary" aria-live="polite">
          {copied ? "Link copiado! ✅" : "Copiar link"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Ver página
        </a>
      </div>
    </section>
  );
}
