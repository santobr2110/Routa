import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getUser } from "@/lib/auth";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage() {
  if (await getUser()) redirect("/painel");
  return (
    <AuthShell
      title="Criar conta de organizador"
      intro="Pra montar suas viagens e acompanhar os inscritos. Quem se inscreve não precisa de conta."
    >
      <SignUpForm />
    </AuthShell>
  );
}
