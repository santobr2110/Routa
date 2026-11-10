import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireOrganizer } from "@/lib/auth";
import { formatDateRangeBR, formatDateTimeBR } from "@/lib/format";
import { getDeletedTrips } from "@/lib/reauth";
import { TRASH_DAYS, daysLeft } from "@/lib/trash";
import { restoreTrip } from "../[id]/delete-actions";

export const metadata: Metadata = { title: "Lixeira" };

const RESULTS: Record<string, { text: string; ok: boolean }> = {
  excluida: { text: "Viagem excluída. Ela fica aqui até ser apagada de vez.", ok: true },
  admin: {
    text: "Esta viagem foi excluída pela administração da Routa e só ela pode restaurar.",
    ok: false,
  },
  erro: { text: "Não deu para restaurar. Atualize a página e tente de novo.", ok: false },
};

export default async function LixeiraPage({ searchParams }: PageProps<"/painel/viagens/lixeira">) {
  await requireOrganizer();
  const { excluida, resultado } = await searchParams;
  const trips = await getDeletedTrips();
  const code = excluida ? "excluida" : typeof resultado === "string" ? resultado : "";
  const message = RESULTS[code];

  return (
    <div className="space-y-6">
      <Link
        href="/painel/viagens"
        className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
      >
        ← Viagens
      </Link>
      <div className="space-y-1">
        <h1 className="page-title">Lixeira</h1>
        <p className="text-muted">
          Viagens excluídas ficam aqui por {TRASH_DAYS} dias, com inscritos, fotos e avisos. Depois
          são apagadas de vez.
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

      {trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          A lixeira está vazia.
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => {
            const left = daysLeft(t.purge_at);
            return (
              <li key={t.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold break-words">{t.title}</p>
                    <p className="text-sm text-muted">
                      {t.destination} · {formatDateRangeBR(t.start_date, t.end_date)}
                    </p>
                    <p className="text-sm text-muted">
                      {t.confirmed} confirmado(s) · {t.waitlist} na fila · excluída em{" "}
                      {formatDateTimeBR(t.deleted_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${left <= 3 ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink-soft"}`}
                  >
                    {left === 0
                      ? "Apaga hoje"
                      : `Apaga em ${left} dia${left === 1 ? "" : "s"}`}
                  </span>
                </div>
                {t.deleted_by_admin ? (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                    Excluída pela administração da Routa. Motivo: {t.deleted_reason}. Para pedir a
                    revisão, fale com a Routa.
                  </p>
                ) : (
                  <form action={restoreTrip.bind(null, t.id)}>
                    <SubmitButton pendingText="Restaurando…" className="btn-secondary">
                      Restaurar viagem
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
