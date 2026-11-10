import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  // Link de admin só para quem é admin (o banco confere de novo em cada página de admin).
  const user = await getUser();
  const isAdmin = user ? (await (await createClient()).rpc("is_admin")).data === true : false;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" aria-label="Ir para o painel">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            {isAdmin && (
              <Link
                href="/painel/admin"
                className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-ink-soft hover:bg-surface-muted"
              >
                Admin
              </Link>
            )}
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
