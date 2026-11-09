import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenhaPage() {
  // Chega aqui pelo link do e-mail (que já faz o login). Sem login, volta para /entrar.
  const user = await requireUser();
  return (
    <AuthShell
      title="Crie sua nova senha"
      intro={
        <>
          Conta: <strong className="break-all">{user.email}</strong>
        </>
      }
    >
      <ResetForm />
    </AuthShell>
  );
}
