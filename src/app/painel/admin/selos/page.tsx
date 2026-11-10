import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { CADASTUR_BUCKET, CADASTUR_PUBLIC_SEARCH_URL, daysUntil } from "@/lib/cadastur";
import { formatCnpj, lookupCnpj, type CnpjLookup } from "@/lib/cnpj";
import { formatBrPhone, formatDateBR, formatDateTimeBR, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CadasturStatus } from "@/types/database";
import { reviewCadastur } from "./actions";
import { RejectForm } from "./reject-form";

export const metadata: Metadata = { title: "Admin · Selos Cadastur", robots: { index: false } };

type AdminRequest = {
  id: string;
  organizer_id: string;
  cnpj: string;
  certificate_number: string;
  valid_until: string;
  certificate_path: string;
  status: CadasturStatus;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  organizer_name: string;
  organizer_whatsapp: string;
  organizer_email: string | null;
};

const TABS: Record<CadasturStatus, string> = {
  pending: "Pendentes",
  approved: "Aprovados",
  rejected: "Recusados",
};

const RESULTS: Record<string, { text: string; ok: boolean }> = {
  aprovado: { text: "Selo aprovado. Já aparece nas viagens do organizador.", ok: true },
  recusado: { text: "Pedido recusado. O organizador vê o motivo no perfil.", ok: true },
  "sem-motivo": { text: "Para recusar, escreva o motivo.", ok: false },
  "ja-revisado": { text: "Esse pedido já tinha sido revisado.", ok: false },
  erro: { text: "Não deu para salvar. Tente de novo.", ok: false },
};

export default async function AdminSelosPage({ searchParams }: PageProps<"/painel/admin/selos">) {
  await requireUser();
  const supabase = await createClient();
  // Quem é admin é o banco que diz (tabela private.admins). Para os outros, a página não existe.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) notFound();

  const { status: rawStatus, resultado } = await searchParams;
  const status: CadasturStatus =
    rawStatus === "approved" || rawStatus === "rejected" ? rawStatus : "pending";

  const { data, error } = await supabase.rpc("admin_list_cadastur", { p_status: status });
  if (error) throw error;
  const requests = (data ?? []) as AdminRequest[];

  // Pendentes: confere o CNPJ na Receita agora e gera um link temporário para o certificado.
  const details = await Promise.all(
    requests.map(async (r) => {
      if (r.status !== "pending") return { lookup: null, fileUrl: null };
      const [lookup, file] = await Promise.all([
        lookupCnpj(r.cnpj),
        supabase.storage.from(CADASTUR_BUCKET).createSignedUrl(r.certificate_path, 600),
      ]);
      return { lookup, fileUrl: file.data?.signedUrl ?? null };
    }),
  );

  const message = typeof resultado === "string" ? RESULTS[resultado] : undefined;

  return (
    <div className="space-y-6">
      <Link href="/painel/perfil" className="inline-flex min-h-12 items-center font-semibold text-accent">
        ← Perfil
      </Link>
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Selos Cadastur</h1>
        <p className="text-ink-soft">
          Confira cada pedido na consulta pública do Cadastur antes de aprovar. O selo diz que a
          Routa conferiu, não que o governo certificou a Routa.
        </p>
      </div>

      {message && (
        <p
          className={`rounded-xl px-4 py-3 font-medium ${message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar pedidos">
        {Object.entries(TABS).map(([key, label]) => (
          <Link
            key={key}
            href={`/painel/admin/selos?status=${key}`}
            aria-current={key === status ? "page" : undefined}
            className="inline-flex min-h-12 items-center rounded-full border-2 border-line-strong px-4 font-semibold aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
          >
            {label}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line-strong p-6 text-center text-muted">
          Nenhum pedido aqui.
        </p>
      ) : (
        <ul className="space-y-4">
          {requests.map((r, i) => (
            <li key={r.id} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <div className="space-y-1">
                <p className="text-lg font-bold break-words">{r.organizer_name}</p>
                <p className="text-muted break-all">
                  {r.organizer_email ?? "sem e-mail"} ·{" "}
                  <a
                    href={whatsappLink(r.organizer_whatsapp, `Oi, ${r.organizer_name.split(" ")[0]}! Aqui é da Routa, sobre o seu selo Cadastur.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent underline"
                  >
                    {formatBrPhone(r.organizer_whatsapp)}
                  </a>
                </p>
              </div>

              <dl className="space-y-1">
                <Row label="CNPJ">{formatCnpj(r.cnpj)}</Row>
                <Row label="Certificado">{r.certificate_number}</Row>
                <Row label="Válido até">
                  {formatDateBR(r.valid_until)} ({daysUntil(r.valid_until)} dias)
                </Row>
                <Row label="Pedido em">{formatDateTimeBR(r.created_at)}</Row>
                {r.reviewed_at && <Row label="Revisado em">{formatDateTimeBR(r.reviewed_at)}</Row>}
                {r.reject_reason && <Row label="Motivo">{r.reject_reason}</Row>}
              </dl>

              {r.status === "pending" && (
                <>
                  <CnpjCheck lookup={details[i]!.lookup} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {details[i]!.fileUrl ? (
                      <a
                        href={details[i]!.fileUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-line-strong px-4 font-semibold"
                      >
                        Abrir certificado
                      </a>
                    ) : (
                      <p className="text-danger">Arquivo do certificado não encontrado.</p>
                    )}
                    <a
                      href={CADASTUR_PUBLIC_SEARCH_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-line-strong px-4 font-semibold"
                    >
                      Consulta pública do Cadastur
                    </a>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <form action={reviewCadastur.bind(null, r.id, true)}>
                      <SubmitButton pendingText="Aprovando…">Aprovar selo</SubmitButton>
                    </form>
                    <RejectForm action={reviewCadastur.bind(null, r.id, false)} />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
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

/** Resultado da consulta do CNPJ na Receita (BrasilAPI), com alertas para quem revisa. */
function CnpjCheck({ lookup }: { lookup: CnpjLookup | null }) {
  if (!lookup) return null;
  if (lookup.status === "unavailable") {
    return (
      <p className="rounded-xl bg-warn-soft px-4 py-3 text-warn">
        ⚠️ Não deu para consultar a Receita agora. Confira o CNPJ manualmente.
      </p>
    );
  }
  if (lookup.status === "not_found") {
    return (
      <p className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
        ❌ CNPJ não encontrado na Receita Federal.
      </p>
    );
  }
  return (
    <div className="space-y-1 rounded-xl bg-surface-muted px-4 py-3">
      <p className="font-semibold">Receita Federal</p>
      <p>
        {lookup.active ? "✅" : "❌"} Situação: {lookup.situation}
      </p>
      <p className="break-words">
        Razão social: {lookup.legalName}
        {lookup.tradeName && ` (${lookup.tradeName})`}
      </p>
      <p>
        {lookup.tourismActivities.length > 0 ? "✅" : "⚠️"} Atividade de turismo:{" "}
        {lookup.tourismActivities.length > 0
          ? lookup.tourismActivities.join(", ")
          : `não encontrada (atividade principal: ${lookup.mainActivity || "?"})`}
      </p>
    </div>
  );
}
