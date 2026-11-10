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

6. **Prazo de pagamento (migration `0011`):** nas viagens em que o organizador escolhe "Liberar a vaga sozinho", quem não pagou no prazo vai para o fim da lista de espera e o primeiro da fila sobe. Para isso rodar sozinho a cada 15 minutos (com o pg_cron já ligado no passo acima), rode no SQL Editor:

   ```sql
   select cron.schedule('routa-prazos', '*/15 * * * *', $$select private.process_payment_deadlines()$$);
   ```

7. **Lixeira de viagens (migration `0014`):** viagens excluídas ficam 30 dias na lixeira e depois são apagadas de vez. Para a limpeza rodar sozinha todo dia, rode no SQL Editor:

   ```sql
   select cron.schedule('routa-lixeira', '0 5 * * *', $$select private.purge_deleted_trips()$$);
   ```

8. **Aparência do site (migration `0015`):** cria o Site Settings (cor e fotos do login e do painel) e a foto do painel do organizador. Não precisa de nada além de rodar o arquivo. Antes de aplicar, o site segue com o visual padrão.

9. **Raio-X do comboio (migration `0016`):** rode depois da `0015`. Cria as perguntas do Raio-X nas viagens e as respostas dos inscritos; não precisa de mais nada.


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

### 3.9. Aparência do site (admin) e foto do painel do clube

- **Admin › Aparência** (`/painel/admin/aparencia`): cor principal do site (botões, links e destaques; o tom é ajustado para ficar legível nos dois modos), foto da tela de login e foto do painel. Tudo com prévia antes de salvar; **Salvar aparência** aplica no site inteiro na hora. "Voltar à padrão" e "Voltar ao laranja Routa" desfazem. Cada troca fica no log de auditoria.
- Clubes com página ligada continuam com a cor deles nas páginas do clube e das viagens.
- **Página do clube › Imagem do seu painel:** o organizador escolhe a foto da capa da própria visão geral (ou "Usar a capa do clube"). Salva na hora e vale mesmo com a página do clube desligada. Sem foto própria, usa a do admin; sem a do admin, a foto padrão da Routa.
- **Tamanhos:** login 1920 × 1280 (mínimo 1600 px de largura); painel 1920 × 1080 (mínimo 1600 × 900); capa do clube 1920 × 640; logo 512 × 512. Fotos deitadas. A tela avisa quando a foto é vertical ou pequena, e o navegador reduz tudo para 1920 px antes de enviar.

### 3.10. Raio-X do comboio

- No formulário da viagem (seção **Raio-X do comboio**), o organizador informa o **maior trecho sem posto** e escolhe, para cada pergunta, se ela fica desligada, opcional (padrão) ou obrigatória: autonomia da moto, experiência (estrada e terra) e se sabe mecânica/primeiros socorros/leva kit.
- Cilindrada e estilo vêm do modelo da moto (tabela em `src/lib/bike-specs.ts`); se o modelo não estiver lá, a inscrição pergunta a faixa.
- A aba **Raio-X** de cada viagem mostra os alertas, o perfil do grupo e a ficha de cada confirmado. Quem não respondeu pode responder pelo link pessoal; o modelo **Pedir o Raio-X** na aba Cobrança e avisos manda o pedido pelo WhatsApp.
- Os inscritos veem só um resumo do grupo, sem nomes. Precisa da migration `0016`.

### 3.8. Excluir viagem e lixeira

- **Organizador:** na tela da viagem (aba Editar), no fim, **Excluir viagem**. São 3 confirmações: o aviso com quantos inscritos/pagos/fotos/avisos se perdem (com botão para baixar a planilha antes), digitar `EXCLUIR` e a senha da conta.
- A viagem vai para a **Lixeira** (link na lista de Viagens) e fica 30 dias, com tudo. Dá para restaurar nesse prazo. Enquanto isso, a página sai do ar, as inscrições fecham e o inscrito que abrir o link pessoal vê que a viagem foi excluída.
- **Admin:** na tela da viagem em Admin › Viagens, **Excluir viagem** pede também o motivo. O motivo fica no histórico de moderação e aparece no painel do organizador, que não consegue restaurar. O admin restaura qualquer viagem da lixeira (filtro **Lixeira** na lista).
- Ninguém consegue mais apagar uma viagem direto pela API. Precisa da migration `0014`.

### 3.7. Página do inscrito, mural e e-mail

