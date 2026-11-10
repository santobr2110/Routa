"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// Gráfico de linha (ou barras) com várias séries, um eixo só, tooltip com mira ao passar
// o mouse ou o dedo, legenda quando há mais de uma série e tabela para quem precisar.
// Cores: --series-1..3 (globals.css), sempre na mesma ordem. Texto usa as cores de texto.

export type SeriesDef = { key: string; label: string };
export type Point = { start: string; finish?: string; values: Record<string, number> };
type Unit = "count" | "brl";
type Bucket = "day" | "week" | "month";

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
const HEIGHT = 220;
const BASE_PAD = { top: 12, right: 16, bottom: 28, left: 44 };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatValue(value: number, unit: Unit, compact = false): string {
  if (unit === "brl") {
    const reais = value / 100;
    if (compact && reais >= 1000) {
      return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(reais / 1000)} mil`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: compact ? 0 : 2,
    }).format(reais);
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatBucket(point: Point, bucket: Bucket, long = false): string {
  const [y, m, d] = point.start.split("-");
  if (bucket === "month") return `${MONTHS[Number(m) - 1]}/${y!.slice(2)}`;
  const start = `${d}/${m}`;
  if (bucket === "week" && long && point.finish) {
    const [, fm, fd] = point.finish.split("-");
    return `${start} a ${fd}/${fm}`;
  }
  return start;
}

/** Topo "redondo" do eixo e os valores das linhas de grade. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

export function TimeSeries({
  title,
  description,
  points,
  series,
  unit = "count",
  bucket,
  kind = "line",
  cumulative = false,
}: {
  title: string;
  description?: string;
  points: Point[];
  series: SeriesDef[];
  unit?: Unit;
  bucket: Bucket;
  kind?: "line" | "bar";
  /** Valores acumulados: a legenda mostra o último valor em vez da soma. */
  cumulative?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(entry!.contentRect.width, 240)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = series.filter((s) => !hidden.has(s.key));
  const ticks = useMemo(
    () => niceTicks(Math.max(0, ...points.flatMap((p) => visible.map((s) => p.values[s.key] ?? 0)))),
    [points, visible],
  );
  const top = ticks.at(-1)!;
  const PAD = { ...BASE_PAD, left: unit === "brl" ? 64 : BASE_PAD.left };
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const n = points.length;
  const slot = innerW / Math.max(n, 1);
  const x = (i: number) => (kind === "bar" ? PAD.left + slot * i + slot / 2 : PAD.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1)));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const total = (key: string) =>
    cumulative
      ? (points.at(-1)?.values[key] ?? 0)
      : points.reduce((sum, p) => sum + (p.values[key] ?? 0), 0);

  // Rótulos do eixo X: no máximo ~6, sempre o primeiro e o último.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))));

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(x(i) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setHover(best);
  }

  const hovered = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(Math.max(x(hover) - 80, 0), width - 170) : 0;
  const barGap = 2;
  const barW = Math.max(2, (slot - barGap * 2) / Math.max(visible.length, 1) - (visible.length > 1 ? 1 : 0));

  return (
    <figure className="card min-w-0 space-y-3 p-4">
      <figcaption className="space-y-0.5">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </figcaption>

      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
          {series.map((s, i) => {
            const off = hidden.has(s.key);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.key)) next.delete(s.key);
                      else if (next.size < series.length - 1) next.add(s.key);
                      return next;
                    })
                  }
                  aria-pressed={!off}
                  className={`inline-flex min-h-8 items-center gap-2 text-sm ${off ? "text-faint line-through" : "text-ink-soft"}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  {s.label}
                  <span className="text-muted">· {formatValue(total(s.key), unit, true)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={ref} className="relative min-w-0 overflow-hidden">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-labelledby={`${id}-desc`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
        >
          <desc id={`${id}-desc`}>
            {title}: {series.map((s) => `${s.label} ${formatValue(total(s.key), unit)}`).join(", ")} {cumulative ? "ao fim do período" : "no período"}.
          </desc>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                {formatValue(t, unit, true)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2) || i === n - 1 ? (
              <text key={p.start} x={x(i)} y={HEIGHT - 8} textAnchor={kind === "line" && i === n - 1 && n > 1 ? "end" : kind === "line" && i === 0 ? "start" : "middle"} className="fill-muted text-[11px]">
                {formatBucket(p, bucket)}
              </text>
            ) : null,
          )}

          {hover !== null && kind === "line" && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-line-hover" strokeWidth={1} />
          )}
          {hover !== null && kind === "bar" && (
            <rect x={x(hover) - slot / 2} y={PAD.top} width={slot} height={innerH} className="fill-surface-muted" />
          )}

          {visible.map((s) => {
            const color = COLORS[series.indexOf(s)];
            if (kind === "bar") {
              const k = visible.indexOf(s);
              return (
                <g key={s.key}>
                  {points.map((p, i) => {
                    const v = p.values[s.key] ?? 0;
                    const h = Math.max(v > 0 ? 2 : 0, PAD.top + innerH - y(v));
                    const bx = x(i) - (barW * visible.length + (visible.length - 1)) / 2 + k * (barW + 1);
                    return (
                      <rect key={p.start} x={bx} y={PAD.top + innerH - h} width={barW} height={h} rx={Math.min(3, barW / 2)} fill={color} />
                    );
                  })}
                </g>
              );
            }
            const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.values[s.key] ?? 0)}`).join(" ");
            return (
              <g key={s.key}>
                <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && (
                  <circle cx={x(hover)} cy={y(points[hover]!.values[s.key] ?? 0)} r={4} fill={color} className="stroke-surface" strokeWidth={2} />
                )}
              </g>
            );
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="stroke-line-strong" strokeWidth={1} />
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 rounded-lg border border-line bg-surface p-2.5 text-sm shadow-lg"
            style={{ left: tooltipLeft }}
            role="status"
          >
            <p className="mb-1 font-medium">{formatBucket(hovered, bucket, true)}</p>
            {visible.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-2 text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[series.indexOf(s)] }} />
                  {s.label}
                </span>
                <span className="font-medium text-ink">{formatValue(hovered.values[s.key] ?? 0, unit)}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details>
        <summary className="inline-flex min-h-8 cursor-pointer items-center text-sm text-muted hover:text-ink">
          Ver em tabela
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-medium">Período</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1.5 pr-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.start} className="border-b border-line">
                  <td className="py-1.5 pr-3">{formatBucket(p, bucket, true)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 pr-3 text-right tabular-nums">
                      {formatValue(p.values[s.key] ?? 0, unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
