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

1. **Login do organizador** por link mágico (e-mail), via Supabase Auth.
2. **Criar e editar viagem:** título, descrição/roteiro, data de início e fim, local e horário de saída e de retorno (texto + horário + link do Maps; retorno opcional), fotos (até 5), número de vagas, valor piloto e valor piloto + garupa (ou "a definir/rateio"), nível exigido (iniciante / intermediário / estradeiro experiente), terreno predominante (asfalto / misto / off-road) + %, chave Pix do organizador, termo de responsabilidade (texto padrão editável).
3. **Página pública da viagem** (`/v/[slug]`): bonita, mobile-first, rápida, com **Open Graph** caprichado (título, data, imagem) para a prévia no WhatsApp. Mostra as vagas restantes e o botão "Quero ir".
4. **Inscrição sem login:** nome, WhatsApp, e-mail, moto (marca/modelo), se leva garupa (e o nome da garupa), contato de emergência (nome + telefone) e aceite obrigatório do termo. Depois de enviar: tela com a chave Pix, o valor e a instrução para mandar o comprovante ao organizador.
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
- **Supabase:** Auth (link mágico), Postgres, Storage (fotos), **Row Level Security em todas as tabelas**.
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
- `registrations`: id, trip_id, name, whatsapp, email, bike, has_pillion, pillion_name, emergency_name, emergency_phone, terms_accepted_at, payment_status ('pending' | 'paid'), status ('confirmed' | 'waitlist' | 'cancelled'), cancelled_at, created_at
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
- **Open Graph (sessão 2):** `ImageResponse` só gera PNG, e PNG com foto fica pesado demais para o WhatsApp. Por isso a capa (JPEG) é a imagem da prévia, e o cartão gerado só entra quando não há foto.
- **Viagem (sessão 2):** o slug é gerado na criação (`{destino}-{6 hex}`) e **não muda** na edição, para não quebrar links já compartilhados. A viagem nasce como rascunho. Fotos só entram depois de criar a viagem (o caminho precisa do `trip_id`). Trocar a capa = trocar a posição com a foto 0.
- **Modo escuro (sessão 2):** padrão escuro, paleta **azul-noite** (fundo `#0b1120`, cartões `#111a2e`), botão sol/lua no topo, escolha salva no `localStorage` (`routa-theme`). Use as **cores com nome** do `globals.css` (`bg-surface`, `text-muted`, `border-line`, `text-accent`, `text-danger`…), nunca `stone-*`, `white` ou `red-*` direto. `bg-brand` (botões) é igual nos dois modos; `text-accent` é o laranja para texto e links.
- **Next.js 16:** `cacheComponents` está desligado de propósito (modelo clássico, mais simples). O antigo `middleware.ts` agora se chama `src/proxy.ts`. Antes de usar uma API do Next, consulte `node_modules/next/dist/docs/`.
- Login por link mágico com o template de e-mail `token_hash` (veja o README), para funcionar quando o link abre em outro navegador do celular.

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
- [x] Login do organizador: link mágico, cadastro de perfil (nome + WhatsApp) no 1º acesso, `/painel` protegido, sair. Testado de ponta a ponta com o Supabase real.
- [ ] Template de e-mail `token_hash` (README, passo 4): o Supabase não deixou editar sem SMTP próprio. Fazer junto com o SMTP no deploy. Até lá, o link precisa ser aberto no mesmo navegador.
- [x] Criar/editar viagem: `/painel/viagens/nova` e `/painel/viagens/[id]`, todos os campos, termo padrão editável, status (rascunho/publicada/encerrada), lista no `/painel`. Fotos: até 5, reduzidas no navegador e enviadas direto ao Storage; remover e escolher capa. Migration `0002` (policy de SELECT no storage, exigida pelo remove).
  - Testado pelo dono com o Supabase real (migration `0002` aplicada).
- [x] Página pública `/v/[slug]` + Open Graph: fotos, datas, nível/terreno, valor piloto e piloto + garupa, vagas, saída e retorno com horário e mapa, roteiro, termo recolhido, botão fixo "Quero ir" (leva a `/v/[slug]/inscricao`, que ainda não existe). Prévia: capa como `og:image`; sem foto, cartão gerado em `/v/[slug]/og`. Tela de edição com "Mandar no WhatsApp", "Copiar link" e "Ver página".
  - [ ] Conferir a prévia no WhatsApp depois do deploy (precisa de URL pública) e o tamanho da capa (WhatsApp ignora imagem muito pesada).
- [x] Ajustes da viagem (migration `0003`): valor piloto + garupa fechado (vazio = não aceita garupa), local/horário de saída e de retorno, terreno predominante + %.
  - [ ] Testar com o Supabase real depois de aplicar a `0003`.
- [x] Modo escuro (padrão, azul-noite) com botão sol/lua em todas as telas.
- [ ] Inscrição + tela Pix (`register_for_trip` já devolve `amount_cents` com o valor certo para quem leva garupa)
- [ ] Painel do organizador + CSV
- [ ] Lista de espera + cancelamento
- [ ] Deploy na Vercel
