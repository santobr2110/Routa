import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "./actions";

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" aria-label="Ir para o painel">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/painel/perfil"
              className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-ink-soft hover:bg-surface-muted"
            >
              Perfil
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-ink-soft hover:bg-surface-muted"
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
