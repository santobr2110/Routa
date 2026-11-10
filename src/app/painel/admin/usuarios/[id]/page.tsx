import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin, type AdminUserDetail } from "@/lib/admin";
import { formatCnpj } from "@/lib/cnpj";
import { formatBrPhone, formatDateBR, formatDateRangeBR, formatDateTimeBR, whatsappLink } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/trips";
import { AuditList } from "../../audit-list";
import { ReasonForm } from "../../reason-form";
import { ResultMessage } from "../../result-message";
import { Badge } from "../../stat";
import { setSuspended } from "./actions";

export const metadata: Metadata = { title: "Admin · Usuário", robots: { index: false } };

const SEAL_LABELS = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" } as const;

export default async function AdminUsuarioPage({
  params,
  searchParams,
}: PageProps<"/painel/admin/usuarios/[id]">) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  const { resultado } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: id });
  if (error) throw error;
  if (!data) notFound();
  const u = data as unknown as AdminUserDetail;
  const org = u.organizer;

  return (
    <div className="space-y-6">
      <Link href="/painel/admin/usuarios" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Usuários
      </Link>

      <ResultMessage code={resultado} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight break-words">
            {org?.name ?? "Perfil não preenchido"}
          </h1>
          {u.is_admin && <Badge tone="brand">Admin</Badge>}
          {org?.suspended_at && <Badge tone="danger">🚫 Suspenso</Badge>}
        </div>
        <dl className="space-y-1 text-ink-soft">
          <Row label="E-mail">
            <span className="break-all">{u.email ?? "—"}</span>
            {!u.email_confirmed_at && <span className="text-muted"> (não confirmado)</span>}
          </Row>
          {org && (
            <Row label="WhatsApp">
              <a
                href={whatsappLink(org.whatsapp, `Oi, ${org.name.split(" ")[0]}! Aqui é da Routa.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent underline"
              >
                {formatBrPhone(org.whatsapp)}
              </a>
            </Row>
          )}
          <Row label="Conta criada">{formatDateTimeBR(u.created_at)}</Row>
          <Row label="Último acesso">{u.last_sign_in_at ? formatDateTimeBR(u.last_sign_in_at) : "nunca"}</Row>
        </dl>
      </div>

      {org && u.id !== user.id && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-xl font-bold">Moderação</h2>
          {org.suspended_at ? (
            <>
              <p className="text-ink-soft">
                Suspenso em {formatDateTimeBR(org.suspended_at)}. Motivo: {org.suspended_reason}
              </p>
              <form action={setSuspended.bind(null, u.id, false)}>
                <SubmitButton pendingText="Reativando…" className="btn-secondary">
                  Reativar organizador
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <p className="text-ink-soft">
                Suspender tira do ar todas as viagens dele, fecha as inscrições e impede que ele crie
                ou edite viagens. Ele continua conseguindo entrar e ver os inscritos.
              </p>
              <ReasonForm
                action={setSuspended.bind(null, u.id, true)}
                label="Suspender organizador"
                confirmLabel="Confirmar suspensão"
                pendingText="Suspendendo…"
                placeholder="Ex.: denúncias de viagens cobradas e não realizadas."
              />
            </>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Viagens ({u.trips.length})</h2>
        {u.trips.length === 0 ? (
          <p className="text-muted">Nenhuma viagem criada.</p>
        ) : (
          <ul className="space-y-2">
            {u.trips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/painel/admin/viagens/${t.id}`}
                  className="block space-y-1 rounded-xl border border-line bg-surface p-3 hover:border-line-hover"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold break-words">{t.title}</p>
                    <Badge tone={t.status === "published" ? "success" : "muted"}>{STATUS_LABELS[t.status]}</Badge>
                    {t.admin_hidden_at && <Badge tone="danger">🙈 Fora do ar</Badge>}
                  </div>
                  <p className="text-sm text-muted">
                    {t.destination} · {formatDateRangeBR(t.start_date, t.end_date)} · {t.confirmed}/{t.capacity}{" "}
                    confirmados{t.waitlist > 0 && ` · ${t.waitlist} na fila`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {u.seals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Selo Cadastur</h2>
          <ul className="space-y-2">
            {u.seals.map((s) => (
              <li key={s.id} className="rounded-xl bg-surface-muted px-4 py-3">
                <p className="font-semibold">
                  {SEAL_LABELS[s.status]} · CNPJ {formatCnpj(s.cnpj)} · válido até {formatDateBR(s.valid_until)}
                </p>
                {s.reject_reason && <p className="text-ink-soft">Motivo: {s.reject_reason}</p>}
                <p className="text-sm text-muted">Pedido em {formatDateTimeBR(s.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Histórico de moderação</h2>
        <AuditList entries={u.audit} />
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}
