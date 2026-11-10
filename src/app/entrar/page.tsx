import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import estrada from "@/assets/estrada-comboio.jpg";
import { CompassIcon } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  if (await getUser()) redirect("/painel");

  const { erro } = await searchParams;

  return (
    <main className="grid flex-1 lg:min-h-screen lg:grid-cols-[minmax(0,1.35fr)_minmax(420px,1fr)]">
      {/* A estrada: convite. No celular vira a capa do topo. */}
      <section className="relative isolate flex min-h-[46svh] flex-col justify-between overflow-hidden bg-[#0b1120] p-5 pb-12 text-white sm:p-8 sm:pb-14 lg:min-h-0 lg:p-12">
        <Image
          src={estrada}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="login-hero-img -z-20 object-cover object-[62%_center]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/45 to-[#0b1120]/10 lg:bg-gradient-to-r lg:from-[#0b1120]/85 lg:via-[#0b1120]/35 lg:to-transparent"
        />

        <Link
          href="/"
          aria-label="Página inicial da Routa"
          className="inline-flex w-fit items-center gap-2 text-white"
        >
          <CompassIcon className="h-8 w-8" />
          <span className="text-2xl font-semibold tracking-tight">Routa</span>
        </Link>

        <div className="max-w-xl space-y-4 pt-16 lg:pb-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/85 uppercase ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden />
            Bora de cara pro vento?
          </p>
          <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Toda grande viagem começa com alguém{" "}
            <span className="text-orange-300">chamando o grupo.</span>
          </h1>
          <p className="max-w-md text-base text-white/80 sm:text-lg">
            Esse alguém é você. A gente cuida das inscrições, do Pix e da fila. Você cuida da
            estrada.
          </p>
        </div>
      </section>

      {/* O formulário: discreto, sem roubar a cena. */}
      <section className="relative -mt-6 flex flex-col rounded-t-3xl bg-page px-5 pt-6 pb-10 sm:px-8 lg:mt-0 lg:rounded-none lg:px-14 lg:py-10">
        <div className="absolute top-4 right-4 lg:static lg:flex lg:justify-end">
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-6">
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
              Área do organizador
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">Bom te ver de novo</h2>
            <p className="text-ink-soft">Entra pra ver quem já garantiu a vaga.</p>
          </div>

          {erro === "link" && (
            <p
              className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-base text-danger"
              role="alert"
            >
              Esse link expirou ou já foi usado. Tenta de novo por aqui.
            </p>
          )}
          <LoginForm />
        </div>

        <p className="mx-auto max-w-sm text-center text-xs text-faint">
          Vai participar de uma viagem? Não precisa de conta: é só usar o link que o organizador
          mandou.
        </p>
      </section>
    </main>
  );
}
