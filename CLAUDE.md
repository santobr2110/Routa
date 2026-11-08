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
2. **Criar e editar viagem:** título, descrição/roteiro, data de início e fim, ponto de encontro (texto + link do Maps), fotos (até 5), número de vagas, valor por pessoa (ou "a definir/rateio"), nível exigido (iniciante / intermediário / estradeiro experiente), tipo de terreno (asfalto / misto / off-road), chave Pix do organizador, termo de responsabilidade (texto padrão editável).
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
- `trips`: id, organizer_id, slug (único), title, **destination**, description, start_date, end_date, meeting_point, meeting_point_url, price_cents (nullable), pricing_mode ('fixed' | 'split'), level ('beginner' | 'intermediate' | 'experienced'), terrain ('asphalt' | 'mixed' | 'offroad'), capacity, pix_key, terms_text, status ('draft' | 'published' | 'closed'), created_at, updated_at
- `trip_photos`: id, trip_id, storage_path, position (0–4, máx. 5 fotos)
- `registrations`: id, trip_id, name, whatsapp, email, bike, has_pillion, pillion_name, emergency_name, emergency_phone, terms_accepted_at, payment_status ('pending' | 'paid'), status ('confirmed' | 'waitlist' | 'cancelled'), cancelled_at, created_at
- Telefones guardados só com dígitos e o 55 na frente (`5511999998888`).

**Decisões tomadas (sessão 1):**
- **1 vaga = 1 moto** (piloto + garupa ocupam uma vaga). O valor é **por pessoa**: quem leva garupa paga 2×.
- A ordem da lista de espera é `created_at` (não existe `waitlist_position`).
- Quem cai na lista de espera **não** vê a chave Pix. Quando for promovido, o organizador avisa pelo WhatsApp (o v0 não manda notificação).
- Valor "a definir/rateio": a tela final mostra a chave Pix e "o organizador vai te passar o valor".
- Um WhatsApp só pode ter uma inscrição ativa por viagem.
- O WhatsApp do organizador aparece para o inscrito confirmado (para mandar o comprovante).
- **Segurança:** o visitante (anon) não lê nenhuma tabela. A página pública e a inscrição usam as funções `get_public_trip` e `register_for_trip` (security definer). Cancelar é `cancel_registration`, que promove a fila. Na tabela de inscritos, o organizador só pode alterar `payment_status`. A capacidade não pode ficar abaixo dos confirmados, e aumentar a capacidade promove a fila.
- Storage: bucket público `trip-photos`, caminho `{organizer_id}/{trip_id}/arquivo`.
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

- [x] Setup do projeto (Next.js 16 + Supabase + Tailwind 4): migration com tabelas, RLS, funções e storage (validada no PGlite, ainda não rodada num Supabase real)
- [x] Login do organizador: link mágico, cadastro de perfil (nome + WhatsApp) no 1º acesso, `/painel` protegido, sair
- [ ] Testar o login de ponta a ponta com um projeto Supabase real
- [ ] Criar/editar viagem
- [ ] Página pública + Open Graph
- [ ] Inscrição + tela Pix
- [ ] Painel do organizador + CSV
- [ ] Lista de espera + cancelamento
- [ ] Deploy na Vercel
