"use client";

import { THEME_KEY, themeScript } from "@/lib/theme";

/**
 * Script do tema no <head>. No servidor sai como JavaScript (roda antes de pintar a tela);
 * no navegador vira text/plain, para o React não reclamar de <script> (receita da doc do Next:
 * "preventing-flash-before-hydration").
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

/** Botão sol/lua. Os dois ícones ficam no HTML e o CSS mostra o certo (sem erro de hidratação). */
export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // Sem localStorage (aba anônima restrita): vale só para esta página.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar entre modo claro e escuro"
      title="Modo claro / escuro"
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-muted"
    >
      {/* Sol: aparece no modo escuro (toque para clarear). */}
      <svg viewBox="0 0 24 24" className="hidden h-6 w-6 dark:block" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </g>
      </svg>
      {/* Lua: aparece no modo claro. */}
      <svg viewBox="0 0 24 24" className="h-6 w-6 dark:hidden" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
      </svg>
    </button>
  );
}
