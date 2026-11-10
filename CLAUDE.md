# Routa — contexto do projeto

> **Routa** · *Bora de cara pro vento?*
> Plataforma web para organizar viagens e passeios de moto em grupo no Brasil.

Este arquivo é lido pelo Claude Code em toda sessão. Mantenha-o atualizado quando decisões mudarem.

---

## 1. O produto

**Problema:** quem organiza viagens e rolês de moto em grupo (motoclubes, grupos de dono de modelo, organizadores independentes, concessionárias) faz tudo no WhatsApp e em planilhas: lista de inscritos, quem pagou, desistências, termo de responsabilidade. Dá trabalho, gera calote e confusão.

**Solução:** o organizador cria a página da viagem em minutos e a Routa cuida de inscrição, controle de pagamento, lista de participantes, lista de espera e termo de responsabilidade. O link é compartilhado no WhatsApp com uma prévia bonita.

**Para quem:** serve para todas as tribos do motociclismo, do custom/harleiro ao adventure/off-road, do estradeiro ao esportivo. O texto e o visual **não podem** favorecer uma tribo específica.

**Dois modos (o v0 implementa só o Rateio):**
- **Rateio:** viagem entre amigos ou membros, sem fins lucrativos. O organizador divide os custos.
- **Expedição** (futuro): organizador profissional vendendo viagens, com selo de verificação no Cadastur (API pública gov.br Conecta).

## 2. Personas

- **Organizador:** cria viagens, acompanha inscritos e pagamentos. Usa o celular na maior parte do tempo. Não é técnico.
- **Participante:** recebe o link no WhatsApp, se inscreve **sem criar conta**, em menos de 2 minutos, pelo celular.

## 3. Escopo do v0 (fazer só isto)

1. **Login do organizador** com e-mail e senha (cadastro, confirmação por e-mail, "esqueci minha senha"), via Supabase Auth. Verificação em duas etapas com app autenticador, **opcional**.
2. **Criar e editar viagem:** título, descrição/roteiro, data de início e fim, local e horário de saída e de retorno (texto + horário + link do Maps; retorno opcional), fotos (até 5), número de vagas, valor piloto e valor piloto + garupa (ou "a definir/rateio"), nível exigido (iniciante / intermediário / estradeiro experiente), terreno predominante (asfalto / misto / off-road) + %, chave Pix do organizador, termo de responsabilidade (texto padrão editável).
3. **Página pública da viagem** (`/v/[slug]`): bonita, mobile-first, rápida, com **Open Graph** caprichado (título, data, imagem) para a prévia no WhatsApp. Mostra as vagas restantes e o botão "Quero ir".
4. **Inscrição sem login:** nome, WhatsApp, e-mail, ficha da moto (marca, modelo, ano e cor opcionais; placa só se o organizador pedir), se leva garupa (e o nome da garupa), contato de emergência (nome + telefone) e aceite obrigatório do termo. Depois de enviar: tela com a chave Pix, o valor e a instrução para mandar o comprovante ao organizador.
5. **Painel do organizador:** lista de inscritos, status de pagamento (pendente/pago, **marcado manualmente**), vagas restantes, lista de espera automática quando lotar, botão de WhatsApp para falar com cada inscrito, exportação em CSV.
6. **Cancelamento:** o organizador pode remover um inscrito; a primeira pessoa da lista de espera é promovida.

## 4. Fora do escopo agora (não implementar)

- Gateway de pagamento, split, taxas de conveniência, assinatura Pro.
- Verificação no Cadastur e o modo Expedição.
- Vitrine pública de viagens, busca, perfil social, avaliações, ranking.
- App nativo (o web mobile-first resolve).
- Chat interno (o WhatsApp já resolve).

Se uma tarefa parecer exigir algo desta lista, **pergunte antes**.

## 5. Stack e convenções

- **Next.js** (App Router) + **TypeScript** estrito.
- **Tailwind CSS** e componentes simples (shadcn/ui permitido).
- **Supabase:** Auth (e-mail e senha), Postgres, Storage (fotos), **Row Level Security em todas as tabelas**.
- **Deploy:** Vercel.
- **Idioma:** toda a interface em **português do Brasil**, num tom próximo e direto ("Bora?", "Garanta sua vaga"). O código e os nomes de variáveis ficam em inglês.
- **Formatos brasileiros:** datas `dd/mm/aaaa`, moeda `R$ 1.234,56`, telefone com DDD e link `wa.me` para o WhatsApp.
- **Mobile-first sempre.** Teste em uma largura de 375px.
- **Acessibilidade básica:** contraste, labels nos campos, botões grandes (uso com luva, sob sol forte).
- Dados pessoais (WhatsApp, contato de emergência) só são visíveis ao organizador da viagem. Siga a **LGPD**: coletar só o necessário e ter uma política de privacidade simples.

