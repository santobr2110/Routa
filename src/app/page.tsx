import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-4 py-12">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Bora de cara pro vento?
        </h1>
        <p className="text-lg text-ink-soft">
          Crie a página da sua viagem de moto em minutos. A Routa cuida das inscrições, de
          quem já pagou, da lista de espera e do termo de responsabilidade. Você só manda o
          link no grupo.
        </p>
      </div>

      <Link href="/entrar" className="btn-primary">
        Sou organizador · Entrar
      </Link>
    </main>
  );
}
