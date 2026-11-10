-- Routa · pagamento com cartão pelo link do próprio organizador.
--
-- A Routa não processa cartão: o organizador cria um link de pagamento na conta dele
-- (Mercado Pago, InfinitePay, PagBank…) e cola na viagem. Quem garante a vaga vê o Pix
-- e o botão "Pagar no cartão". O pagamento continua sendo marcado à mão.
--
-- - trips.card_enabled: aceita cartão.
-- - trips.card_url / card_pillion_url: links (piloto e piloto + garupa). Só https.
-- - trips.card_price_cents / card_pillion_price_cents: valor no cartão, se diferente do Pix
--   (para repassar a taxa). Vazio = mesmo valor do Pix.
-- - get_public_trip devolve se aceita cartão e os valores (sem os links).
-- - register_for_trip devolve o link e o valor no cartão só para quem foi confirmado.
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

alter table public.trips
  add column card_enabled boolean not null default false,
  add column card_url text check (card_url ~ '^https://[^\s]+$' and char_length(card_url) <= 500),
  add column card_pillion_url text
    check (card_pillion_url ~ '^https://[^\s]+$' and char_length(card_pillion_url) <= 500),
  add column card_price_cents integer check (card_price_cents > 0),
  add column card_pillion_price_cents integer check (card_pillion_price_cents > 0),
  add constraint trips_card_needs_link check (not card_enabled or card_url is not null);

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