## 6. Modelo de dados (definido em `supabase/migrations/0001_init.sql`)

- `organizers`: id (= auth.uid), name, whatsapp, created_at
- `trips`: id, organizer_id, slug (único), title, **destination**, description, start_date, end_date, departure_point, departure_point_url, departure_time, return_point, return_point_url, return_time (retorno nulo = mesmo local da saída), price_cents (nullable, valor piloto), pricing_mode ('fixed' | 'split'), accepts_pillion, pillion_price_cents (valor fechado piloto + garupa; só com valor fixo e garupa aceita), level ('beginner' | 'intermediate' | 'experienced'), terrain ('asphalt' | 'mixed' | 'offroad', o predominante), terrain_percent (1–100), capacity, pix_key, terms_text, status ('draft' | 'published' | 'closed'), created_at, updated_at
- `trip_photos`: id, trip_id, storage_path, position (0–4, máx. 5 fotos)
- `registrations`: id, trip_id, name, whatsapp, email, bike (texto "marca modelo"), bike_brand, bike_model, bike_year, bike_color, bike_plate (só se a viagem pede; formato `ABC1D23`/`ABC1234` sem hífen), has_pillion, pillion_name, emergency_name, emergency_phone, terms_accepted_at, terms_text_accepted (cópia do termo no momento do aceite), payment_status ('pending' | 'paid'), status ('confirmed' | 'waitlist' | 'cancelled'), cancelled_at, created_at
- `trips.requires_plate` (boolean): a inscrição pede a placa.
- Esquema `private` (não exposto pela API): `app_secrets` (segredo da assinatura), `registration_attempts` (hash do IP + data, para o limite) e `admins` (quem revisa os selos).
- `organizers.suspended_at`/`suspended_reason` e `trips.admin_hidden_at`/`admin_hidden_reason`: moderação (só admin altera). `private.admin_audit`: log das ações de admin.
- `cadastur_verifications`: id, organizer_id, cnpj (14 dígitos), certificate_number, valid_until, certificate_path (bucket privado `cadastur-certificates`), status ('pending' | 'approved' | 'rejected'), reject_reason, reviewed_at, created_at. Um pendente por organizador.
- Telefones guardados só com dígitos e o 55 na frente (`5511999998888`).