- Cada inscrição tem um **link pessoal** (`/i/...`), sem login: a pessoa vê a vaga (ou a posição na fila), o pagamento (Pix com QR, cartão, prazo), os avisos do organizador e as informações da viagem. Quem tem o link vê a inscrição; por isso o link não aparece no Google. Precisa da migration `0013`.
- O link chega pela tela de vaga garantida ("Mandar para mim no WhatsApp"), pelas mensagens do organizador (cobrança, véspera, avisos e vaga aberta levam o link de cada um) e por e-mail, se configurado.
- **Mural da viagem:** na aba **Cobrança e avisos**, o organizador publica avisos que aparecem na página de cada inscrito.
- **E-mail automático (opcional):** crie uma conta no [Resend](https://resend.com), verifique um domínio seu (ex.: routa.com.br) e coloque na Vercel (**Settings → Environment Variables**) `RESEND_API_KEY` (a chave do Resend) e `EMAIL_FROM` (ex.: `Routa <inscricoes@routa.com.br>`). Depois, faça um novo deploy. Sem essas variáveis, nada é enviado e o resto funciona normal.

### 3.6. Página do clube

Em **Página do clube** (menu do painel), o organizador monta uma página pública em `/c/nome-do-clube` com logo, capa, descrição, cidade, Instagram, botão de WhatsApp (opcional) e a cor do clube. A página mostra as próximas viagens, as viagens já realizadas e os números (viagens, viajantes, quem voltou). As viagens do clube passam a mostrar "Organizado por {clube}" e usam a cor escolhida (a Routa ajusta o tom para ficar legível no modo claro e no escuro). Precisa da migration `0012`.

### 3.4. Painel do organizador

Todo organizador tem, em `/painel`, um menu com:

- **Visão geral:** escolha o período (7 dias, 30 dias, 90 dias ou 12 meses). Mostra viagens abertas, vagas preenchidas, fila de espera, pagamentos, quanto falta receber, próximas saídas, inscrições e valores no período (comparados com o período anterior), gente nova e quem voltou, antecedência das inscrições, dia da semana, marcas de moto e garupa.
- **Viagens:** todas as viagens, com filtros (próximas, rascunhos, já aconteceram).
- **Participantes:** todo mundo que já se inscreveu nas suas viagens (juntando pelo WhatsApp), com quantas viagens fez, a última e a próxima.
- **Perfil.**

Dentro de cada viagem há as abas **Editar**, **Inscritos** e **Números**.

### 3.5. Pix e cobrança

- Quem garante a vaga vê um **QR Code Pix** e o botão **Copiar Pix copia e cola**, já com o valor exato (no rateio, sem valor). O dinheiro vai direto para a chave do organizador; a Routa só monta o código (padrão do Banco Central) e não cobra taxa.
- No formulário da viagem, a chave Pix mostra como foi entendida (CPF, CNPJ, celular, e-mail ou aleatória). Para celular que também parece CPF, escreva com **+55**.
- **Cartão de crédito (opcional, migration `0010`):** a Routa não processa cartão. Em **Pagamento**, marque "Aceitar cartão de crédito" e cole o link de pagamento criado na sua conta (Mercado Pago, InfinitePay, PagBank…): um para piloto e, se aceita garupa, outro para a dupla. Pode colocar um valor maior no cartão para repassar a taxa. O link só aparece para quem garantiu a vaga.
- **Prazo para pagar (opcional, migration `0011`):** em **Pagamento**, escolha um prazo (24h, 48h, 3 dias ou 5 dias, nunca depois da véspera da saída) e o que acontece quando vence: **só avisar** (você libera a vaga com um clique na aba Inscritos) ou **liberar sozinho**. Liberar = quem não pagou vai para o fim da lista de espera e o primeiro da fila sobe. Sem ninguém na fila, a vaga continua com a pessoa.
- Em cada viagem, a aba **Cobrança e avisos** monta as mensagens de WhatsApp: cobrar quem não pagou (com o Pix de cada um), lembrete da véspera e aviso ao grupo, uma pessoa por clique. Quando o Pix cair, marque como pago na aba **Inscritos**.

### 3.3. Área de administração

Quem está em `private.admins` vê o link **Admin** no menu e acessa `/painel/admin`:

- **Visão geral:** escolha o período (7 dias, 30 dias, 90 dias ou 12 meses). Mostra os números do período comparados com o período anterior, a foto de agora (usuários, ativos, viagens abertas, ocupação, taxa de pagamento, selos), gráficos de atividade, valor, crescimento e cancelamentos (passe o mouse para ver cada ponto; "Ver em tabela" mostra os números), o funil (conta → perfil → viagem → publicada → inscrição), detalhamentos (terreno, nível, marcas de moto, destinos, antecedência da inscrição, dia da semana, garupa, pagamento, ocupação), os organizadores e as viagens com mais inscrições e quem parou no caminho (com WhatsApp). Precisa da migration `0009`.
- **Usuários:** busca por nome, e-mail ou WhatsApp; detalhe com viagens, selos e histórico; **suspender** (tira as viagens do ar, fecha inscrições, impede criar/editar viagens) e **reativar**.
- **Viagens:** filtros por situação e data; detalhe com números e inscritos (sem dados sensíveis); **tirar do ar** e **pôr de volta**.
- **Selos** (seção 3.2) e **Atividade:** o que aconteceu por último, log de auditoria (toda ação de admin, com quem fez e o motivo) e a lista de admins.

**Adicionar outro admin** (SQL Editor):

```sql
insert into private.admins (user_id)
select id from auth.users where lower(email) = lower('EMAIL-DA-PESSOA@exemplo.com')
on conflict do nothing;
```

**Remover um admin:**

```sql
delete from private.admins
where user_id = (select id from auth.users where lower(email) = lower('EMAIL-DA-PESSOA@exemplo.com'));
```

**Visitas por página:** o site já manda as visitas para o **Vercel Web Analytics** (sem cookies). Para ver, ligue em Vercel > projeto > **Analytics** > **Enable**.

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
