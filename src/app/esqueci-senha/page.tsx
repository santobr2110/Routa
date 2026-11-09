import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell
      title="Esqueci minha senha"
      intro="A gente manda um link pro seu e-mail para você criar uma senha nova."
    >
      <ForgotForm />
    </AuthShell>
  );
}
