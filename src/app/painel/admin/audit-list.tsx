import { ACTION_LABELS, type AuditEntry } from "@/lib/admin";
import { formatDateTimeBR } from "@/lib/format";

/** Histórico de ações de admin sobre um organizador ou viagem. */
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-muted">Nenhuma ação de admin até agora.</p>;
  return (
    <ul className="space-y-2">
      {entries.map((a, i) => (
        <li key={a.id ?? i} className="rounded-xl bg-surface-muted px-4 py-3">
          <p className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</p>
          {a.details?.reason && <p className="text-ink-soft">Motivo: {a.details.reason}</p>}
          <p className="text-sm text-muted">
            {formatDateTimeBR(a.created_at)} · {a.admin_email ?? "admin"}
          </p>
        </li>
      ))}
    </ul>
  );
}
