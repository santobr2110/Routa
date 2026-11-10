import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRegistrationPage } from "@/lib/registration-page";
import { RegistrationView } from "./view";

// Página pessoal: não aparece no Google e não manda o link (com o token) para outros sites.
export const metadata: Metadata = {
  title: "Minha inscrição",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InscritoPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const page = await getRegistrationPage(token);
  if (!page) notFound();
  return <RegistrationView page={page} />;
}
