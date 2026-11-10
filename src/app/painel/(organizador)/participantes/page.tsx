import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { formatBrPhone, formatDateBR, whatsappLink } from "@/lib/format";
import { loadOrganizerData } from "@/lib/organizer-data";
import { participants, type Participant } from "@/lib/organizer-stats";

export const metadata: Metadata = { title: "Participantes" };

const FILTERS = {
  todos: "Todos",
  fieis: "Foram 2 vezes ou mais",
  proximas: "Inscritos em viagem futura",
  sumidos: "Não voltaram",
} as const;
type Filter = keyof typeof FILTERS;

const MATCH: Record<Filter, (p: Participant) => boolean> = {
  todos: () => true,
  fieis: (p) => p.trips >= 2,
  proximas: (p) => p.upcoming !== null,
  sumidos: (p) => p.past >= 1 && p.upcoming === null,
};

export default async function ParticipantesPage({
  searchParams,
}: PageProps<"/painel/participantes">) {
  const { organizer } = await requireOrganizer();
  const sp = await searchParams;
  const filter: Filter =
    typeof sp.filtro === "string" && sp.filtro in FILTERS ? (sp.filtro as Filter) : "todos";
  const search = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const { trips, regs } = await loadOrganizerData();
  const everyone = participants(trips, regs);
  const digits = search.replace(/\D/g, "");
  const shown = everyone.filter(MATCH[filter]).filter((p) => {
    if (!search) return true;
    return (
      p.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) ||
      (digits.length >= 3 && p.whatsapp.includes(digits))
    );
  });

  const loyal = everyone.filter(MATCH.fieis).length;
  const me = organizer.name.split(" ")[0];
  const message = (p: Participant) =>
    `Oi, ${p.name.split(" ")[0]}! Aqui é ${me}${p.last ? `, da viagem ${p.last.title}` : ""}.`;
  const href = (changes: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(search ? { q: search } : {}),
      ...(filter !== "todos" ? { filtro: filter } : {}),
      ...changes,
    });
    if (params.get("filtro") === "todos") params.delete("filtro");
    const qs = params.toString();
    return `/painel/participantes${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Participantes</h1>
        <p className="text-sm text-muted">
          Todo mundo que já se inscreveu nas suas viagens, juntando pelo WhatsApp.{" "}
          {everyone.length > 0 &&
            `${everyone.length} pessoa(s), ${loyal} já foram com você 2 vezes ou mais.`}
        </p>
      </div>

      <form className="flex max-w-xl gap-2" role="search">
        {filter !== "todos" && <input type="hidden" name="filtro" value={filter} />}
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou WhatsApp
        </label>
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Nome ou WhatsApp"
          className="field-input mt-0 flex-1"
        />
        <button type="submit" className="btn-secondary w-auto shrink-0">
          Buscar
        </button>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar participantes">
        {(Object.entries(FILTERS) as [Filter, string][]).map(([key, label]) => (
          <Link
            key={key}
            href={href({ filtro: key })}
            aria-current={key === filter ? "page" : undefined}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink-soft hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
          >
            {label}
            <span className="text-xs text-muted tabular-nums">
              {everyone.filter(MATCH[key]).length}
            </span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          {everyone.length === 0
            ? "Ninguém se inscreveu nas suas viagens ainda."
            : "Ninguém encontrado com esse filtro."}
        </p>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-muted/50 text-muted">
                  <th className="px-4 py-2 font-medium">Pessoa</th>
                  <th className="px-4 py-2 font-medium">Moto</th>
                  <th className="px-4 py-2 text-right font-medium">Viagens</th>
                  <th className="px-4 py-2 font-medium">Última viagem</th>
                  <th className="px-4 py-2 font-medium">Próxima</th>
                  <th className="px-4 py-2 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.whatsapp} className="border-b border-line last:border-0 hover:bg-surface-muted/50">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{p.name}</span>
                      <a
                        href={whatsappLink(p.whatsapp, message(p))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-accent hover:underline"
                      >
                        {formatBrPhone(p.whatsapp)}
                      </a>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.bike}
                      {p.pillion > 0 && (
                        <span className="block text-xs text-muted">
                          com garupa em {p.pillion} viagem(ns)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="font-medium">{p.trips}</span>
                      {p.waitlist > 0 && (
                        <span className="block text-xs text-muted">+{p.waitlist} na fila</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <TripRef trip={p.last} />
                    </td>
                    <td className="px-4 py-2.5">
                      <TripRef trip={p.upcoming} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {formatDateBR(p.first_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {shown.map((p) => (
              <li key={p.whatsapp} className="card space-y-1.5 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{p.name}</p>
                  <span className="shrink-0 text-xs text-muted">
                    {p.trips} {p.trips === 1 ? "viagem" : "viagens"}
                  </span>
                </div>
                <p className="text-sm text-ink-soft">{p.bike}</p>
                {p.last && (
                  <p className="text-xs text-muted">
                    Última: {p.last.title} ({formatDateBR(p.last.start_date)})
                  </p>
                )}
                {p.upcoming && (
                  <p className="text-xs text-muted">
                    Próxima: {p.upcoming.title} ({formatDateBR(p.upcoming.start_date)})
                  </p>
                )}
                <a
                  href={whatsappLink(p.whatsapp, message(p))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center text-sm font-medium text-accent"
                >
                  WhatsApp {formatBrPhone(p.whatsapp)}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TripRef({ trip }: { trip: Participant["last"] }) {
  if (!trip) return <span className="text-muted">—</span>;
  return (
    <>
      <Link href={`/painel/viagens/${trip.id}`} className="hover:text-accent">
        {trip.title}
      </Link>
      <span className="block text-xs text-muted">{formatDateBR(trip.start_date)}</span>
    </>
  );
}
