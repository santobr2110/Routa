/** Símbolo da Routa: bússola com a agulha apontando para a estrada. */
export function CompassIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M16 5.5 20 16h-8z" fill="var(--color-brand)" />
      <path d="M16 26.5 12 16h8z" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <CompassIcon />
      <span className="text-2xl font-extrabold tracking-tight">Routa</span>
    </span>
  );
}
