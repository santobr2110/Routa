import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const NAV_LINK =
  "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-surface-muted hover:text-ink sm:min-h-9";

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  // Link de admin só para quem é admin (o banco confere de novo em cada página de admin).
  const user = await getUser();
  const isAdmin = user ? (await (await createClient()).rpc("is_admin")).data === true : false;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/painel" aria-label="Ir para o painel">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            {isAdmin && (
              <>
                <Link href="/painel" className={NAV_LINK}>
                  Meu painel
                </Link>
                <Link href="/painel/admin" className={NAV_LINK}>
                  Admin
                </Link>
              </>
            )}
            <form action={signOut}>
              <button type="submit" className={NAV_LINK}>
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
