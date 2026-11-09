import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { DEFAULT_TERMS, type TripFormValues } from "@/lib/trips";
import { createTrip } from "../actions";
import { TripForm } from "../trip-form";

export const metadata: Metadata = { title: "Nova viagem" };

const EMPTY: TripFormValues = {
  title: "",
  destination: "",
  description: "",
  start_date: "",
  end_date: "",
  meeting_point: "",
  meeting_point_url: "",
  pricing_mode: "fixed",
  price: "",
  level: "intermediate",
  terrain: "asphalt",
  capacity: "10",
  pix_key: "",
  terms_text: DEFAULT_TERMS,
};

export default async function NovaViagemPage() {
  await requireOrganizer();

  return (
    <div className="space-y-6">
      <Link href="/painel" className="inline-flex min-h-12 items-center font-semibold text-brand">
        ← Voltar
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Nova viagem</h1>
        <p className="text-lg text-stone-700">
          Preenche o básico agora. Dá para mudar tudo depois, e as fotos entram no passo
          seguinte.
        </p>
      </div>
      <TripForm action={createTrip} initial={EMPTY} submitLabel="Criar viagem" />
    </div>
  );
}
