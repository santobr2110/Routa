# Routa

> *Bora de cara pro vento?*

Plataforma web para organizar viagens e passeios de moto em grupo. O contexto do produto e as decisões estão no [CLAUDE.md](CLAUDE.md).

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Auth, Postgres, Storage) · Vercel.

## Rodar localmente

### 1. Pré-requisitos

- Node.js 20 ou mais novo (`node -v`)
- Uma conta grátis no [Supabase](https://supabase.com)

### 2. Criar o projeto no Supabase

1. No Supabase, clique em **New project**. Escolha a região **South America (São Paulo)** e guarde a senha do banco.
2. Quando o projeto estiver pronto, vá em **SQL Editor > New query**, cole o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e clique em **Run**. Deve aparecer "Success. No rows returned".
   Depois faça o mesmo, em ordem, com os outros arquivos da pasta (`0002_...`, `0003_...`).
3. Em **Authentication > URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** adicione `http://localhost:3000/**`
4. **(Opcional no começo; obrigatório em produção.)** Se o Supabase não deixar editar o template (o campo fica travado sem um SMTP próprio configurado), pule este passo agora. Ele será feito junto com o SMTP no deploy.
   Abra a página de templates de e-mail: https://supabase.com/dashboard/project/_/auth/templates (o `_` vira o seu projeto sozinho; se pedir, escolha o projeto).
   Na lista, clique em **Magic link or OTP**, apague o conteúdo do corpo (**Body**) e cole isto:

   ```html
   <h2>Seu acesso à Routa</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar na Routa</a></p>
   <p>Se você não pediu este link, é só ignorar este e-mail.</p>
   ```

   Salve e faça o mesmo no template **Confirm sign up**, que é o que chega no primeiro acesso de um e-mail novo.

   **Por que trocar:** com esse link, o login funciona mesmo quando o e-mail é aberto em outro navegador (ex.: o app do Gmail no celular).
   **Se pular este passo:** o login ainda funciona, desde que você abra o link do e-mail no **mesmo navegador** em que pediu o link.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com os dados de **Project Settings > API Keys** do Supabase:

| Variável | O que é |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública `sb_publishable_...` (ou a antiga "anon key") |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` no seu computador; o domínio real em produção (usado no link mágico, nos links compartilhados e na prévia do WhatsApp) |

Nenhuma chave secreta (`service_role` / `sb_secret_...`) é usada no app. A segurança dos dados fica no Row Level Security do banco.

### 4. Instalar e rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

> **Limite de e-mails:** o e-mail padrão do Supabase manda poucos links por hora. Se o link parar de chegar, espere um pouco. Em produção vamos configurar um SMTP próprio.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (roda também a checagem de tipos) |
| `npm run lint` | ESLint |

## Estrutura

```
supabase/migrations/   SQL do banco (tabelas, RLS, funções, storage)
src/proxy.ts           renova a sessão e protege o /painel
src/app/               páginas (URLs em português: /entrar, /painel, /v/[slug])
src/lib/supabase/      clientes do Supabase (servidor e navegador)
src/lib/auth.ts        quem está logado; exige login/perfil
src/lib/format.ts      datas, R$, telefone, link do WhatsApp e slug
src/lib/trips.ts       rótulos, termo padrão, campos do formulário, URL das fotos e mensagem de compartilhamento
src/lib/public-trip.ts dados públicos da viagem (função get_public_trip)
src/lib/registrations-xlsx.ts  planilha Excel dos inscritos (exceljs)
src/lib/site.ts        endereço do site e link público da viagem
src/app/v/[slug]/      página pública da viagem, inscrição e prévia (og)
src/types/database.ts  tipos do banco
```

## Banco de dados

- Toda tabela tem **Row Level Security**. O visitante não lê nenhuma tabela direto.
- A página pública e a inscrição usam as funções `get_public_trip` e `register_for_trip`. Elas nunca expõem a chave Pix nem os dados dos inscritos para quem não deve ver.
- O organizador só vê as próprias viagens e os próprios inscritos.
- **Fotos:** o navegador reduz a foto (máx. 1600px, JPEG) e sobe direto para o bucket `trip-photos`, em `{organizer_id}/{trip_id}/{uuid}.jpg`. Depois uma server action grava a linha em `trip_photos`. Máximo de 5 por viagem; a posição 0 é a capa.

**Mudou o banco?** Crie um arquivo novo em `supabase/migrations/` (ex.: `0002_algo.sql`), rode no SQL Editor e atualize `src/types/database.ts`. Para gerar os tipos automaticamente:

```bash
npx supabase login
npx supabase gen types typescript --project-id <id-do-projeto> > src/types/database.ts
```
