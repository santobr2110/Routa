import Image from "next/image";
import Link from "next/link";
import estrada from "@/assets/estrada-comboio.jpg";
import { CompassIcon } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";

// Página inicial: um convite para o organizador. Fala com quem junta a galera.

const PAINS = [
  ["Planilha com 40 nomes e 3 versões", "Uma lista viva, com fila de espera que anda sozinha"],
  ["“Quem já pagou?” às 23h no grupo", "Pix com QR e valor certo, e o painel mostra quem falta"],
  ["Desistência na véspera e vaga perdida", "Prazo de pagamento: quem não paga cede a vez pro próximo"],
  ["Termo de responsabilidade no papel", "Termo aceito na inscrição, com data e cópia guardada"],
] as const;

const FEATURES = [
  {
    icon: "pix",
    title: "Pix com valor certo",
    text: "QR Code e copia e cola com o valor exato de cada um. Sem taxa, direto na sua conta.",
  },
  {
    icon: "queue",
    title: "Lista de espera automática",
    text: "Lotou? A fila se forma sozinha. Alguém saiu? O próximo sobe e recebe o aviso.",
  },
  {
    icon: "radar",
    title: "Raio-X do comboio",
    text: "Autonomia, experiência e quem sabe mecânica. Alertas antes de virar problema na estrada.",
  },
  {
    icon: "megaphone",
    title: "Avisos ao grupo",
    text: "Mensagens prontas pro WhatsApp: cobrança, véspera, mudança de roteiro. Um toque cada.",
  },
  {
    icon: "flag",
    title: "Página do seu clube",
    text: "Logo, cor e todas as suas viagens num endereço só. Seu motoclube com cara de marca.",
  },
  {
    icon: "shield",
    title: "Termo e contato de emergência",
    text: "Cada inscrito aceita o termo e deixa um contato. Tudo à mão no dia da saída.",
  },
] as const;

