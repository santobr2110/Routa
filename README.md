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
3. Em **Authentication > URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** adicione `http://localhost:3000/**`
4. Em **Authentication > Emails > Magic Link**, troque o link do template para este (assim o login funciona mesmo quando o link é aberto no app do Gmail ou em outro navegador do celular):

   ```html
   <h2>Seu acesso à Routa</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar na Routa</a></p>
   <p>Se você não pediu este link, é só ignorar este e-mail.</p>
   ```

   Cole o mesmo link no template **Confirm signup**. Dependendo da configuração, é ele que chega no primeiro acesso de um e-mail novo.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com os dados de **Project Settings > API Keys** do Supabase:

| Variável | O que é |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública `sb_publishable_...` (ou a antiga "anon key") |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` no seu computador; o domínio real em produção |

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
src/lib/format.ts      datas, R$, telefone e link do WhatsApp
src/types/database.ts  tipos do banco
```

## Banco de dados

- Toda tabela tem **Row Level Security**. O visitante não lê nenhuma tabela direto.
- A página pública e a inscrição usam as funções `get_public_trip` e `register_for_trip`. Elas nunca expõem a chave Pix nem os dados dos inscritos para quem não deve ver.
- O organizador só vê as próprias viagens e os próprios inscritos.

**Mudou o banco?** Crie um arquivo novo em `supabase/migrations/` (ex.: `0002_algo.sql`), rode no SQL Editor e atualize `src/types/database.ts`. Para gerar os tipos automaticamente:

```bash
npx supabase login
npx supabase gen types typescript --project-id <id-do-projeto> > src/types/database.ts
```