**Decisões tomadas (sessão 1):**
- **1 vaga = 1 moto** (piloto + garupa ocupam uma vaga). **Valores fechados (sessão 2):** "valor piloto" e "valor piloto + garupa" (total da dupla). Com valor fixo, garupa vazia = a viagem não aceita garupa; no rateio, uma caixinha "Aceita garupa". A inscrição recusa garupa quando a viagem não aceita.
- A ordem da lista de espera é `created_at` (não existe `waitlist_position`).
- Quem cai na lista de espera **não** vê a chave Pix. Quando for promovido, o organizador avisa pelo WhatsApp (o v0 não manda notificação).
- Valor "a definir/rateio": a tela final mostra a chave Pix e "o organizador vai te passar o valor".
- Um WhatsApp só pode ter uma inscrição ativa por viagem.
- O WhatsApp do organizador aparece para o inscrito confirmado (para mandar o comprovante).
- **Segurança:** o visitante (anon) não lê nenhuma tabela. A página pública e a inscrição usam as funções `get_public_trip` e `register_for_trip` (security definer). Cancelar é `cancel_registration`, que promove a fila. Na tabela de inscritos, o organizador só pode alterar `payment_status`. A capacidade não pode ficar abaixo dos confirmados, e aumentar a capacidade promove a fila.
- Storage: bucket público `trip-photos`, caminho `{organizer_id}/{trip_id}/arquivo`.
- **Editar viagem publicada (sessão 2):** pode editar em qualquer status. Com inscritos, a edição mostra um aviso para avisar o grupo se mudar valor, datas, saída, garupa ou termo. Cada inscrição guarda a cópia do termo aceito (`0005`).
- **Dependência `exceljs` (sessão 2):** única forma simples de gerar `.xlsx` com formatação (a versão gratuita do SheetJS não formata). Roda só no servidor. O `npm audit` aponta um aviso moderado no `uuid` dela (v3/v5/v6 com buffer), que não é usado aqui.
- **Inscrição (sessão 2):** a tela final (Pix ou lista de espera) não tem URL própria: vem do retorno da action. Se a pessoa fechar, perde a tela, mas não a inscrição. As inscrições fecham no dia da saída (`registration_open` em `get_public_trip`; `register_for_trip` recusa).
- **Open Graph (sessão 2):** `ImageResponse` só gera PNG, e PNG com foto fica pesado demais para o WhatsApp. Por isso a capa (JPEG) é a imagem da prévia, e o cartão gerado só entra quando não há foto.
- **Viagem (sessão 2):** o slug é gerado na criação (`{destino}-{6 hex}`) e **não muda** na edição, para não quebrar links já compartilhados. A viagem nasce como rascunho. Fotos só entram depois de criar a viagem (o caminho precisa do `trip_id`). Trocar a capa = trocar a posição com a foto 0.
- **Modo escuro (sessão 2):** padrão escuro, paleta **azul-noite** (fundo `#0b1120`, cartões `#111a2e`), botão sol/lua no topo, escolha salva no `localStorage` (`routa-theme`). Use as **cores com nome** do `globals.css` (`bg-surface`, `text-muted`, `border-line`, `text-accent`, `text-danger`…), nunca `stone-*`, `white` ou `red-*` direto. `bg-brand` (botões) é igual nos dois modos; `text-accent` é o laranja para texto e links.
- **Next.js 16:** `cacheComponents` está desligado de propósito (modelo clássico, mais simples). O antigo `middleware.ts` agora se chama `src/proxy.ts`. Antes de usar uma API do Next, consulte `node_modules/next/dist/docs/`.
- **Login (sessão 2):** e-mail e senha, sem link mágico. App autenticador (TOTP) opcional no perfil. Os e-mails de confirmação e de nova senha usam o template `token_hash` (README, passo 5), para funcionar quando o link abre em outro navegador do celular. Use um endereço só (`NEXT_PUBLIC_SITE_URL` = Site URL do Supabase): o login guarda dados por endereço.
- **Proteção da inscrição (sessão 3):** `register_for_trip` exige `p_proof` = HMAC-SHA256 de `slug|whatsapp|ip_hash|issued_at` com o segredo `REGISTRATION_SIGNING_SECRET` (o mesmo valor fica em `private.app_secrets`); vale 5 minutos. Só a server action gera a prova, depois de conferir o Cloudflare Turnstile (`src/lib/registration-guard.ts`). Limite de 5 inscrições por hash de IP a cada 10 min. A versão antiga da função (10 argumentos) foi apagada na `0006`. Sem `TURNSTILE_SECRET_KEY`, o Turnstile é pulado (só para desenvolvimento). O token do Turnstile vale uma vez: o formulário recria o widget a cada envio (`attempt`).
- **Ficha da moto (sessão 3):** marcas e modelos em `src/lib/bikes.ts` são só sugestões (datalist); a pessoa pode digitar qualquer coisa. A marca é gravada com a grafia da lista (`canonicalBrand`). Ano opcional (1950 até o ano que vem). A placa só é aceita quando a viagem pede; o banco descarta se não pediu. LGPD: `purge_old_plates()` apaga placas 90 dias após o fim da viagem, agendada com pg_cron (README 3.1).
- **Selo Cadastur (sessão 4):** a API oficial do Cadastur (gov.br Conecta/Serpro) é só para órgãos públicos e os dados abertos estão desatualizados, então o selo é semiautomático: checagem automática do CNPJ (`src/lib/cnpj.ts`: tenta BrasilAPI, depois Minha Receita, depois CNPJ.ws, porque esses serviços às vezes falham ou limitam pedidos da Vercel; o motivo da falha vai para o log com o prefixo `cnpj:`) + revisão humana. Quem é admin é a tabela `private.admins` (função `is_admin()`); a página `/painel/admin/selos` dá 404 para os outros. O organizador só cria pedidos pendentes (RLS) e nunca altera; o admin revisa pela função `admin_review_cadastur`. A checagem da Receita é refeita na tela do admin (não confiamos no que veio do navegador). O selo vale enquanto `valid_until >= hoje` (calculado na leitura, sem cron) e diz "verificado pela Routa", nunca que o governo certificou. Só pessoa jurídica por enquanto (guia pessoa física fica para depois). A próxima migration é a `0008` (o item de TOTP abaixo citava `0006`, número já usado).
- **Área de administração (sessão 5):** tudo em `/painel/admin` (layout com `requireAdmin()` em `src/lib/admin.ts`: dá 404 para quem não está em `private.admins`). Os dados vêm só de funções `admin_*` (security definer) que conferem `is_admin()` de novo; o app nunca usa chave secreta. Moderação: `organizers.suspended_at` (suspender) e `trips.admin_hidden_at` (tirar do ar), sempre com motivo; o gatilho `private.protect_moderation_columns` impede o organizador de mexer nessas colunas pela API (compara `current_user`), bloqueia criar/editar viagem de suspenso (`organizer_suspended`) e o perfil suspenso não pode ser apagado. `get_public_trip` e `register_for_trip` ignoram viagem fora do ar e organizador suspenso. Toda ação de admin vai para `private.admin_audit` (via `private.log_admin`). O admin vê só o necessário dos inscritos (nome, moto, situação, pagamento), nunca emergência, placa ou contato. Visitas por página: Vercel Web Analytics (`@vercel/analytics`, sem cookies), ligado no painel da Vercel.
- **Visual e analytics do admin (sessão 6):** visual mais enxuto e pensado para computador e celular: botões menores no desktop (`min-h-11` no celular, `sm:min-h-10`), peso `semibold` no lugar de `extrabold`, bordas de 1px; classes base em `globals.css` (`.btn-primary`, `.btn-secondary`, `.field-input`, `.card`, `.page-title`, `.section-title`, `.choice`). Páginas usam a largura da tela (`max-w-6xl`); página pública em duas colunas no desktop (conteúdo + resumo fixo com o botão "Quero ir"); formulário de viagem em seções título à esquerda/campos à direita. Gráficos: `src/components/charts/time-series.tsx` (linha/barra, um eixo só, legenda clicável, tooltip, "Ver em tabela") e `bar-list.tsx`; cores das séries em `--series-1..3` (paleta validada para daltonismo; nunca usar as cores de status). Admin com menu lateral no desktop, tabelas no desktop e cartões no celular. Os números do período vêm de `admin_analytics(p_days, p_bucket)` (migration `0009`, horário de Brasília, compara com o período anterior). A próxima migration é a `0010`, e o item de TOTP abaixo passa a usar esse número.
- **Painel do organizador (sessão 7):** as páginas do organizador ficam no grupo de rotas `src/app/painel/(organizador)/` (o nome entre parênteses não aparece na URL), com menu lateral próprio: Visão geral (`/painel`), Viagens (`/painel/viagens`), Participantes (`/painel/participantes`) e Perfil. Cada viagem tem abas Editar · Inscritos · Números (`trip-header.tsx`). Os números são calculados no app (`src/lib/organizer-stats.ts`, funções puras) a partir das viagens e inscrições que o RLS já entrega ao organizador (`src/lib/organizer-data.ts` lê em páginas de 1000), então não há função nova no banco nem risco de ver dados de outro organizador. Participantes são agrupados pelo WhatsApp. A lista de pendentes com cobrança fica para o item do Pix (decisão do dono); por enquanto só os totais "a receber". Menu lateral e cartões de número são componentes comuns ao admin (`src/components/side-nav.tsx`, `src/components/stats.tsx`, períodos em `src/lib/periods.ts`). Sem migration nesta sessão: a próxima continua sendo a `0010`.
- **Pix e cobrança (sessão 8, item 3 do roadmap):** Pix "copia e cola" estático (BR Code do Banco Central) montado em `src/lib/pix.ts`, sem gateway e sem taxa: chave do organizador, valor exato da inscrição (campo 54; sem valor no rateio) e identificador `ROUTA` + 20 caracteres do id da inscrição (campo 62/05); CRC16 conferido com o exemplo do manual do BC (1D3D). A chave é reconhecida e guardada no formato do Pix (`parsePixKey`: celular com +55, CPF/CNPJ só números; 11 números com CPF válido viram CPF, para celular escreva +55) e o formulário da viagem mostra como foi entendida; chave não reconhecida não salva. QR Code com a biblioteca `qrcode` (`src/components/pix-qr.tsx`, fundo sempre branco). Tela de vaga garantida: QR + "Copiar Pix copia e cola" + chave de reserva. Aba "Cobrança e avisos" em cada viagem: modelos (cobrar pendentes com o Pix de cada um, lembrete da véspera, aviso ao grupo), texto editável com `{nome}`, `{valor}`, `{pix}`, envio em sequência pelo WhatsApp (uma conversa por clique) e marca de "enviada" só no navegador (localStorage). Nada é enviado sozinho e o pagamento continua marcado à mão. Sem migration: a próxima continua sendo a `0010`.
- **Cartão pelo link do organizador (sessão 9, migration `0010`):** a Routa não processa cartão. O organizador liga "Aceitar cartão" na viagem e cola o link de pagamento da conta dele (Mercado Pago, InfinitePay, PagBank…): `trips.card_enabled`, `card_url` (piloto, ou único no rateio), `card_pillion_url` (dupla, obrigatório no valor fixo com garupa), `card_price_cents`/`card_pillion_price_cents` (valor no cartão, para repassar a taxa; vazio = valor do Pix; não pode ser menor). Só links `https://`. `get_public_trip` diz só se aceita e os valores; `register_for_trip` devolve `card {url, amount_cents}` apenas para confirmados (o link fica fora da página pública, como a chave Pix). Mensagens de cobrança e de vaga aberta ganham o link (`{cartao}`). Pagamento continua marcado à mão; o método (Pix ou cartão) não é registrado. Integração automática (Mercado Pago com OAuth e `marketplace_fee`) fica para quando houver demanda. A próxima migration é a `0011`. As funções `get_public_trip` e `register_for_trip` agora vivem na `0010`: copie dela ao alterar de novo.

