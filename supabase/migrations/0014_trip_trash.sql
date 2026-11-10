-- Routa — lixeira de viagens (exclusão pelo organizador ou pela administração)
--
-- Excluir não apaga na hora: a viagem vai para a lixeira por 30 dias (deleted_at).
-- Enquanto estiver lá:
--   * some do painel do organizador, da página pública, da página do clube e das inscrições
--     (o RLS de trips passa a exigir deleted_at is null, e as tabelas filhas olham trips);
--   * o inscrito que abrir o link pessoal vê o aviso de viagem excluída, sem dados de pagamento;
--   * o organizador pode restaurar, a não ser que quem excluiu tenha sido a administração;
--   * a administração vê tudo (filtro "Lixeira") e pode restaurar qualquer uma.
-- Depois de 30 dias, private.purge_deleted_trips() apaga de vez (inscritos, fotos, avisos).
--
-- Agendar a limpeza (uma vez, no SQL Editor, depois de rodar esta migration):
--   select cron.schedule('routa-lixeira', '0 5 * * *', $$select private.purge_deleted_trips()$$);

-- =====================================================================
-- Colunas
-- =====================================================================

alter table public.trips
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null,
  add column if not exists deleted_by_admin boolean not null default false,
  add column if not exists deleted_reason text check (char_length(deleted_reason) <= 500);

create index if not exists trips_deleted_at_idx on public.trips (deleted_at)
  where deleted_at is not null;

-- =====================================================================
-- Permissões: excluir só pelas funções (antes o organizador conseguia dar DELETE direto
-- pela API e perdia tudo na hora). Viagens na lixeira ficam invisíveis para o organizador.
-- =====================================================================

revoke delete on public.trips from anon, authenticated;

drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips
  for all to authenticated
  using (organizer_id = (select auth.uid()) and deleted_at is null)
  with check (organizer_id = (select auth.uid()) and deleted_at is null);

-- Colunas da lixeira protegidas como as de moderação (cópia da 0008 + deleted_*).
create or replace function private.protect_moderation_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_table_name = 'organizers' then
      if tg_op = 'INSERT' then
        new.suspended_at := null;
        new.suspended_reason := null;
      else
        new.suspended_at := old.suspended_at;
        new.suspended_reason := old.suspended_reason;
      end if;
    elsif tg_table_name = 'trips' then
      if tg_op = 'INSERT' then
        new.admin_hidden_at := null;
        new.admin_hidden_reason := null;
        new.deleted_at := null;
        new.deleted_by := null;
        new.deleted_by_admin := false;
        new.deleted_reason := null;
      else
        new.admin_hidden_at := old.admin_hidden_at;
        new.admin_hidden_reason := old.admin_hidden_reason;
        -- Lixeira: só pelas funções delete_trip / restore_trip / admin_*.
        new.deleted_at := old.deleted_at;
        new.deleted_by := old.deleted_by;
        new.deleted_by_admin := old.deleted_by_admin;
        new.deleted_reason := old.deleted_reason;
      end if;
      -- Organizador suspenso não cria nem altera viagens.
      if exists (select 1 from public.organizers
                 where id = new.organizer_id and suspended_at is not null) then
        raise exception 'organizer_suspended';
      end if;
    end if;
  end if;
  return new;
end $$;


-- =====================================================================
-- Organizador: excluir, restaurar e ver a lixeira
-- (a senha e a palavra EXCLUIR são conferidas no servidor do app antes de chamar)
-- =====================================================================

create or replace function public.delete_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.organizers where id = v_uid and suspended_at is not null) then
    raise exception 'organizer_suspended';
  end if;

  update public.trips
  set deleted_at = now(), deleted_by = v_uid, deleted_by_admin = false, deleted_reason = null
  where id = p_trip_id and organizer_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'not_found';
  end if;
end $$;

create or replace function public.restore_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_trip public.trips;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.organizers where id = v_uid and suspended_at is not null) then
    raise exception 'organizer_suspended';
  end if;

  select * into v_trip from public.trips
  where id = p_trip_id and organizer_id = v_uid and deleted_at is not null
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  -- Excluída pela administração: só a administração restaura.
  if v_trip.deleted_by_admin then
    raise exception 'deleted_by_admin';
  end if;

  update public.trips
  set deleted_at = null, deleted_by = null, deleted_by_admin = false, deleted_reason = null
  where id = p_trip_id;
