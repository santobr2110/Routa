-- Routa · página do clube (white label nível 1).
--
-- Cada organizador pode ligar uma página pública em /c/{endereço}: nome do clube, logo,
-- capa, descrição, cidade, Instagram, WhatsApp (se quiser mostrar), cor do clube, próximas
-- viagens abertas, viagens realizadas e números (viagens e viajantes). As imagens ficam no
-- bucket trip-photos, na pasta do próprio organizador ({organizer_id}/clube/...).
-- A página e as viagens do clube usam a cor do clube (o contraste é ajustado no app).
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

alter table public.organizers
  add column page_enabled boolean not null default false,
  add column page_slug text unique
    check (page_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and page_slug !~ '--'),
  add column page_name text check (char_length(btrim(page_name)) between 2 and 60),
  add column page_bio text check (char_length(page_bio) <= 800),
  add column page_city text check (char_length(page_city) <= 60),
  add column page_instagram text check (page_instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column page_show_whatsapp boolean not null default false,
  add column page_color text check (page_color ~ '^#[0-9a-f]{6}$'),
  add column page_logo_path text check (char_length(page_logo_path) <= 300),
  add column page_cover_path text check (char_length(page_cover_path) <= 300),
  add constraint organizers_page_needs_slug
    check (not page_enabled or (page_slug is not null and page_name is not null));

-- Endereços que não podem ser usados (palavras do sistema e da marca).
create or replace function private.reserved_page_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.page_slug in ('admin', 'routa', 'painel', 'api', 'login', 'entrar', 'cadastro',
                       'suporte', 'ajuda', 'clube', 'clubes', 'novo', 'nova', 'oficial') then
    raise exception 'reserved_slug';
  end if;
  return new;
end $$;

create trigger organizers_reserved_slug
  before insert or update of page_slug on public.organizers
  for each row when (new.page_slug is not null)
  execute function private.reserved_page_slug();

revoke execute on function private.reserved_page_slug() from public, anon, authenticated;

-- =====================================================================
-- Página pública do clube
-- =====================================================================

create or replace function public.get_club_page(p_slug text)
returns json language sql stable security definer set search_path = '' as $$
  with o as (
    select * from public.organizers
    where page_slug = lower(p_slug) and page_enabled and suspended_at is null
  ),
  today as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  visible as (
    select t.* from public.trips t, o
    where t.organizer_id = o.id
      and t.status in ('published', 'closed')
      and t.admin_hidden_at is null
  ),
  done as (
    select v.* from visible v, today where v.end_date < today.d
  )
  select json_build_object(
    'slug', o.page_slug,
    'name', o.page_name,
    'bio', o.page_bio,
    'city', o.page_city,
    'instagram', o.page_instagram,
    'whatsapp', case when o.page_show_whatsapp then o.whatsapp end,
    'color', o.page_color,
    'logo_path', o.page_logo_path,
    'cover_path', o.page_cover_path,
    'organizer_name', o.name,
    'since', o.created_at,
    'cadastur', public.organizer_cadastur_seal(o.id),
    'stats', json_build_object(
      'trips_done', (select count(*) from done),
      'travelers', (select count(*) from public.registrations r join done on done.id = r.trip_id
                    where r.status = 'confirmed'),
      'returning', (select count(*) from (
                      select r.whatsapp from public.registrations r join done on done.id = r.trip_id
                      where r.status = 'confirmed' group by r.whatsapp having count(*) > 1) x)
    ),
    'upcoming', coalesce((
      select json_agg(json_build_object(
        'slug', v.slug, 'title', v.title, 'destination', v.destination,
        'start_date', v.start_date, 'end_date', v.end_date,
        'level', v.level, 'terrain', v.terrain,
        'pricing_mode', v.pricing_mode, 'price_cents', v.price_cents,
        'capacity', v.capacity,
        'spots_left', greatest(v.capacity - (
          select count(*) from public.registrations r
          where r.trip_id = v.id and r.status = 'confirmed'), 0),
        'registration_open', v.status = 'published' and v.start_date > today.d,
        'cover', (select p.storage_path from public.trip_photos p
                  where p.trip_id = v.id order by p.position limit 1)
      ) order by v.start_date)
      from visible v, today where v.end_date >= today.d), '[]'::json),
    'past', coalesce((
      select json_agg(x order by x.start_date desc) from (
        select d.slug, d.title, d.destination, d.start_date,
          (select count(*) from public.registrations r
           where r.trip_id = d.id and r.status = 'confirmed') as travelers,
          (select p.storage_path from public.trip_photos p
           where p.trip_id = d.id order by p.position limit 1) as cover
        from done d order by d.start_date desc limit 12) x), '[]'::json)
  )
  from o;
$$;

revoke execute on function public.get_club_page(text) from public;
grant execute on function public.get_club_page(text) to anon, authenticated;

-- =====================================================================
-- Página da viagem: mostra o clube (link, logo e cor)
-- =====================================================================

create or replace function public.get_public_trip(p_slug text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', t.id,
    'slug', t.slug,
    'title', t.title,
    'destination', t.destination,
    'description', t.description,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'departure_point', t.departure_point,
    'departure_point_url', t.departure_point_url,
    'departure_time', to_char(t.departure_time, 'HH24:MI'),
    'return_point', t.return_point,
    'return_point_url', t.return_point_url,
    'return_time', to_char(t.return_time, 'HH24:MI'),
    'pricing_mode', t.pricing_mode,
    'price_cents', t.price_cents,
    'accepts_pillion', t.accepts_pillion,
    'pillion_price_cents', t.pillion_price_cents,
    -- Cartão: só se aceita e quanto custa (o link só vai para quem garante a vaga).
    'accepts_card', t.card_enabled,
    'card_price_cents', case when t.card_enabled then coalesce(t.card_price_cents, t.price_cents) end,
    'card_pillion_price_cents', case when t.card_enabled and t.accepts_pillion
      then coalesce(t.card_pillion_price_cents, t.pillion_price_cents) end,
    -- Prazo para pagar depois de garantir a vaga, em horas (null = sem prazo).
    'payment_deadline_hours', t.payment_deadline_hours,
    'requires_plate', t.requires_plate,
    'level', t.level,
    'terrain', t.terrain,
    'terrain_percent', t.terrain_percent,
    'capacity', t.capacity,
    'status', t.status,
    -- Aberta = publicada e antes do dia da saída (fuso de Brasília).
    'registration_open', t.status = 'published'
      and t.start_date > (now() at time zone 'America/Sao_Paulo')::date,
    'terms_text', t.terms_text,
    'organizer_name', o.name,
    -- Página do clube (0012): só se o organizador ligou a página.
    'club', case when o.page_enabled then json_build_object(
      'slug', o.page_slug, 'name', o.page_name, 'logo_path', o.page_logo_path,
      'color', o.page_color) end,
    -- Selo Cadastur válido (aprovado e dentro da validade) ou null.
    'organizer_cadastur', public.organizer_cadastur_seal(t.organizer_id),
    'spots_left', greatest(t.capacity - (
      select count(*) from public.registrations r
      where r.trip_id = t.id and r.status = 'confirmed'), 0),
    'photos', coalesce((
      select json_agg(p.storage_path order by p.position)
      from public.trip_photos p where p.trip_id = t.id), '[]'::json)
  )
  from public.trips t
  join public.organizers o on o.id = t.organizer_id
  where t.slug = p_slug and t.status in ('published', 'closed')
    -- Tirada do ar pela administração, ou organizador suspenso: a página some.
    and t.admin_hidden_at is null
    and o.suspended_at is null;
$$;
