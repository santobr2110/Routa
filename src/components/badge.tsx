export type BadgeTone = "success" | "warn" | "danger" | "muted" | "brand";

/** Rótulo de situação com cor + texto (nunca só a cor). Comum ao painel e ao admin. */
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const tones = {
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    muted: "bg-surface-muted text-ink-soft",
    brand: "bg-brand-soft text-ink",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
