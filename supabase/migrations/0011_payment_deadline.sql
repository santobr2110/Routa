-- Routa · prazo de pagamento e fila automática.
--
-- O organizador escolhe, por viagem, um prazo para pagar depois de garantir a vaga
-- (24h, 48h, 72h ou 5 dias; desligado por padrão) e o que acontece quando vence:
--   - 'notify'  (padrão): só avisa; o organizador libera a vaga com um clique.
--   - 'release': libera sozinho (pg_cron a cada 15 minutos).
-- Liberar = quem não pagou vai para o FIM da lista de espera e o primeiro da fila sobe,
-- com um prazo novo. A vaga só é liberada se houver alguém esperando; sem fila, a pessoa
-- fica com o pagamento atrasado e continua podendo pagar.
-- O prazo nunca passa da véspera da saída (23:59 no horário de Brasília).
--
-- - registrations.queued_at: ordem da lista de espera (antes era created_at).
-- - registrations.payment_due_at: prazo de quem está confirmado (gatilho calcula).
-- - registrations.promoted_at / released_at: quando subiu da fila / perdeu a vaga por prazo,
--   para o organizador avisar as pessoas.
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Depois, para liberar sozinho, agende no SQL Editor (precisa do pg_cron ligado):
--   select cron.schedule('routa-prazos', '*/15 * * * *', $$select private.process_payment_deadlines()$$);

alter table public.trips
  add column payment_deadline_hours smallint
    check (payment_deadline_hours in (24, 48, 72, 120)),
  add column payment_deadline_action text not null default 'notify'
    check (payment_deadline_action in ('notify', 'release'));

alter table public.registrations
  add column queued_at timestamptz,
  add column payment_due_at timestamptz,
  add column promoted_at timestamptz,
  add column released_at timestamptz;
update public.registrations set queued_at = created_at where queued_at is null;
alter table public.registrations
  alter column queued_at set default now(),
  alter column queued_at set not null;
create index registrations_queue on public.registrations (trip_id, status, queued_at);

-- =====================================================================
-- Prazo
-- =====================================================================

