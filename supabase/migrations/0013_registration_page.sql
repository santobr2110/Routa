-- Routa · página do inscrito e mural de avisos.
--
-- Cada inscrição ganha um link pessoal e secreto (/i/{access_token}), sem login: quem tem o
-- link vê a própria vaga, o pagamento, as informações da viagem e os avisos do organizador.
-- O token tem 128 bits aleatórios (impossível de adivinhar). O organizador publica avisos no
-- mural da viagem (trip_updates); só aparecem na página do inscrito.
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

alter table public.registrations
  add column access_token text;
update public.registrations
  set access_token = encode(extensions.gen_random_bytes(16), 'hex')
  where access_token is null;
alter table public.registrations
  alter column access_token set default encode(extensions.gen_random_bytes(16), 'hex'),
  alter column access_token set not null,
  add constraint registrations_access_token_key unique (access_token);

-- =====================================================================
-- Mural de avisos da viagem
-- =====================================================================

create table public.trip_updates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create index trip_updates_trip on public.trip_updates (trip_id, created_at desc);

alter table public.trip_updates enable row level security;

-- O organizador lê, publica e apaga avisos das próprias viagens. Ninguém mais lê direto
-- (o inscrito vê pela função get_registration_page).
create policy "own trip updates" on public.trip_updates
  for all to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_id and t.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t
                      where t.id = trip_id and t.organizer_id = (select auth.uid())));

revoke all on public.trip_updates from anon;
revoke update on public.trip_updates from authenticated;
grant select, insert, delete on public.trip_updates to authenticated;

-- Organizador suspenso não publica.
create or replace function private.block_suspended_updates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.organizers o join public.trips t on t.organizer_id = o.id
             where t.id = new.trip_id and o.suspended_at is not null) then
    raise exception 'organizer_suspended';
  end if;
  return new;
end $$;

create trigger trip_updates_block_suspended
  before insert on public.trip_updates
  for each row execute function private.block_suspended_updates();

revoke execute on function private.block_suspended_updates() from public, anon, authenticated;

-- =====================================================================
-- Página do inscrito (pública, pelo token)
-- =====================================================================

create or replace function public.get_registration_page(p_token text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_trip public.trips;
  v_org public.organizers;
  v_confirmed boolean;
  v_amount integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into v_reg from public.registrations where access_token = p_token;
  if not found then
    return null;
  end if;
  select * into v_trip from public.trips where id = v_reg.trip_id;
  select * into v_org from public.organizers where id = v_trip.organizer_id;
  v_confirmed := v_reg.status = 'confirmed';
  v_amount := private.registration_amount(v_trip, v_reg.has_pillion);

  return json_build_object(
    'registration', json_build_object(
      'id', v_reg.id,
      'name', v_reg.name,
      'status', v_reg.status,
      'created_at', v_reg.created_at,
      'cancelled_at', v_reg.cancelled_at,
      'has_pillion', v_reg.has_pillion,
      'pillion_name', v_reg.pillion_name,
      'bike', v_reg.bike,
      'payment_status', v_reg.payment_status,
      'payment_due_at', v_reg.payment_due_at,
      'released_at', v_reg.released_at,
      'promoted_at', v_reg.promoted_at,
      'terms_accepted_at', v_reg.terms_accepted_at,
      'terms_text_accepted', v_reg.terms_text_accepted,
      'waitlist_position', case when v_reg.status = 'waitlist' then (
        select count(*) + 1 from public.registrations r
        where r.trip_id = v_reg.trip_id and r.status = 'waitlist'
          and (r.queued_at, r.created_at, r.id) < (v_reg.queued_at, v_reg.created_at, v_reg.id)) end,
      'amount_cents', v_amount
    ),
    'trip', json_build_object(
      'slug', v_trip.slug,
      'title', v_trip.title,
      'destination', v_trip.destination,
      'description', v_trip.description,
      'start_date', v_trip.start_date,
      'end_date', v_trip.end_date,
      'departure_point', v_trip.departure_point,
      'departure_point_url', v_trip.departure_point_url,
      'departure_time', to_char(v_trip.departure_time, 'HH24:MI'),
      'return_point', v_trip.return_point,
      'return_point_url', v_trip.return_point_url,
      'return_time', to_char(v_trip.return_time, 'HH24:MI'),
      'pricing_mode', v_trip.pricing_mode,
      'status', v_trip.status,
      -- Viagem tirada do ar pela administração ou organizador suspenso: avisa na página.
      'unavailable', v_trip.admin_hidden_at is not null or v_org.suspended_at is not null,
      'cover', (select p.storage_path from public.trip_photos p
                where p.trip_id = v_trip.id order by p.position limit 1)
    ),
    'organizer', json_build_object(
      'name', v_org.name,
      'whatsapp', v_org.whatsapp,
      'club', case when v_org.page_enabled then json_build_object(
        'slug', v_org.page_slug, 'name', v_org.page_name, 'logo_path', v_org.page_logo_path,
        'color', v_org.page_color) end
    ),
    -- Pagamento: chave Pix e cartão só para quem está confirmado (como na inscrição).
    'payment', case when v_confirmed then json_build_object(
      'pix_key', v_trip.pix_key,
      'card', case when v_trip.card_enabled then json_build_object(
        'url', case when v_reg.has_pillion then coalesce(v_trip.card_pillion_url, v_trip.card_url)
                    else v_trip.card_url end,
        'amount_cents', case
          when v_trip.pricing_mode <> 'fixed' then null
          when v_reg.has_pillion then coalesce(v_trip.card_pillion_price_cents, v_trip.pillion_price_cents)
          else coalesce(v_trip.card_price_cents, v_trip.price_cents) end) end
    ) end,
    -- Avisos só para quem não cancelou.
    'updates', case when v_reg.status <> 'cancelled' then coalesce((
      select json_agg(json_build_object('id', u.id, 'body', u.body, 'created_at', u.created_at)
                      order by u.created_at desc)
      from public.trip_updates u where u.trip_id = v_trip.id), '[]'::json) else '[]'::json end
  );
end $$;

revoke execute on function public.get_registration_page(text) from public;
grant execute on function public.get_registration_page(text) to anon, authenticated;

-- =====================================================================
-- Inscrição: devolve o token do link pessoal
-- =====================================================================

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
  where slug = p_slug and status = 'published' and admin_hidden_at is null
  for update;
  if not found then
    raise exception 'trip_not_open';
  end if;

  -- Organizador suspenso pela administração: inscrições fechadas.
  if exists (select 1 from public.organizers
             where id = v_trip.organizer_id and suspended_at is not null) then
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
    'organizer_whatsapp', case when v_status = 'confirmed' then v_org.whatsapp end,
    -- Prazo para pagar (calculado pelo gatilho ao confirmar), ou null.
    'payment_due_at', (select payment_due_at from public.registrations where id = v_id),
    -- Link pessoal da página do inscrito (0013): /i/{access_token}.
    'access_token', (select access_token from public.registrations where id = v_id),
    -- Cartão (link de pagamento do próprio organizador): só para quem garantiu a vaga.
    'card', case when v_status = 'confirmed' and v_trip.card_enabled then json_build_object(
      'url', case when v_has_pillion then coalesce(v_trip.card_pillion_url, v_trip.card_url)
                  else v_trip.card_url end,
      'amount_cents', case
        when v_trip.pricing_mode <> 'fixed' then null
        when v_has_pillion then coalesce(v_trip.card_pillion_price_cents, v_trip.pillion_price_cents)
        else coalesce(v_trip.card_price_cents, v_trip.price_cents) end
    ) end
  );
end $$;
