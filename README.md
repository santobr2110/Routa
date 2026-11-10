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
4. Em **Authentication > Sign In / Providers > Email**: deixe **Enable email provider** e **Confirm email** ligados. O login é por **e-mail e senha**.
5. **(Opcional no começo; obrigatório em produção.)** Troque os links dos e-mails de **confirmação de cadastro** e de **recuperação de senha**. Se o Supabase não deixar editar (o campo fica travado sem um SMTP próprio), pule agora e faça junto com o SMTP no deploy.
   Abra https://supabase.com/dashboard/project/_/auth/templates (o `_` vira o seu projeto sozinho).
   - Em **Confirm sign up**, troque o corpo por:

     ```html
     <h2>Confirme sua conta na Routa</h2>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/painel/perfil">Confirmar minha conta</a></p>
     <p>Se você não criou uma conta, é só ignorar este e-mail.</p>
     ```

   - Em **Reset password**, troque o corpo por:

     ```html
     <h2>Nova senha na Routa</h2>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha">Criar uma senha nova</a></p>
     <p>Se você não pediu, é só ignorar este e-mail: sua senha continua a mesma.</p>
     ```

   **Por que trocar:** com esses links, funciona mesmo quando o e-mail é aberto em outro navegador (ex.: o app do Gmail no celular).
   **Se pular este passo:** funciona, desde que o link do e-mail seja aberto no **mesmo navegador** em que a pessoa criou a conta ou pediu a senha nova.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com os dados de **Project Settings > API Keys** do Supabase:

| Variável | O que é |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública `sb_publishable_...` (ou a antiga "anon key") |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` no seu computador; o domínio real em produção (usado nos e-mails de confirmação e de senha, nos links compartilhados e na prévia do WhatsApp) |
| `REGISTRATION_SIGNING_SECRET` | Segredo que assina cada inscrição (passo 3.1). **Obrigatório**: sem ele, ninguém consegue se inscrever |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Chave pública do anti-robô Cloudflare Turnstile (passo 3.1) |
| `TURNSTILE_SECRET_KEY` | Chave secreta do Turnstile (passo 3.1) |

Nenhuma chave secreta do Supabase (`service_role` / `sb_secret_...`) é usada no app. A segurança dos dados fica no Row Level Security do banco.

### 3.1. Proteção da inscrição (anti-robô)

A inscrição é aberta (sem login), então ela tem três proteções contra inscrições falsas em massa:

1. **Turnstile** (o "não sou robô" da Cloudflare, quase sempre invisível), conferido no servidor.
2. **Prova assinada:** o banco só aceita a inscrição com uma assinatura (HMAC) que só o servidor da Routa sabe gerar. Chamar `register_for_trip` direto com a chave pública não funciona.
3. **Limite por IP:** no máximo 5 inscrições por IP a cada 10 minutos (o banco guarda só um hash do IP, por 1 dia).

**Configurar (uma vez por ambiente: computador e produção):**

1. Gere o segredo:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Coloque em `REGISTRATION_SIGNING_SECRET` no `.env.local` (e na Vercel, em **Settings > Environment Variables**, para produção).
3. Grave **o mesmo valor** no banco (Supabase > SQL Editor), depois de aplicar a migration `0006`:
   ```sql
   insert into private.app_secrets (name, value)
   values ('registration_signing', 'COLE-AQUI-O-SEGREDO')
   on conflict (name) do update set value = excluded.value;
   ```
   Se os dois valores forem diferentes, toda inscrição falha com "Recarrega a página e tenta de novo" (e o log da Vercel mostra `prova recusada`).
4. **Turnstile:** crie uma conta grátis na Cloudflare > **Turnstile** > **Add widget**, informe o domínio (ex.: `routa-wine.vercel.app`, e depois `routa.com.br`) e copie a *site key* e a *secret key* para `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` na Vercel.
   No computador, use as chaves de teste que sempre passam (estão no `.env.example`) ou deixe vazio para desligar o anti-robô.
5. **Apagar placas antigas (LGPD):** a placa da moto é apagada 90 dias depois da viagem pela função `purge_old_plates`. Para rodar sozinha todo dia, ligue o **pg_cron** (Supabase > **Database > Extensions** > `pg_cron` > Enable) e rode no SQL Editor:
   ```sql
   select cron.schedule('routa-apagar-placas', '0 4 * * *', $$select public.purge_old_plates()$$);
   ```

### 4. Instalar e rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

> **E-mails:** o e-mail padrão do Supabase manda poucos e-mails por hora e **só para os membros da equipe do projeto**. Para testar, crie contas com o seu e-mail. Em produção é preciso um SMTP próprio.

### 3.2. Selo Cadastur (admin)

O organizador que é agência de turismo pede o selo em **Perfil > Selo Cadastur** (CNPJ, número do certificado, validade e o arquivo do certificado). A Routa confere o CNPJ na Receita Federal (BrasilAPI) e o pedido vai para a revisão de um admin em **`/painel/admin/selos`**.

**Configurar (uma vez), depois de aplicar a migration `0007`:** cadastre você como admin no SQL Editor, com o e-mail que você usa para entrar na Routa:

```sql
insert into private.admins (user_id)
select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
on conflict do nothing;
```

Para revisar: abra o certificado, confira na consulta pública do Cadastur (https://cadastur.turismo.gov.br/) se o CNPJ, o número e a validade batem, e clique em **Aprovar selo** ou **Recusar** (com motivo). O selo aparece nas viagens do organizador e some sozinho depois da data de validade.

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
- `register_for_trip` exige a prova assinada pelo servidor (`src/lib/registration-guard.ts`) e limita inscrições por IP. O segredo fica no esquema `private`, que não é exposto pela API.
- **Selo Cadastur:** tabela `cadastur_verifications` (o organizador só cria pedidos pendentes) e bucket privado `cadastur-certificates`. Admins ficam em `private.admins`; revisão pelas funções `admin_list_cadastur` e `admin_review_cadastur`. A página pública recebe o selo válido em `organizer_cadastur` (`get_public_trip`).
- **Ficha da moto:** marca, modelo, ano e cor (`bike_brand`, `bike_model`, `bike_year`, `bike_color`; o campo antigo `bike` guarda "marca modelo"). A placa (`bike_plate`) só é guardada quando a viagem tem `requires_plate` e é apagada 90 dias depois (`purge_old_plates`).
- O organizador só vê as próprias viagens e os próprios inscritos.
- **Fotos:** o navegador reduz a foto (máx. 1600px, JPEG) e sobe direto para o bucket `trip-photos`, em `{organizer_id}/{trip_id}/{uuid}.jpg`. Depois uma server action grava a linha em `trip_photos`. Máximo de 5 por viagem; a posição 0 é a capa.

**Mudou o banco?** Crie um arquivo novo em `supabase/migrations/` (ex.: `0002_algo.sql`), rode no SQL Editor e atualize `src/types/database.ts`. Para gerar os tipos automaticamente:

```bash
npx supabase login
npx supabase gen types typescript --project-id <id-do-projeto> > src/types/database.ts
```
