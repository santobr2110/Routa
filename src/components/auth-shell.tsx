import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/** Moldura das telas de login, cadastro e senha. */
export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Página inicial da Routa">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro && <p className="text-lg text-ink-soft">{intro}</p>}
      </div>
      {children}
    </main>
  );
}
