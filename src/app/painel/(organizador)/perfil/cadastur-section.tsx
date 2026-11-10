import Link from "next/link";
import { daysUntil, sealState } from "@/lib/cadastur";
import { formatCnpj } from "@/lib/cnpj";
import { formatDateBR, formatDateTimeBR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CadasturForm } from "./cadastur-form";

/** Seção do perfil: pedir, acompanhar e renovar o selo Cadastur. */
export async function CadasturSection({ organizerId }: { organizerId: string }) {
  const supabase = await createClient();
  const [{ data: requests, error }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("cadastur_verifications")
      .select("id, cnpj, valid_until, status, reject_reason, reviewed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("is_admin"),
  ]);
  if (error) throw error;

  const pending = requests.find((r) => r.status === "pending");
  const approved = requests
    .filter((r) => r.status === "approved")
    .sort((a, b) => b.valid_until.localeCompare(a.valid_until))[0];
  const state = approved ? sealState(approved.valid_until) : null;
  const latest = requests[0];
  const rejected = latest?.status === "rejected" ? latest : null;
  // Pode pedir: sem pedido em análise e sem selo, ou com selo vencendo/vencido (renovação).
  const canRequest = !pending && (!approved || state !== "valid");

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="section-title">Selo Cadastur</h2>
        <p className="text-ink-soft">
          É agência de turismo com Cadastur? Envie o certificado e ganhe o selo{" "}
          <strong>&ldquo;Agente de turismo verificado&rdquo;</strong> nas suas viagens.
        </p>
      </div>

      {approved && state !== "expired" && (
        <p
          className={
            state === "expiring"
              ? "rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn"
              : "rounded-xl bg-success-soft px-4 py-3 font-medium text-success"
          }
          role="status"
        >
          ✅ Selo ativo · CNPJ {formatCnpj(approved.cnpj)} · válido até{" "}
          {formatDateBR(approved.valid_until)}.
          {state === "expiring" &&
            ` Vence em ${daysUntil(approved.valid_until)} dia(s): envie o certificado renovado.`}
        </p>
      )}
      {approved && state === "expired" && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 font-medium text-warn" role="status">
          Seu selo venceu em {formatDateBR(approved.valid_until)} e saiu das suas viagens. Envie o
          certificado renovado.
        </p>
      )}
      {pending && (
        <p className="rounded-xl bg-surface-muted px-4 py-3 font-medium" role="status">
          ⏳ Pedido em análise desde {formatDateTimeBR(pending.created_at)}. A gente confere no
          Cadastur e o selo aparece sozinho quando for aprovado.
        </p>
      )}
      {rejected && !pending && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 font-medium text-danger" role="status">
          Seu último pedido não foi aprovado: {rejected.reject_reason}. Corrija e envie de novo.
        </p>
      )}

      {canRequest && <CadasturForm organizerId={organizerId} />}

      {isAdmin && (
        <Link href="/painel/admin/selos" className="inline-flex min-h-11 sm:min-h-9 items-center font-semibold text-accent">
          Admin: revisar pedidos de selo →
        </Link>
      )}
    </section>
  );
}
