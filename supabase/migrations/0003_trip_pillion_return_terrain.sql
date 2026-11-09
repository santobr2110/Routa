-- Routa · ajustes na viagem (sessão 2)
-- 1. Garupa: valor fechado de "piloto + garupa" e opção de não aceitar garupa.
-- 2. Ponto de encontro vira local de saída (com horário) + local de retorno (opcional, com horário).
-- 3. Terreno predominante + porcentagem.
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

-- =====================================================================
-- 1. Garupa
-- =====================================================================

alter table public.trips
  add column accepts_pillion boolean not null default true,
  -- Valor total da dupla (piloto + garupa). Só existe com valor fixo e garupa aceita.
  add column pillion_price_cents integer check (pillion_price_cents >= 0);

-- Viagens existentes: mantém o comportamento antigo (garupa paga o mesmo que o piloto).
update public.trips set pillion_price_cents = price_cents * 2 where pricing_mode = 'fixed';

alter table public.trips
  add constraint trips_pillion_price_check check (
    ((pricing_mode = 'fixed' and accepts_pillion) = (pillion_price_cents is not null))
    and (pillion_price_cents is null or pillion_price_cents >= price_cents)
  );

-- =====================================================================
-- 2. Saída e retorno
-- =====================================================================

alter table public.trips rename column meeting_point to departure_point;
alter table public.trips rename column meeting_point_url to departure_point_url;

alter table public.trips
  add column departure_time time,          -- obrigatório no formulário; nulo só em viagens antigas
  add column return_point text,            -- nulo = mesmo local da saída
  add column return_point_url text,
  add column return_time time;             -- previsão, opcional

-- =====================================================================
-- 3. Terreno predominante + %
-- =====================================================================

alter table public.trips
  add column terrain_percent smallint not null default 100
    check (terrain_percent between 1 and 100);

-- =====================================================================
-- Funções públicas com os campos novos
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
    'level', t.level,
    'terrain', t.terrain,
    'terrain_percent', t.terrain_percent,
    'capacity', t.capacity,
    'status', t.status,
    'terms_text', t.terms_text,
    'organizer_name', o.name,
    'spots_left', greatest(t.capacity - (
      select count(*) from public.registrations r
      where r.trip_id = t.id and r.status = 'confirmed'), 0),
    'photos', coalesce((
      select json_agg(p.storage_path order by p.position)
      from public.trip_photos p where p.trip_id = t.id), '[]'::json)
  )
  from public.trips t
  join public.organizers o on o.id = t.organizer_id
  where t.slug = p_slug and t.status in ('published', 'closed');
$$;

create or replace function public.register_for_trip(
  p_slug text,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_bike text,
  p_has_pillion boolean,
  p_pillion_name text,
  p_emergency_name text,
  p_emergency_phone text,
  p_terms_accepted boolean
)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
  v_org public.organizers;
  v_confirmed int;
  v_status text;
  v_id uuid;
  v_has_pillion boolean := coalesce(p_has_pillion, false);
begin
  if p_terms_accepted is not true then
    raise exception 'terms_not_accepted';
  end if;

  select * into v_trip from public.trips
  where slug = p_slug and status = 'published'
  for update;
  if not found then
    raise exception 'trip_not_open';
  end if;

  if v_has_pillion and not v_trip.accepts_pillion then
    raise exception 'pillion_not_accepted';
  end if;

  select count(*) into v_confirmed
  from public.registrations where trip_id = v_trip.id and status = 'confirmed';

  v_status := case when v_confirmed < v_trip.capacity then 'confirmed' else 'waitlist' end;

  begin
    insert into public.registrations (
      trip_id, name, whatsapp, email, bike, has_pillion, pillion_name,
      emergency_name, emergency_phone, terms_accepted_at, status
    ) values (
      v_trip.id, trim(p_name), p_whatsapp, lower(trim(p_email)), trim(p_bike),
      v_has_pillion,
      case when v_has_pillion then nullif(trim(p_pillion_name), '') end,
      trim(p_emergency_name), p_emergency_phone, now(), v_status
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'already_registered';
  end;

  select * into v_org from public.organizers where id = v_trip.organizer_id;

  return json_build_object(
    'registration_id', v_id,
    'status', v_status,
    'pricing_mode', v_trip.pricing_mode,
    -- Valor a pagar: o da dupla para quem leva garupa, o do piloto para quem vai sozinho.
    'amount_cents', case
      when v_trip.pricing_mode <> 'fixed' then null
      when v_has_pillion then v_trip.pillion_price_cents
      else v_trip.price_cents end,
    'has_pillion', v_has_pillion,
    'organizer_name', v_org.name,
    'pix_key', case when v_status = 'confirmed' then v_trip.pix_key end,
    'organizer_whatsapp', case when v_status = 'confirmed' then v_org.whatsapp end
  );
end $$;