end $$;

-- Lixeira do organizador (inclui as excluídas pela administração, com o motivo).
create or replace function public.list_deleted_trips()
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
    'id', t.id,
    'title', t.title,
    'destination', t.destination,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'status', t.status,
    'deleted_at', t.deleted_at,
    'deleted_by_admin', t.deleted_by_admin,
    'deleted_reason', t.deleted_reason,
    'purge_at', t.deleted_at + interval '30 days',
    'confirmed', (select count(*) from public.registrations r
                  where r.trip_id = t.id and r.status = 'confirmed'),
    'waitlist', (select count(*) from public.registrations r
                 where r.trip_id = t.id and r.status = 'waitlist')
  ) order by t.deleted_at desc), '[]'::json)
  from public.trips t
  where t.organizer_id = (select auth.uid()) and t.deleted_at is not null;
$$;

-- =====================================================================
-- Administração: excluir (motivo obrigatório, fica na auditoria) e restaurar
-- =====================================================================

create or replace function public.admin_delete_trip(p_trip_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
begin
  perform private.require_admin();
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required';
  end if;

  update public.trips
  set deleted_at = now(), deleted_by = (select auth.uid()), deleted_by_admin = true,
      deleted_reason = left(trim(p_reason), 500)
  where id = p_trip_id and deleted_at is null
  returning title into v_title;
  if not found then
    raise exception 'not_found';
  end if;

  -- O título vai junto: depois da limpeza a viagem some, mas o registro fica legível.
  perform private.log_admin('trip_deleted', 'trip', p_trip_id,
    jsonb_build_object('reason', left(trim(p_reason), 500), 'title', v_title));
end $$;

create or replace function public.admin_restore_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();

  update public.trips
  set deleted_at = null, deleted_by = null, deleted_by_admin = false, deleted_reason = null
  where id = p_trip_id and deleted_at is not null;
  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_admin('trip_undeleted', 'trip', p_trip_id, '{}'::jsonb);
end $$;

create or replace function public.admin_list_trips(
  p_search text default null,
  p_status text default 'all',     -- all | draft | published | closed | hidden | deleted
  p_period text default 'all',     -- all | upcoming | past
  p_limit int default 50,
  p_offset int default 0
)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_result json;
begin
  perform private.require_admin();

  with base as (
    select t.id, t.slug, t.title, t.destination, t.start_date, t.end_date, t.status,
      t.capacity, t.pricing_mode, t.created_at, t.admin_hidden_at,
      t.deleted_at, t.deleted_by_admin,
      t.organizer_id, o.name as organizer_name, o.suspended_at as organizer_suspended_at,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'confirmed') as confirmed,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'waitlist') as waitlist,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'confirmed' and r.payment_status = 'paid') as paid
    from public.trips t
    join public.organizers o on o.id = t.organizer_id
    where (v_q is null or t.title ilike '%' || v_q || '%' or t.destination ilike '%' || v_q || '%'
           or o.name ilike '%' || v_q || '%' or t.slug ilike '%' || v_q || '%')
      -- A lixeira só aparece no filtro "deleted"; os outros filtros mostram só viagens ativas.
      and (case when p_status = 'deleted' then t.deleted_at is not null
                else t.deleted_at is null end)
      and (coalesce(p_status, 'all') in ('all', 'deleted')
           or (p_status = 'hidden' and t.admin_hidden_at is not null)
           or (p_status in ('draft', 'published', 'closed') and t.status = p_status))
      and (coalesce(p_period, 'all') = 'all'
           or (p_period = 'upcoming' and t.end_date >= v_today)
           or (p_period = 'past' and t.end_date < v_today))
  )
  select json_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select json_agg(b order by b.start_date desc)
      from (select * from base order by start_date desc
            limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) b
    ), '[]'::json)
  ) into v_result;
  return v_result;
end $$;


