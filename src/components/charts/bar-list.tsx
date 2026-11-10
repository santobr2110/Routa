// Lista de barras horizontais (uma série, uma cor): rótulo, valor e % do total.
// Serve para quebras por categoria e rankings. Sem JavaScript: os números estão escritos.

export type BarItem = { key: string; label?: string; value: number };

export function BarList({
  title,
  description,
  items,
  empty = "Sem dados no período.",
  format = (v: number) => new Intl.NumberFormat("pt-BR").format(v),
  showShare = true,
}: {
  title: string;
  description?: string;
  items: BarItem[];
  empty?: string;
  format?: (value: number) => string;
  showShare?: boolean;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <section className="card space-y-3 p-4">
      <div className="space-y-0.5">
        <h3 className="font-medium">{title}</h3>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink-soft">{item.label ?? item.key}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-medium">{format(item.value)}</span>
                  {showShare && (
                    <span className="text-muted"> · {Math.round((item.value / total) * 100)}%</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-muted">
                <div
                  className="h-1.5 rounded-full bg-series-1"
                  style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