-- Prazo de quem confirma agora: agora + horas, no máximo até a véspera da saída.
-- Null se a viagem não tem prazo ou se já passou da véspera.
create or replace function private.payment_due(p_trip public.trips, p_from timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select case
    when p_trip.payment_deadline_hours is null then null
    when ((p_trip.start_date::timestamp) at time zone 'America/Sao_Paulo') - interval '1 minute' <= p_from
      then null
    else least(
      p_from + make_interval(hours => p_trip.payment_deadline_hours),
      ((p_trip.start_date::timestamp) at time zone 'America/Sao_Paulo') - interval '1 minute')
  end;
$$;

-- Ao virar confirmado, ganha prazo; ao sair de confirmado, perde.
create or replace function private.set_payment_due()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_trip public.trips;
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    select * into v_trip from public.trips where id = new.trip_id;
    new.payment_due_at := private.payment_due(v_trip, now());
  elsif new.status <> 'confirmed' then
    new.payment_due_at := null;
  end if;
  return new;
end $$;

create trigger registrations_payment_due
  before insert or update of status on public.registrations
  for each row execute function private.set_payment_due();

-- Mudou o prazo da viagem: quem está confirmado e não pagou passa a ter o prazo novo,
-- contado a partir de agora (ou fica sem prazo, se desligou).
create or replace function private.reset_payment_due()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.registrations
  set payment_due_at = private.payment_due(new, now())
  where trip_id = new.id and status = 'confirmed' and payment_status = 'pending';
  return null;
end $$;

create trigger trips_reset_payment_due
  after update of payment_deadline_hours on public.trips
  for each row
  when (old.payment_deadline_hours is distinct from new.payment_deadline_hours)
  execute function private.reset_payment_due();

-- =====================================================================
-- Fila: a ordem agora é queued_at; quem sobe ganha promoted_at
-- =====================================================================

create or replace function public.promote_waitlist(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_capacity int;
  v_free int;
begin
  select capacity into v_capacity from public.trips where id = p_trip_id for update;
  if not found then return; end if;

  select v_capacity - count(*) into v_free
  from public.registrations where trip_id = p_trip_id and status = 'confirmed';

  if v_free > 0 then
    update public.registrations set status = 'confirmed', promoted_at = now()
    where id in (
      select id from public.registrations
      where trip_id = p_trip_id and status = 'waitlist'
      order by queued_at, created_at
      limit v_free
    );
  end if;
end $$;

-- Libera a vaga de quem venceu o prazo: vai para o fim da fila e o primeiro da fila sobe.
-- Só libera se houver alguém esperando. Devolve o id de quem subiu (ou null).
create or replace function private.release_registration(p_registration_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_promoted uuid;
begin
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if not found or v_reg.status <> 'confirmed' or v_reg.payment_status <> 'pending'
     or v_reg.payment_due_at is null or v_reg.payment_due_at > now() then
    return null;
  end if;
  -- Trava a viagem para não liberar duas vezes ao mesmo tempo.
  perform 1 from public.trips where id = v_reg.trip_id for update;
  select id into v_promoted from public.registrations
  where trip_id = v_reg.trip_id and status = 'waitlist'
  order by queued_at, created_at limit 1;
  if v_promoted is null then
    return null;
  end if;

  update public.registrations
  set status = 'waitlist', queued_at = now(), released_at = now(), promoted_at = null
  where id = p_registration_id;
  perform public.promote_waitlist(v_reg.trip_id);
  return v_promoted;
end $$;

-- O organizador libera, com um clique, a vaga de quem venceu o prazo.
create or replace function public.release_overdue_registration(p_registration_id uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_promoted uuid;
begin
  if not exists (
    select 1 from public.registrations r join public.trips t on t.id = r.trip_id
    where r.id = p_registration_id and t.organizer_id = (select auth.uid())
  ) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.organizers where id = (select auth.uid()) and suspended_at is not null) then
    raise exception 'organizer_suspended';
  end if;
  v_promoted := private.release_registration(p_registration_id);
  if v_promoted is null then
    raise exception 'cannot_release';
  end if;
  return json_build_object('released', p_registration_id, 'promoted', v_promoted);
end $$;

-- Rodada automática (pg_cron): libera, nas viagens com 'release', quem venceu o prazo.
create or replace function private.process_payment_deadlines()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_reg record;
  v_count integer := 0;
begin
  for v_reg in
    select r.id
    from public.registrations r
    join public.trips t on t.id = r.trip_id
    join public.organizers o on o.id = t.organizer_id
    where t.payment_deadline_action = 'release'
      and t.status in ('published', 'closed')
      and t.admin_hidden_at is null
      and o.suspended_at is null
      and t.start_date > (now() at time zone 'America/Sao_Paulo')::date
      and r.status = 'confirmed' and r.payment_status = 'pending'
      and r.payment_due_at < now()
    order by r.payment_due_at
  loop
    if private.release_registration(v_reg.id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

revoke execute on function private.payment_due(public.trips, timestamptz) from public, anon, authenticated;
revoke execute on function private.set_payment_due() from public, anon, authenticated;
revoke execute on function private.reset_payment_due() from public, anon, authenticated;
revoke execute on function private.release_registration(uuid) from public, anon, authenticated;
revoke execute on function private.process_payment_deadlines() from public, anon, authenticated;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.release_overdue_registration(uuid) from public, anon;
grant execute on function public.release_overdue_registration(uuid) to authenticated;

-- =====================================================================
-- Página pública (diz o prazo) e inscrição (devolve o prazo de quem confirmou)
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
    -- Prazo para pagar (calculado pelo gatilho ao confirmar), ou null.
    'payment_due_at', (select payment_due_at from public.registrations where id = v_id),
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
