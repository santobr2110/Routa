import type { Metadata } from "next";
import { CompassIcon } from "@/components/logo";
import { requireOrganizer } from "@/lib/auth";

export const metadata: Metadata = { title: "Painel" };

export default async function PainelPage() {
  const { organizer } = await requireOrganizer();
  const firstName = organizer.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold tracking-tight">E aí, {firstName}! 🏍️</h1>

      <section className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-stone-300 bg-white px-6 py-12 text-center">
        <CompassIcon className="h-12 w-12 text-stone-400" />
        <h2 className="text-xl font-bold">Nenhuma viagem por aqui ainda</h2>
        <p className="max-w-sm text-stone-600">
          Em breve você cria sua primeira viagem aqui e manda o link pro grupo.
        </p>
      </section>
    </div>
  );
}