## 7. Identidade visual

- **Nome:** Routa (route + rota). Sempre escrito "Routa", com R maiúsculo.
- **Slogan:** "Bora de cara pro vento?"
- **Símbolo:** bússola ou seta de direção estilizada.
- **Tom visual:** estrada, liberdade, aventura, para todas as tribos. Nem "durão" demais nem infantil.
- **Mensagem padrão de compartilhamento:** `🧭 Bora pra {destino}? {datas}. Garante sua vaga 👉 {link}`

## 8. Jeito de trabalhar

- Antes de codar algo novo: explique o plano em poucas linhas e espere aprovação.
- Implemente em **etapas pequenas**, uma funcionalidade por vez, e diga **como testar** cada uma.
- Prefira soluções simples e fáceis de manter: o dono do projeto tem cerca de 4h por semana para desenvolver.
- Não adicione dependências sem necessidade clara.
- Mantenha um `README.md` com o passo a passo para rodar localmente e as variáveis de ambiente.
- Ao final de cada sessão, atualize a seção "Status" abaixo.

## 9. Status

- [x] Setup do projeto (Next.js 16 + Supabase + Tailwind 4): migration com tabelas, RLS, funções e storage, já aplicada no projeto Supabase de desenvolvimento
- [x] Login do organizador (1ª versão, por link mágico; trocado por senha na sessão 2): cadastro de perfil (nome + WhatsApp) no 1º acesso, `/painel` protegido, sair. Testado de ponta a ponta com o Supabase real.
- [x] Templates de e-mail `token_hash` (README, passo 5): Confirm sign up e Reset password trocados depois de ligar o SMTP.
- [x] Login com e-mail e senha: `/entrar`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`.
  - [x] Testado em produção: "Esqueci minha senha" com o link aberto no celular.
  - [x] Trocar senha no `/painel/perfil` (senha atual + nova; confere a atual antes de gravar).
    - [ ] Testar com login (o Claude não tem a senha do dono).
- [x] Produção: `https://routa-wine.vercel.app` (projeto recriado na Vercel). Supabase: Site URL = esse endereço; Redirect URLs = ele e `http://localhost:3000/**`. Integração Supabase↔Vercel desligada (ela sobrescrevia a Site URL). Vercel precisa de `NEXT_PUBLIC_SITE_URL` = endereço de produção.
  - [x] SMTP do Gmail pessoal no Supabase (provisório). Quando tiver o domínio `routa.com.br`, trocar por Resend com remetente da Routa.