create or replace function public.admin_trip_detail(p_trip_id uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_result json;
begin
  perform private.require_admin();

  select json_build_object(
    'trip', json_build_object(
      'id', t.id, 'slug', t.slug, 'title', t.title, 'destination', t.destination,
      'start_date', t.start_date, 'end_date', t.end_date, 'status', t.status,
      'capacity', t.capacity, 'pricing_mode', t.pricing_mode, 'price_cents', t.price_cents,
      'pillion_price_cents', t.pillion_price_cents, 'level', t.level, 'terrain', t.terrain,
      'requires_plate', t.requires_plate, 'created_at', t.created_at, 'updated_at', t.updated_at,
      'admin_hidden_at', t.admin_hidden_at, 'admin_hidden_reason', t.admin_hidden_reason,
      'deleted_at', t.deleted_at, 'deleted_by_admin', t.deleted_by_admin,
      'deleted_reason', t.deleted_reason, 'purge_at', t.deleted_at + interval '30 days',
      'photos', (select count(*) from public.trip_photos p where p.trip_id = t.id)
    ),
    'organizer', json_build_object(
      'id', o.id, 'name', o.name, 'whatsapp', o.whatsapp, 'suspended_at', o.suspended_at,
      'email', (select email from auth.users u where u.id = o.id)
    ),
    -- Inscritos: só o necessário para suporte (sem contato de emergência nem placa).
    'registrations', coalesce((
      select json_agg(json_build_object(
        'name', r.name, 'bike', coalesce(nullif(trim(coalesce(r.bike_brand, '') || ' ' || coalesce(r.bike_model, '')), ''), r.bike),
        'has_pillion', r.has_pillion, 'status', r.status, 'payment_status', r.payment_status,
        'created_at', r.created_at, 'amount', private.registration_amount(t, r.has_pillion)
      ) order by r.created_at)
      from public.registrations r where r.trip_id = t.id
    ), '[]'::json),
    'audit', coalesce((
      select json_agg(json_build_object(
        'action', a.action, 'details', a.details, 'created_at', a.created_at,
        'admin_email', (select email from auth.users x where x.id = a.admin_id)
      ) order by a.created_at desc)
      from private.admin_audit a where a.target_id = t.id
    ), '[]'::json)
  ) into v_result
  from public.trips t
  join public.organizers o on o.id = t.organizer_id
  where t.id = p_trip_id;

  return v_result;
end $$;


-- =====================================================================
-- Limpeza: apaga de vez o que está na lixeira há mais de 30 dias
-- =====================================================================

-- Fotos no Storage não dá para apagar pelo SQL (só pela API de Storage). Os caminhos ficam
-- anotados aqui para uma limpeza futura; os arquivos são pequenos (JPEG redimensionado).
create table if not exists private.orphan_photos (
  storage_path text primary key,
  trip_id uuid not null,
  created_at timestamptz not null default now()
);

create or replace function private.purge_deleted_trips()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into private.orphan_photos (storage_path, trip_id)
  select p.storage_path, p.trip_id
  from public.trip_photos p
  join public.trips t on t.id = p.trip_id
  where t.deleted_at < now() - interval '30 days'
  on conflict do nothing;

  -- Inscritos, fotos e avisos vão junto (on delete cascade).
  delete from public.trips where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- =====================================================================
-- Funções que leem viagens: passam a ignorar a lixeira
-- (cópias das versões mais recentes + "deleted_at is null")
-- =====================================================================

-- Da 0012.
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
      and t.deleted_at is null
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


-- Da 0012.
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
    -- Viagem na lixeira: a página some.
    and t.deleted_at is null
    and o.suspended_at is null;
$$;


-- Da 0013.
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
    and deleted_at is null
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


-- Da 0013 (+ 'deleted' e sem pagamento quando excluída).
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
      -- Viagem excluída (na lixeira): a página avisa e esconde o pagamento.
      'deleted', v_trip.deleted_at is not null,
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
    'payment', case when v_confirmed and v_trip.deleted_at is null then json_build_object(
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


-- Da 0011.
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
      and t.deleted_at is null
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


-- =====================================================================
-- Permissões das funções novas
-- =====================================================================

revoke execute on function private.purge_deleted_trips() from public, anon, authenticated;
revoke all on table private.orphan_photos from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.delete_trip(uuid)',
    'public.restore_trip(uuid)',
    'public.list_deleted_trips()',
    'public.admin_delete_trip(uuid, text)',
    'public.admin_restore_trip(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
