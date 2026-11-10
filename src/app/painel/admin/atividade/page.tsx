import type { Metadata } from "next";
import Link from "next/link";
import { ACTION_LABELS, requireAdmin, type ActivityEvent, type AuditEntry } from "@/lib/admin";
import { formatDateTimeBR } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Atividade", robots: { index: false } };

const KIND = {
  signup: { icon: "👤", text: "Nova conta" },
  trip_created: { icon: "🗺️", text: "Viagem criada" },
  registration: { icon: "🏍️", text: "Inscrição" },
  seal_requested: { icon: "🛡️", text: "Pedido de selo" },
} as const;

const REG_STATUS: Record<string, string> = {
  confirmed: "confirmada",
  waitlist: "na fila",
  cancelled: "cancelada depois",
};

export default async function AdminAtividadePage() {
  const { supabase } = await requireAdmin();
  const [activity, audit, admins] = await Promise.all([
    supabase.rpc("admin_activity", { p_limit: 60 }),
    supabase.rpc("admin_audit_log", { p_limit: 100 }),
    supabase.rpc("admin_list_admins"),
  ]);
  if (activity.error) throw activity.error;
  if (audit.error) throw audit.error;
  if (admins.error) throw admins.error;

  const events = activity.data as unknown as ActivityEvent[];
  const entries = audit.data as unknown as AuditEntry[];
  const adminList = admins.data as unknown as { id: string; email: string }[];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Atividade</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">O que aconteceu por último</h2>
        {events.length === 0 ? (
          <p className="text-muted">Nada ainda.</p>
        ) : (
          <ol className="space-y-2">
            {events.map((e, i) => {
              const kind = KIND[e.kind];
              const href = e.trip_id
                ? `/painel/admin/viagens/${e.trip_id}`
                : e.user_id
                  ? `/painel/admin/usuarios/${e.user_id}`
                  : null;
              const body = (
                <>
                  <p className="font-semibold break-words">
                    {kind.icon} {kind.text}
                    {e.label && <span className="font-normal"> · {e.label}</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDateTimeBR(e.at)}
                    {e.kind === "trip_created" && e.extra && ` · por ${e.extra}`}
                    {e.kind === "registration" && e.extra && ` · ${REG_STATUS[e.extra] ?? e.extra}`}
                  </p>
                </>
              );
              return (
                <li key={i}>
                  {href ? (
                    <Link href={href} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-hover">
                      {body}
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-line bg-surface px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Log de auditoria</h2>
          <p className="text-muted">Toda ação de admin fica registrada aqui, com quem fez e o motivo.</p>
        </div>
        {entries.length === 0 ? (
          <p className="text-muted">Nenhuma ação de admin até agora.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((a, i) => (
              <li key={a.id ?? i} className="rounded-xl bg-surface-muted px-4 py-3">
                <p className="font-semibold break-words">
                  {ACTION_LABELS[a.action] ?? a.action}
                  {a.target_label && <span className="font-normal"> · {a.target_label}</span>}
                </p>
                {a.details?.reason && <p className="text-ink-soft">Motivo: {a.details.reason}</p>}
                <p className="text-sm text-muted">
                  {formatDateTimeBR(a.created_at)} · {a.admin_email ?? "admin"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Admins</h2>
        <ul className="list-inside list-disc text-ink-soft">
          {adminList.map((a) => (
            <li key={a.id} className="break-all">
              {a.email}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Para adicionar ou remover admins, use o SQL Editor do Supabase (README, seção 3.3).
        </p>
      </section>
    </div>
  );
}
