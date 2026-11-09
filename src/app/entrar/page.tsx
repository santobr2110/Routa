import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  if (await getUser()) redirect("/painel");

  const { erro } = await searchParams;

  return (
    <AuthShell title="Entrar como organizador">
      {erro === "link" && (
        <p className="rounded-xl border-2 border-danger/40 bg-danger-soft p-4 text-base text-danger" role="alert">
          Esse link expirou ou já foi usado. Tenta de novo por aqui.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
