import Link from "next/link";
import { formatDateRangeBR } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/trips";
import type { TripStatus } from "@/types/database";

type Tab = "editar" | "inscritos" | "cobranca" | "numeros";

const STATUS_COLORS: Record<TripStatus, string> = {
  draft: "bg-surface-muted text-ink-soft",
  published: "bg-success-soft text-success",
  closed: "bg-warn-soft text-warn",
};

/** Topo das telas de uma viagem: voltar, título, situação e abas Editar · Inscritos · Cobrança e avisos · Números. */
export function TripHeader({
  trip,
  current,
  inscritos,
}: {
  trip: {
    id: string;
    title: string;
    status: TripStatus;
    start_date: string;
    end_date: string;
    destination: string;
  };
  current: Tab;
  inscritos?: number;
}) {
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: "editar", label: "Editar", href: `/painel/viagens/${trip.id}` },
    {
      key: "inscritos",
      label: inscritos === undefined ? "Inscritos" : `Inscritos (${inscritos})`,
      href: `/painel/viagens/${trip.id}/inscritos`,
    },
    { key: "cobranca", label: "Cobrança e avisos", href: `/painel/viagens/${trip.id}/cobranca` },
    { key: "numeros", label: "Números", href: `/painel/viagens/${trip.id}/numeros` },
  ];
  return (
    <div className="space-y-4">
      <Link
        href="/painel/viagens"
        className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
      >
        ← Viagens
      </Link>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title break-words">{trip.title}</h1>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[trip.status]}`}
          >
            {STATUS_LABELS[trip.status]}
          </span>
        </div>
        <p className="text-sm text-muted">
          {trip.destination} · {formatDateRangeBR(trip.start_date, trip.end_date)}
        </p>
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Seções da viagem">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className="-mb-px inline-flex min-h-10 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-ink-soft hover:text-ink aria-[current=page]:border-brand aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
