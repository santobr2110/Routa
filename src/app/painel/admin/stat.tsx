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
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold tracking-tight">{value}</dd>
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