export default async function Home() {
  const loggedIn = !!(await getUser());
  const primary = loggedIn
    ? { href: "/painel", label: "Ir para o meu painel" }
    : { href: "/cadastro", label: "Criar minha primeira viagem" };

  return (
    <main className="flex-1 overflow-x-hidden">
      {/* ===== Capa ===== */}
      <section className="relative isolate flex min-h-[92svh] flex-col overflow-hidden bg-[#0b1120] text-white">
        <Image
          src={estrada}
          alt="Comboio de motos numa estrada de serra à beira-mar, no fim da tarde"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="login-hero-img -z-20 object-cover object-[65%_center]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/55 to-[#0b1120]/25 md:bg-gradient-to-r md:from-[#0b1120]/90 md:via-[#0b1120]/45 md:to-transparent"
        />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Routa">
            <CompassIcon className="h-8 w-8" />
            <span className="text-2xl font-semibold tracking-tight">Routa</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            {!loggedIn && (
              <Link
                href="/entrar"
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
              >
                Entrar
              </Link>
            )}
            <span className="rounded-lg bg-white/90 text-[#0b1120]">
              <ThemeToggle />
            </span>
          </nav>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-5 pt-10 pb-14 sm:px-8 md:justify-center md:pb-24">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/85 uppercase ring-1 ring-white/15 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-hero-accent" aria-hidden />
              Para quem organiza viagens de moto em grupo
            </p>
            <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Bora de cara <span className="text-hero-accent">pro vento?</span>
            </h1>
            <p className="max-w-xl text-lg text-white/85 sm:text-xl">
              Você junta a galera. A Routa cuida das inscrições, do Pix, da fila de espera e do
              termo. Monta a viagem em minutos e manda <strong className="text-white">um link</strong>{" "}
              no grupo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={primary.href}
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-hero-brand px-6 text-lg font-semibold text-hero-on-brand shadow-lg shadow-black/30 transition hover:brightness-110"
              >
                {primary.label}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex min-h-13 items-center justify-center rounded-xl px-5 font-medium text-white/85 ring-1 ring-white/25 backdrop-blur hover:bg-white/10 hover:text-white"
              >
                Como funciona
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/70">
              <li>✓ Comece grátis</li>
              <li>✓ Quem se inscreve não baixa app nem cria conta</li>
              <li>✓ O dinheiro vai direto pra sua conta</li>
            </ul>
          </div>
        </div>

        {/* Cartão de exemplo: o painel "ao vivo" de uma viagem enchendo. */}
        <div
          aria-hidden
          className="home-float absolute right-8 bottom-12 hidden w-72 space-y-3 rounded-2xl bg-[#0b1120]/70 p-4 ring-1 ring-white/15 backdrop-blur-md xl:right-[max(2rem,calc((100vw_-_72rem)/2))] lg:block"
        >
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Exemplo · Serra do Mar</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> ao vivo
            </span>
          </div>
          <p className="font-semibold">12 de 14 motos confirmadas</p>
          <ul className="flex flex-wrap gap-1.5">
            {Array.from({ length: 14 }, (_, i) => (
              <li
                key={i}
                className="convoy-seat"
                style={{ animationDelay: `${300 + i * 60}ms` }}
                data-state={i < 9 ? "paid" : i < 12 ? "confirmed" : "free"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="16.5" r="3.5" />
                  <circle cx="18.5" cy="16.5" r="3.5" />
                  <path d="M5.5 16.5 9 10h5l3 6.5M14 10l-1.5-3H10M15 7h3l1 3" />
                </svg>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85">
            🔔 Ana acabou de garantir a vaga · Pix de R$ 450 recebido
          </p>
        </div>

        <a
          href="#como-funciona"
          aria-label="Rolar para Como funciona"
          className="home-scroll absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white md:block"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </a>
      </section>

      {/* ===== Como funciona: a estrada em 3 paradas ===== */}
      <section id="como-funciona" className="scroll-mt-4 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold tracking-[0.14em] text-accent uppercase">
              Do grupo do WhatsApp à estrada
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Três paradas e o comboio está formado.
            </h2>
          </div>

          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {/* faixa da estrada ligando as paradas */}
            <li aria-hidden className="home-road pointer-events-none absolute top-7 right-[16%] left-[16%] hidden md:block" />
            {[
              ["1", "Crie a viagem", "Destino, datas, ponto de saída, vagas, valor e chave Pix. Fotos e roteiro se quiser. Uns 5 minutos."],
              ["2", "Mande o link no grupo", "Cada um se inscreve pelo celular: moto, garupa, contato de emergência e termo aceito."],
              ["3", "Acelera", "Pagamentos, fila e avisos no seu painel. No dia, você só confere quem chegou e dá a saída."],
            ].map(([n, title, text]) => (
              <li key={n} className="relative space-y-3 md:text-center">
                <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-bold text-on-brand ring-8 ring-page">
                  {n}
                </span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-ink-soft md:mx-auto md:max-w-xs">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== Antes x depois ===== */}
      <section className="bg-surface-muted/60 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold tracking-[0.14em] text-accent uppercase">
              Organizar não precisa doer
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Menos planilha, mais estrada.
            </h2>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {PAINS.map(([before, after]) => (
              <li key={before} className="card grid gap-3 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <p className="text-muted line-through decoration-danger/50">{before}</p>
                <span aria-hidden className="hidden text-xl text-accent sm:block">→</span>
                <p className="font-medium">
                  <span className="sr-only">Com a Routa: </span>
                  {after}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== Recursos ===== */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold tracking-[0.14em] text-accent uppercase">
              Feito pro mundo da moto
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Tudo que o organizador precisa. Nada que atrapalha.
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="card space-y-3 p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-accent">
                  <FeatureIcon name={f.icon} />
                </span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-ink-soft">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== Chamada final ===== */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0b1120] px-6 py-14 text-white sm:px-12 sm:py-20">
          <Image
            src={estrada}
            alt=""
            fill
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="-z-20 object-cover object-[80%_center] opacity-60"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1120] via-[#0b1120]/80 to-[#0b1120]/30" />
          <div className="max-w-xl space-y-5">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              A próxima saída começa com um link.
            </h2>
            <p className="text-lg text-white/80">
              Crie sua conta, monte a viagem e veja as vagas sendo preenchidas.
            </p>
            <Link
              href={primary.href}
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-hero-brand px-6 text-lg font-semibold text-hero-on-brand hover:brightness-110"
            >
              {loggedIn ? primary.label : "Quero organizar minha viagem"}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <CompassIcon className="h-5 w-5" /> Routa · viagens de moto em grupo
          </span>
          <nav className="flex gap-4">
            <Link href="/privacidade" className="hover:text-ink">
              Privacidade
            </Link>
            {!loggedIn && (
              <Link href="/entrar" className="hover:text-ink">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </footer>
    </main>
  );
}

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]["icon"] }) {
  const paths: Record<typeof name, React.ReactNode> = {
    pix: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
      </>
    ),
    queue: <path d="M4 6h16M4 12h10M4 18h6M17 15l3 3-3 3" />,
    radar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <path d="M12 12 18 6" />
      </>
    ),
    megaphone: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12" />,
    flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
    shield: (
      <>
        <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
