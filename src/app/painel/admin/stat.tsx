/** Número de destaque com rótulo e detalhe opcional. */
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      {detail && <dd className="mt-1 text-sm text-muted">{detail}</dd>}
    </div>
  );
}

/** Rótulo de situação com cor + texto (nunca só a cor). */
export function Badge({
  tone,
  children,
}: {
  tone: "success" | "warn" | "danger" | "muted" | "brand";
  children: React.ReactNode;
}) {
  const tones = {
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    muted: "bg-surface-muted text-ink-soft",
    brand: "bg-brand-soft text-ink",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
