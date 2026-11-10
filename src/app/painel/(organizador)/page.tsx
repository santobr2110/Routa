import type { Metadata } from "next";
import Link from "next/link";
import { CockpitHero, roadGreeting } from "@/components/cockpit";
import { requireOrganizer } from "@/lib/auth";
import { daysUntil, sealState } from "@/lib/cadastur";
import { loadOrganizerData } from "@/lib/organizer-data";
import { organizerOverview } from "@/lib/organizer-stats";
import { parsePeriod } from "@/lib/periods";
import { daysLeft } from "@/lib/trash";
import { getDeletedTrips } from "@/lib/reauth";
import { createClient } from "@/lib/supabase/server";
import { OrganizerOverview } from "./overview";

export const metadata: Metadata = { title: "Painel" };

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const { organizer } = await requireOrganizer();
  const firstName = organizer.name.split(" ")[0] ?? organizer.name;
  const period = parsePeriod((await searchParams).periodo);

  const supabase = await createClient();
  const [{ trips, regs }, { data: seals }, deleted] = await Promise.all([
    loadOrganizerData(),
    // Aviso do selo Cadastur vencendo ou vencido (sem pedido de renovação em análise).
    supabase
      .from("cadastur_verifications")
      .select("status, valid_until")
      .in("status", ["approved", "pending"]),
    getDeletedTrips(),
  ]);
  // Viagens que a administração excluiu (enquanto estão na lixeira).
  const removedByAdmin = deleted.filter((t) => t.deleted_by_admin);
  const latestSeal = (seals ?? [])
    .filter((v) => v.status === "approved")
    .sort((a, b) => b.valid_until.localeCompare(a.valid_until))[0];
  const renewing = (seals ?? []).some((v) => v.status === "pending");
  const sealWarning =
    latestSeal && !renewing && sealState(latestSeal.valid_until) !== "valid"
      ? daysUntil(latestSeal.valid_until)
      : null;

  const alerts = (
    <>
      {organizer.suspended_at && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
          Sua conta está suspensa pela administração da Routa. Suas viagens estão fora do ar e
          você não pode criar nem editar viagens. Motivo: {organizer.suspended_reason}. Para falar
          com a gente, responda o contato da Routa.
        </p>
      )}
      {removedByAdmin.map((t) => (
        <div
          key={t.id}
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <p className="font-medium">
            A administração da Routa excluiu a viagem “{t.title}”.
          </p>
          <p>
            Motivo: {t.deleted_reason}. Ela está na{" "}
            <Link href="/painel/viagens/lixeira" className="underline">
              lixeira
            </Link>{" "}
            e será apagada de vez em {daysLeft(t.purge_at)} dia(s). Para pedir a revisão, fale com a
            Routa.
          </p>
        </div>
      ))}
      {sealWarning !== null && (
        <Link
          href="/painel/perfil"
          className="block rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn"
        >
          {sealWarning >= 0
            ? `Seu selo Cadastur vence em ${sealWarning} dia(s). Clique aqui para enviar o certificado renovado.`
            : "Seu selo Cadastur venceu e saiu das suas viagens. Clique aqui para renovar."}
        </Link>
      )}
    </>
  );

  if (trips.length === 0) {
    const greet = roadGreeting();
    return (
      <div className="space-y-8">
        <h1 className="sr-only">Painel</h1>
        <CockpitHero firstName={firstName} hello={greet.hello} phrase={greet.phrase} next={null} />
        {alerts}
      </div>
    );
  }

  return (
    <OrganizerOverview
      firstName={firstName}
      data={organizerOverview(trips, regs, period)}
      period={period}
      alerts={alerts}
    />
  );
}