- [ ] App autenticador opcional (TOTP) no perfil + tela do código no login + migration nova (RLS exige aal2 para quem ativou).
- [x] Criar/editar viagem: `/painel/viagens/nova` e `/painel/viagens/[id]`, todos os campos, termo padrão editável, status (rascunho/publicada/encerrada), lista no `/painel`. Fotos: até 5, reduzidas no navegador e enviadas direto ao Storage; remover e escolher capa. Migration `0002` (policy de SELECT no storage, exigida pelo remove).
  - Testado pelo dono com o Supabase real (migration `0002` aplicada).
- [x] Página pública `/v/[slug]` + Open Graph: fotos, datas, nível/terreno, valor piloto e piloto + garupa, vagas, saída e retorno com horário e mapa, roteiro, termo recolhido, botão fixo "Quero ir" (leva a `/v/[slug]/inscricao`, que ainda não existe). Prévia: capa como `og:image`; sem foto, cartão gerado em `/v/[slug]/og`. Tela de edição com "Mandar no WhatsApp", "Copiar link" e "Ver página".
  - [ ] Conferir a prévia no WhatsApp depois do deploy (precisa de URL pública) e o tamanho da capa (WhatsApp ignora imagem muito pesada).
- [x] Ajustes da viagem (migration `0003`): valor piloto + garupa fechado (vazio = não aceita garupa), local/horário de saída e de retorno, terreno predominante + %.
  - [ ] Testar com o Supabase real depois de aplicar a `0003`.
