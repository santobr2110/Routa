-- Routa · proteção contra inscrições falsas + ficha da moto.
--
-- 1. Proteção: register_for_trip passa a exigir uma "prova" (HMAC) que só o servidor da Routa
--    sabe gerar, depois de conferir o Cloudflare Turnstile. Assim ninguém consegue inscrever
--    pessoas chamando a função direto com a chave pública. Também limita inscrições por IP
--    (guardamos só um hash do IP, nunca o IP).
-- 2. Ficha da moto: marca, modelo, ano, cor e placa (a placa só quando o organizador pedir).
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- DEPOIS, ainda no SQL Editor, grave o segredo (o MESMO valor de REGISTRATION_SIGNING_SECRET
-- da Vercel e do .env.local; veja o README, passo "Proteção da inscrição"):
--
--   insert into private.app_secrets (name, value)
--   values ('registration_signing', 'COLE-AQUI-O-SEGREDO')
--   on conflict (name) do update set value = excluded.value;

-- =====================================================================
-- Esquema privado (não é exposto pela API do Supabase)
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  name text primary key,
  value text not null check (char_length(value) >= 32)
);
revoke all on private.app_secrets from public, anon, authenticated;

-- Tentativas de inscrição por IP (hash), para o limite de frequência.
create table if not exists private.registration_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists registration_attempts_ip_time
  on private.registration_attempts (ip_hash, created_at);
revoke all on private.registration_attempts from public, anon, authenticated;

-- =====================================================================
-- Viagem: pedir placa?
-- =====================================================================

alter table public.trips add column if not exists requires_plate boolean not null default false;

-- =====================================================================
-- Inscrição: ficha da moto
-- O campo antigo "bike" continua existindo (marca + modelo) para não quebrar nada.
-- =====================================================================

alter table public.registrations
  add column if not exists bike_brand text check (char_length(bike_brand) between 2 and 40),
  add column if not exists bike_model text check (char_length(bike_model) between 1 and 60),
  add column if not exists bike_year smallint check (bike_year between 1950 and 2100),
  add column if not exists bike_color text check (char_length(bike_color) between 2 and 30),
  -- Placa sem hífen e em maiúsculas: Mercosul (ABC1D23) ou antiga (ABC1234).
  add column if not exists bike_plate text check (bike_plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$');

-- =====================================================================
-- Página pública: agora informa se a viagem pede placa
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

-- =====================================================================
-- Inscrição protegida
-- A versão antiga (sem prova) é APAGADA: senão ela continuaria aberta para qualquer um.
-- =====================================================================

drop function if exists public.register_for_trip(
  text, text, text, text, text, boolean, text, text, text, boolean
);

create or replace function public.register_for_trip(
  p_slug text,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_bike_brand text,
  p_bike_model text,
  p_bike_year smallint,
  p_bike_color text,
  p_bike_plate text,
  p_has_pillion boolean,
  p_pillion_name text,
  p_emergency_name text,
  p_emergency_phone text,
  p_terms_accepted boolean,
  p_ip_hash text,
  p_issued_at bigint,
  p_proof text
)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_expected text;
  v_trip public.trips;
  v_org public.organizers;
  v_confirmed int;
  v_status text;
  v_id uuid;
  v_has_pillion boolean := coalesce(p_has_pillion, false);
  v_plate text := nullif(upper(regexp_replace(coalesce(p_bike_plate, ''), '[^A-Za-z0-9]', '', 'g')), '');
begin
  -- 1. Prova do servidor: HMAC-SHA256 de "slug|whatsapp|ip_hash|issued_at" com o segredo.
  select value into v_secret from private.app_secrets where name = 'registration_signing';
  if v_secret is null then
    raise exception 'signing_not_configured';
  end if;
  if p_issued_at is null or abs(extract(epoch from now()) - p_issued_at) > 300 then
    raise exception 'invalid_proof';
  end if;
  v_expected := encode(
    extensions.hmac(
      p_slug || '|' || p_whatsapp || '|' || coalesce(p_ip_hash, '') || '|' || p_issued_at::text,
      v_secret, 'sha256'),
    'hex');
  if p_proof is distinct from v_expected then
    raise exception 'invalid_proof';
  end if;

  -- 2. Limite: no máximo 5 inscrições do mesmo IP a cada 10 minutos.
  if p_ip_hash is not null then
    if (select count(*) from private.registration_attempts
        where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 5 then
      raise exception 'rate_limited';
    end if;
    insert into private.registration_attempts (ip_hash) values (p_ip_hash);
    -- Faxina: tentativas com mais de 1 dia não servem para nada.
    delete from private.registration_attempts where created_at < now() - interval '1 day';
  end if;

  if p_terms_accepted is not true then
    raise exception 'terms_not_accepted';
  end if;

  select * into v_trip from public.trips
  where slug = p_slug and status = 'published'
  for update;
  if not found then
    raise exception 'trip_not_open';
  end if;

  -- Inscrições fecham no dia da saída: o último dia para se inscrever é a véspera.
  if v_trip.start_date <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'trip_not_open';
  end if;

  if v_has_pillion and not v_trip.accepts_pillion then
    raise exception 'pillion_not_accepted';
  end if;

  -- Placa: obrigatória se o organizador pediu; se não pediu, não guardamos.
  if v_trip.requires_plate then
    if v_plate is null or v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then
      raise exception 'plate_required';
    end if;
  else
    v_plate := null;
  end if;

  select count(*) into v_confirmed
  from public.registrations where trip_id = v_trip.id and status = 'confirmed';

  v_status := case when v_confirmed < v_trip.capacity then 'confirmed' else 'waitlist' end;

  begin
    insert into public.registrations (
      trip_id, name, whatsapp, email,
      bike, bike_brand, bike_model, bike_year, bike_color, bike_plate,
      has_pillion, pillion_name,
      emergency_name, emergency_phone, terms_accepted_at, terms_text_accepted, status
    ) values (
      v_trip.id, trim(p_name), p_whatsapp, lower(trim(p_email)),
      left(trim(p_bike_brand) || ' ' || trim(p_bike_model), 80),
      trim(p_bike_brand), trim(p_bike_model), p_bike_year,
      nullif(trim(coalesce(p_bike_color, '')), ''), v_plate,
      v_has_pillion,
      case when v_has_pillion then nullif(trim(p_pillion_name), '') end,
      trim(p_emergency_name), p_emergency_phone, now(), v_trip.terms_text, v_status
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

revoke execute on function public.register_for_trip(
  text, text, text, text, text, text, smallint, text, text, boolean, text, text, text, boolean,
  text, bigint, text
) from public;
grant execute on function public.register_for_trip(
  text, text, text, text, text, text, smallint, text, text, boolean, text, text, text, boolean,
  text, bigint, text
) to anon, authenticated;

-- =====================================================================
-- LGPD: a placa é apagada 90 dias depois do fim da viagem.
-- Para rodar sozinho todo dia, ligue o pg_cron (README, passo "Proteção da inscrição").
-- =====================================================================

create or replace function public.purge_old_plates()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.registrations r
  set bike_plate = null
  from public.trips t
  where t.id = r.trip_id
    and r.bike_plate is not null
    and t.end_date < (now() at time zone 'America/Sao_Paulo')::date - 90;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_old_plates() from public, anon, authenticated;
