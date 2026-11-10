import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_PAGE_SIZE, requireAdmin, type AdminUserRow } from "@/lib/admin";
import { formatBrPhone, formatDateTimeBR } from "@/lib/format";
import { Badge } from "../stat";

export const metadata: Metadata = {
  title: "Admin · Usuários",
  robots: { index: false },
};

export default async function AdminUsuariosPage({
  searchParams,
}: PageProps<"/painel/admin/usuarios">) {
  const { supabase } = await requireAdmin();
  const { q, p } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 80) : "";
  const page = Math.max(1, Number(typeof p === "string" ? p : 1) || 1);

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search || null,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw error;
  const { total, rows } = data as unknown as {
    total: number;
    rows: AdminUserRow[];
  };
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const pageHref = (n: number) =>
    `/painel/admin/usuarios?${new URLSearchParams({ ...(search ? { q: search } : {}), p: String(n) })}`;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Usuários</h1>

      <form className="flex max-w-xl gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar por nome, e-mail ou WhatsApp
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Nome, e-mail ou WhatsApp"
          className="field-input mt-0 flex-1"
        />
        <button type="submit" className="btn-secondary w-auto shrink-0">
          Buscar
        </button>
      </form>

      <p className="text-sm text-muted">
        {total} usuário(s){search && ` para "${search}"`}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-muted">
          Ninguém encontrado.
        </p>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Usuário</th>
                  <th className="px-4 py-2 font-medium">WhatsApp</th>
                  <th className="px-4 py-2 text-right font-medium">Viagens</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Publicadas
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Inscritos
                  </th>
                  <th className="px-4 py-2 font-medium">Conta de</th>
                  <th className="px-4 py-2 font-medium">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-line last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/painel/admin/usuarios/${u.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {u.name ?? "Perfil não preenchido"}
                        </Link>
                        {u.is_admin && <Badge tone="brand">Admin</Badge>}
                        {u.suspended_at && (
                          <Badge tone="danger">Suspenso</Badge>
                        )}
                        {u.has_seal && <Badge tone="success">Cadastur</Badge>}
                      </div>
                      <span className="block text-xs break-all text-muted">
                        {u.email ?? "sem e-mail"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {u.whatsapp ? formatBrPhone(u.whatsapp) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u.trips}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u.published_trips}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {u.registrations}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {formatDateTimeBR(u.created_at)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {u.last_sign_in_at
                        ? formatDateTimeBR(u.last_sign_in_at)
                        : "nunca"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/painel/admin/usuarios/${u.id}`}
                  className="card block space-y-1.5 p-4 hover:border-line-hover"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium break-words">
                      {u.name ?? "Perfil não preenchido"}
                    </p>
                    {u.is_admin && <Badge tone="brand">Admin</Badge>}
                    {u.suspended_at && <Badge tone="danger">Suspenso</Badge>}
                    {u.has_seal && <Badge tone="success">Cadastur</Badge>}
                  </div>
                  <p className="text-sm break-all text-muted">
                    {u.email ?? "sem e-mail"}
                    {u.whatsapp && ` · ${formatBrPhone(u.whatsapp)}`}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {u.trips} viagem(ns) · {u.published_trips} publicada(s) ·{" "}
                    {u.registrations} inscrito(s)
                  </p>
                  <p className="text-xs text-muted">
                    Conta de {formatDateTimeBR(u.created_at)} · último acesso:{" "}
                    {u.last_sign_in_at
                      ? formatDateTimeBR(u.last_sign_in_at)
                      : "nunca"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {pages > 1 && (
        <nav
          className="flex items-center justify-between gap-2"
          aria-label="Páginas"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link
              href={pageHref(page + 1)}
              className="inline-flex min-h-9 items-center text-sm font-medium text-accent"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