- [x] Modo escuro (padrão, azul-noite) com botão sol/lua em todas as telas.
- [x] Inscrição + tela Pix: `/v/[slug]/inscricao` sem login, garupa com o valor de cada opção, contato de emergência, aceite do termo; tela final com valor, chave Pix (copiar) e "Mandar comprovante no WhatsApp"; lista de espera sem Pix. Página `/privacidade`. Migration `0004`: inscrições fecham no dia da saída (último dia = véspera, fuso de Brasília).
  - Testado com o Supabase real (`0004` aplicada): inscrição com garupa, Pix, WhatsApp repetido e lista de espera.
  - [ ] Revisar o texto da `/privacidade` (não foi revisado por jurídico) e pôr um e-mail de contato da Routa.
- [x] Botões de status salvam o formulário junto; aviso de inscritos na edição; cópia do termo aceito em cada inscrição (migration `0005`, aplicar no Supabase).
- [x] Painel de inscritos (`/painel/viagens/[id]/inscritos`): resumo (vagas, pagos, fila), confirmados com Pago/Pendente, WhatsApp e detalhes (e-mail, emergência), filtro por pagamento, lista de espera numerada, planilha Excel formatada (`.xlsx` via `exceljs`: título, resumo, cabeçalho laranja, Pago/Pendente coloridos, R$, filtros e totais com fórmula). Contagem de inscritos no `/painel` e na edição.
  - Testado pelo dono com login (pago, filtro, WhatsApp). Planilha Excel testada pelo dono.
- [x] Lista de espera + cancelamento: botão "Remover da viagem" (com confirmação) em cada inscrito; a função `cancel_registration` promove a fila e a tela avisa quem ganhou a vaga, com WhatsApp e mensagem pronta (valor + chave Pix). A inscrição fica como cancelada (não é apagada).
  - Testado pelo dono com login: remoção, promoção da fila e aviso pelo WhatsApp.
- [ ] Deploy na Vercel
- [x] Proteção contra inscrições falsas (sessão 3, migration `0006`): Turnstile + prova assinada (HMAC) + limite por IP. Testado num Postgres local: prova válida, falsa, de outro WhatsApp, vencida e limite por IP.
  - [x] Aplicada no Supabase, segredo e Turnstile configurados, testado em produção pelo dono (10/11).
- [x] Ficha da moto (sessão 3, migration `0006`): marca e modelo com sugestões, ano e cor opcionais, placa quando o organizador liga "Pedir a placa" na viagem; aparece no painel (placa em "Ver mais") e na planilha (colunas Moto e Placa). Página de privacidade atualizada.
  - [x] pg_cron e `purge_old_plates` configurados pelo dono (10/11).
