import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Política de privacidade" };

/** Política simples (LGPD). Revise com alguém de jurídico antes de abrir para o público. */
export default function PrivacidadePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Routa, página inicial">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-12 text-base">
        <h1 className="page-title">Política de privacidade</h1>
        <p className="text-ink-soft">
          A Routa ajuda organizadores a montar viagens de moto em grupo. Aqui está, sem
          juridiquês, o que fazemos com os seus dados.
        </p>

        <Section title="Quem se inscreve numa viagem">
          <p>
            Pedimos só o necessário para a viagem acontecer: nome, WhatsApp, e-mail, a moto
            (marca e modelo; ano e cor se você quiser informar), o nome da garupa (se houver) e
            um contato de emergência (nome e telefone). A placa da moto só é pedida quando o
            organizador precisa dela (por exemplo, para check-in, pousada ou seguro). Também
            guardamos a data em que você aceitou o termo de responsabilidade.
          </p>
          <p>
            <strong>Quem vê:</strong> só o organizador da viagem em que você se inscreveu. Esses
            dados não aparecem na página pública e não são mostrados a outros inscritos.
          </p>
          <p>
            <strong>Para quê:</strong> organizar a viagem (lista de participantes, pagamento e
            lista de espera) e avisar alguém numa emergência.
          </p>
          <p>
            <strong>Proteção contra robôs:</strong> o formulário usa o Cloudflare Turnstile para
            confirmar que é uma pessoa se inscrevendo. Para limitar inscrições em massa, guardamos
            por até 1 dia um código embaralhado (hash) gerado a partir do endereço de internet
            (IP) de quem envia, nunca o IP em si.
          </p>
        </Section>

        <Section title="Quem organiza">
          <p>
            Guardamos o seu e-mail (para o link de acesso), nome e WhatsApp. O seu nome e o
            WhatsApp aparecem para quem garantiu vaga nas suas viagens, para mandarem o
            comprovante do Pix.
          </p>
          <p>
            <strong>Selo Cadastur (opcional):</strong> se você pedir o selo, guardamos o CNPJ, o
            número e a validade do certificado e o arquivo que você enviar. O arquivo só é visto
            pela equipe da Routa que confere o pedido. O CNPJ é consultado na base pública da
            Receita Federal. Na página da viagem aparece só o selo e a validade.
          </p>
        </Section>

        <Section title="O que não fazemos">
          <p>
            Não vendemos nem repassamos seus dados, não mandamos propaganda e não usamos
            rastreadores de anúncio. Pagamentos acontecem por Pix direto com o organizador: a
            Routa não recebe nem guarda dados bancários.
          </p>
          <p>
            Usamos só o necessário para o site funcionar: o cookie de login do organizador e a
            sua escolha de modo claro ou escuro, salva no seu navegador. Para saber quais páginas
            são mais visitadas, usamos o Vercel Web Analytics, que conta visitas sem cookies e sem
            identificar você.
          </p>
        </Section>

        <Section title="Onde ficam e por quanto tempo">
          <p>
            Os dados ficam guardados com segurança no Supabase, nosso provedor de banco de dados,
            enquanto a viagem existir. Quando o organizador apaga a viagem, as inscrições dela
            são apagadas junto. A placa da moto é apagada automaticamente 90 dias depois do fim
            da viagem.
          </p>
        </Section>

        <Section title="Seus direitos (LGPD)">
          <p>
            Você pode pedir para ver, corrigir ou apagar os seus dados. Se você se inscreveu numa
            viagem, o caminho mais rápido é falar com o organizador dela pelo WhatsApp.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}
