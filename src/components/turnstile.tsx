"use client";

import { useEffect, useRef } from "react";

// "Não sou robô" da Cloudflare (Turnstile). Quase sempre fica invisível ou é um clique só.
// O widget põe no formulário um campo escondido "cf-turnstile-response", conferido no servidor.
// Cada token vale uma vez: troque a prop `resetKey` a cada envio para gerar outro.

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile_script"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({ siteKey, resetKey }: { siteKey: string; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        const dark = document.documentElement.classList.contains("dark");
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: "pt-br",
          theme: dark ? "dark" : "light",
          size: "flexible",
        });
      })
      .catch(() => {
        // Sem o script (bloqueador, rede), o servidor recusa e a pessoa vê o aviso para tentar de novo.
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  return <div ref={ref} className="min-h-16" />;
}