- [x] Selo Cadastur semiautomático (sessão 4, migration `0007`): pedido no `/painel/perfil` (CNPJ, número do certificado, validade e arquivo PDF/JPG/PNG no bucket privado `cadastur-certificates`), checagem do CNPJ na Receita (BrasilAPI: dígitos, existe, ATIVA; CNAE de turismo vira alerta), revisão do admin em `/painel/admin/selos` (abre o certificado com link temporário, consulta pública do Cadastur, aprovar/recusar com motivo), selo na página pública da viagem, aviso no painel 30 dias antes de vencer e selo some sozinho depois da validade. Testado num Postgres local: RLS do pedido, um pendente por vez, organizador não se aprova, só admin lista e revisa, selo some ao vencer.
  - [ ] Aplicar a `0007`, cadastrar o admin (README "Selo Cadastur") e testar com o Supabase real.
  - [ ] Modo Expedição (viagens comerciais) ainda não existe: `has_valid_cadastur(organizer_id)` está pronta para ele.
- [x] Área de administração (sessão 5, migration `0008`): visão geral (números, funil de organizadores, gráficos das últimas 12 semanas, quem parou no caminho com WhatsApp), usuários (busca, detalhe, suspender/reativar), viagens (filtros, detalhe com inscritos, tirar do ar/devolver), selos, atividade recente e log de auditoria, lista de admins; link "Admin" no menu para admins; aviso de conta suspensa no painel; Vercel Web Analytics. Testado num Postgres local: só admin acessa, motivo obrigatório, admin não se suspende, organizador não limpa a própria suspensão nem reexibe a viagem, suspenso não cria viagem nem apaga perfil, página e inscrição saem do ar, auditoria registra tudo.
  - [x] Aplicada no Supabase e testada pelo dono.
- [x] Visual mais enxuto e responsivo + analytics do admin (sessão 6, migration `0009`): botões e textos menores no desktop, páginas usando a largura da tela, página pública em duas colunas, formulários em duas colunas; admin com menu lateral, seletor de período (7/30/90 dias, 12 meses), números com comparação ao período anterior, gráficos interativos com tabela, funil, detalhamentos (terreno, nível, marcas, destinos, antecedência, dia da semana, garupa, pagamento, ocupação), rankings de organizadores e viagens; listas de usuários e viagens em tabela no desktop. Testado num Postgres local: todos os períodos e agrupamentos funcionam e quem não é admin recebe `not_admin`.
  - [x] Aplicada no Supabase e conferida pelo dono (10/11).
- [x] Painel do organizador (sessão 7, sem migration): visão geral com período (números do período comparados ao anterior, vagas preenchidas, fila, pagamentos, a receber, participantes, próximas saídas, gráficos de inscrições e valor, antecedência, dia da semana, marcas, garupa), página Viagens com filtros (próximas, rascunhos, já aconteceram) em tabela, Participantes (todo mundo que já se inscreveu, juntando pelo WhatsApp: quantas viagens, última, próxima; filtros fiéis/sumidos; busca; WhatsApp) e aba Números em cada viagem (ocupação, dinheiro, curva de inscrições x vagas, gente nova x quem volta).
  - [x] No ar e testado pelo dono (10/11).
- [x] Pix com QR Code e valor exato + central de cobrança (sessão 8, sem migration): QR e Pix copia e cola na tela de vaga garantida, chave Pix conferida no formulário, aba "Cobrança e avisos" com cobrança dos pendentes (Pix de cada um), lembrete da véspera e aviso ao grupo, envio em sequência; atalhos "cobrar" na visão geral e na aba Números; mensagem de "abriu vaga" com o Pix copia e cola. Testado: CRC com o exemplo do manual do BC, QR decodificado igual ao código.
  - [x] Pix de teste pago e conferido pelo dono (10/11).
- [x] Cartão de crédito pelo link de pagamento do organizador (sessão 9, migration `0010`): opção na viagem com link de piloto e de dupla e valor no cartão opcional, "Pagar no cartão" na tela de vaga garantida (com o nome da empresa do link), "Pix ou cartão" na página da viagem, link nas mensagens de cobrança e de vaga aberta, privacidade atualizada. Testado num Postgres local: link só para confirmados, dupla recebe o link e o valor da dupla, fila não recebe, http e falta de link recusados.
  - [ ] Aplicar a `0010` e testar com um link real.
