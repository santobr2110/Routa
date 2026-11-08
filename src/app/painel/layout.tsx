import Link from "next/link";
import { Logo } from "@/components/logo";
import { signOut } from "./actions";

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" aria-label="Ir para o painel">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/painel/perfil"
              className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-stone-700 hover:bg-stone-100"
            >
              Perfil
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-stone-700 hover:bg-stone-100"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
