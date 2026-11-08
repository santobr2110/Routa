import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  if (await getUser()) redirect("/painel");

  const { erro } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <Link href="/" aria-label="Página inicial da Routa">
        <Logo />
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Entrar como organizador</h1>
        <p className="text-lg text-stone-700">
          Primeira vez? É o mesmo caminho: digite seu e-mail e a conta é criada na hora.
        </p>
      </div>

      {erro === "link" && (
        <p className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-base text-red-800" role="alert">
          Esse link expirou ou já foi usado. Peça um novo aqui embaixo.
        </p>
      )}

      <LoginForm />
    </main>
  );
}
