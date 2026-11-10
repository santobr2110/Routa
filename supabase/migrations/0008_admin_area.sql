-- Routa · área de administração geral.
--
-- - Métricas da plataforma (visão geral, funil, gráficos por semana).
-- - Lista e detalhe de usuários/organizadores e de viagens, feed de atividade.
-- - Moderação: suspender organizador (páginas e inscrições saem do ar) e tirar viagem do ar.
-- - Log de auditoria de toda ação de admin.
--
-- Tudo passa por funções que conferem is_admin() (tabela private.admins, da 0007).
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

-- =====================================================================
-- Moderação: colunas novas
-- =====================================================================

alter table public.organizers
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text check (char_length(suspended_reason) <= 500);

alter table public.trips
  add column if not exists admin_hidden_at timestamptz,
  add column if not exists admin_hidden_reason text check (char_length(admin_hidden_reason) <= 500);

-- O organizador edita o próprio perfil e as próprias viagens pela API, mas NÃO pode mexer
-- nas colunas de moderação. Pela API, current_user é "authenticated"; dentro das funções de
-- admin (security definer), é o dono das funções. O gatilho usa isso para proteger as colunas.
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
      else
        new.admin_hidden_at := old.admin_hidden_at;
        new.admin_hidden_reason := old.admin_hidden_reason;
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

drop trigger if exists organizers_protect_moderation on public.organizers;
create trigger organizers_protect_moderation before insert or update on public.organizers
  for each row execute function private.protect_moderation_columns();

drop trigger if exists trips_protect_moderation on public.trips;
create trigger trips_protect_moderation before insert or update on public.trips
  for each row execute function private.protect_moderation_columns();

-- Organizador suspenso não apaga o perfil (senão recriaria sem a suspensão).
create or replace function private.block_suspended_profile_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and old.suspended_at is not null then
    raise exception 'organizer_suspended';
  end if;
  return old;
end $$;

drop trigger if exists organizers_block_suspended_delete on public.organizers;
create trigger organizers_block_suspended_delete before delete on public.organizers
  for each row execute function private.block_suspended_profile_delete();

-- =====================================================================
-- Auditoria
-- =====================================================================

create table if not exists private.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created on private.admin_audit (created_at desc);
create index if not exists admin_audit_target on private.admin_audit (target_id);
revoke all on private.admin_audit from public, anon, authenticated;

create or replace function private.log_admin(
  p_action text, p_target_type text, p_target_id uuid, p_details jsonb default '{}'::jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into private.admin_audit (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function private.log_admin(text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
end $$;
revoke execute on function private.require_admin() from public, anon, authenticated;

-- Valor de uma inscrição (o mesmo cálculo do app: garupa paga o valor da dupla).
create or replace function private.registration_amount(p_trip public.trips, p_has_pillion boolean)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p_trip.pricing_mode <> 'fixed' then null
    when p_has_pillion then coalesce(p_trip.pillion_price_cents, p_trip.price_cents)
    else p_trip.price_cents end;
$$;

-- =====================================================================
-- Visão geral
-- =====================================================================

create or replace function public.admin_dashboard()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_result json;
begin
  perform private.require_admin();

  with
  regs as (
    select r.*, t.pricing_mode, private.registration_amount(t, r.has_pillion) as amount
    from public.registrations r join public.trips t on t.id = r.trip_id
  ),
  weeks as (
    select generate_series(
      date_trunc('week', now() at time zone 'America/Sao_Paulo') - interval '11 weeks',
      date_trunc('week', now() at time zone 'America/Sao_Paulo'),
      interval '1 week')::date as week
  ),
  upcoming as (
    select t.id, t.capacity,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'confirmed') as confirmed
    from public.trips t
    where t.status = 'published' and t.start_date >= v_today and t.admin_hidden_at is null
  )
  select json_build_object(
    'users', json_build_object(
      'total', (select count(*) from auth.users),
      'last_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'last_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days')
    ),
    'organizers', json_build_object(
      'total', (select count(*) from public.organizers),
      'suspended', (select count(*) from public.organizers where suspended_at is not null)
    ),
    'trips', json_build_object(
      'total', (select count(*) from public.trips),
      'draft', (select count(*) from public.trips where status = 'draft'),
      'published', (select count(*) from public.trips where status = 'published'),
      'closed', (select count(*) from public.trips where status = 'closed'),
      'upcoming_open', (select count(*) from upcoming),
      'hidden', (select count(*) from public.trips where admin_hidden_at is not null),
      'last_30d', (select count(*) from public.trips where created_at > now() - interval '30 days'),
      'avg_occupancy', (select round(avg(least(confirmed::numeric / nullif(capacity, 0), 1)) * 100)
                        from upcoming)
    ),
    'registrations', json_build_object(
      'total', (select count(*) from regs where status <> 'cancelled'),
      'confirmed', (select count(*) from regs where status = 'confirmed'),
      'waitlist', (select count(*) from regs where status = 'waitlist'),
      'cancelled', (select count(*) from regs where status = 'cancelled'),
      'paid', (select count(*) from regs where status = 'confirmed' and payment_status = 'paid'),
      'last_7d', (select count(*) from regs where created_at > now() - interval '7 days'),
      'last_30d', (select count(*) from regs where created_at > now() - interval '30 days')
    ),
    'money', json_build_object(
      'confirmed_cents', (select coalesce(sum(amount), 0) from regs where status = 'confirmed'),
      'paid_cents', (select coalesce(sum(amount), 0) from regs
                     where status = 'confirmed' and payment_status = 'paid')
    ),
    'funnel', json_build_object(
      'signed_up', (select count(*) from auth.users),
      'profile', (select count(*) from public.organizers),
      'created_trip', (select count(distinct organizer_id) from public.trips),
      'published_trip', (select count(distinct organizer_id) from public.trips
                         where status in ('published', 'closed')),
      'got_registration', (select count(distinct t.organizer_id) from public.trips t
                           where exists (select 1 from public.registrations r
                                         where r.trip_id = t.id and r.status <> 'cancelled'))
    ),
    'weekly', (
      select json_agg(json_build_object(
        'week', w.week,
        'signups', (select count(*) from auth.users u
                    where (u.created_at at time zone 'America/Sao_Paulo')::date >= w.week
                      and (u.created_at at time zone 'America/Sao_Paulo')::date < w.week + 7),
        'trips', (select count(*) from public.trips t
                  where (t.created_at at time zone 'America/Sao_Paulo')::date >= w.week
                    and (t.created_at at time zone 'America/Sao_Paulo')::date < w.week + 7),
        'registrations', (select count(*) from public.registrations r
                          where (r.created_at at time zone 'America/Sao_Paulo')::date >= w.week
                            and (r.created_at at time zone 'America/Sao_Paulo')::date < w.week + 7)
      ) order by w.week)
      from weeks w
    ),
    'seals', json_build_object(
      'pending', (select count(*) from public.cadastur_verifications where status = 'pending'),
      'active', (select count(distinct organizer_id) from public.cadastur_verifications
                 where status = 'approved' and valid_until >= v_today)
    ),
    -- Quem parou no meio do caminho (para chamar no WhatsApp).
    'stalled', (
      select coalesce(json_agg(x), '[]'::json) from (
        select u.id, u.email, o.name, o.whatsapp, u.created_at,
          case when o.id is null then 'no_profile' else 'no_trip' end as stage
        from auth.users u
        left join public.organizers o on o.id = u.id
        where not exists (select 1 from public.trips t where t.organizer_id = u.id)
          and u.created_at < now() - interval '1 day'
          and not exists (select 1 from private.admins a where a.user_id = u.id)
        order by u.created_at desc
        limit 10
      ) x
    )
  ) into v_result;

  return v_result;
end $$;

-- =====================================================================
-- Usuários e organizadores
-- =====================================================================

create or replace function public.admin_list_users(
  p_search text default null, p_limit int default 50, p_offset int default 0
)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
  v_result json;
begin
  perform private.require_admin();

  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
      o.name, o.whatsapp, o.suspended_at,
      (select count(*) from public.trips t where t.organizer_id = u.id) as trips,
      (select count(*) from public.trips t where t.organizer_id = u.id
         and t.status in ('published', 'closed')) as published_trips,
      (select count(*) from public.registrations r join public.trips t on t.id = r.trip_id
         where t.organizer_id = u.id and r.status <> 'cancelled') as registrations,
      exists (select 1 from public.cadastur_verifications v
              where v.organizer_id = u.id and v.status = 'approved'
                and v.valid_until >= (now() at time zone 'America/Sao_Paulo')::date) as has_seal,
      exists (select 1 from private.admins a where a.user_id = u.id) as is_admin
    from auth.users u
    left join public.organizers o on o.id = u.id
    where v_q is null
       or u.email ilike '%' || v_q || '%'
       or o.name ilike '%' || v_q || '%'
       or (v_digits is not null and length(v_digits) >= 4 and o.whatsapp like '%' || v_digits || '%')
  )
  select json_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select json_agg(b order by b.created_at desc)
      from (select * from base order by created_at desc
            limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) b
    ), '[]'::json)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_result json;
begin
  perform private.require_admin();

  select json_build_object(
    'id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'is_admin', exists (select 1 from private.admins a where a.user_id = u.id),
    'organizer', (select json_build_object(
        'name', o.name, 'whatsapp', o.whatsapp, 'created_at', o.created_at,
        'suspended_at', o.suspended_at, 'suspended_reason', o.suspended_reason)
      from public.organizers o where o.id = u.id),
    'trips', coalesce((
      select json_agg(json_build_object(
        'id', t.id, 'slug', t.slug, 'title', t.title, 'destination', t.destination,
        'start_date', t.start_date, 'end_date', t.end_date, 'status', t.status,
        'capacity', t.capacity, 'admin_hidden_at', t.admin_hidden_at,
        'confirmed', (select count(*) from public.registrations r
                      where r.trip_id = t.id and r.status = 'confirmed'),
        'waitlist', (select count(*) from public.registrations r
                     where r.trip_id = t.id and r.status = 'waitlist')
      ) order by t.start_date desc)
      from public.trips t where t.organizer_id = u.id
    ), '[]'::json),
    'seals', coalesce((
      select json_agg(json_build_object(
        'id', v.id, 'cnpj', v.cnpj, 'status', v.status, 'valid_until', v.valid_until,
        'created_at', v.created_at, 'reviewed_at', v.reviewed_at, 'reject_reason', v.reject_reason
      ) order by v.created_at desc)
      from public.cadastur_verifications v where v.organizer_id = u.id
    ), '[]'::json),
    'audit', coalesce((
      select json_agg(json_build_object(
        'action', a.action, 'details', a.details, 'created_at', a.created_at,
        'admin_email', (select email from auth.users x where x.id = a.admin_id)
      ) order by a.created_at desc)
      from private.admin_audit a where a.target_id = u.id
    ), '[]'::json)
  ) into v_result
  from auth.users u where u.id = p_user_id;

  return v_result;
end $$;

create or replace function public.admin_set_suspended(
  p_organizer_id uuid, p_suspend boolean, p_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_suspend and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required';
  end if;
  if p_suspend and p_organizer_id = (select auth.uid()) then
    raise exception 'cannot_suspend_self';
  end if;

  update public.organizers
  set suspended_at = case when p_suspend then now() end,
      suspended_reason = case when p_suspend then left(trim(p_reason), 500) end
  where id = p_organizer_id;
  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_admin(
    case when p_suspend then 'organizer_suspended' else 'organizer_reactivated' end,
    'organizer', p_organizer_id,
    case when p_suspend then jsonb_build_object('reason', left(trim(p_reason), 500)) else '{}'::jsonb end);
end $$;

-- =====================================================================
-- Viagens
-- =====================================================================

create or replace function public.admin_list_trips(
  p_search text default null,
  p_status text default 'all',     -- all | draft | published | closed | hidden
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
      and (coalesce(p_status, 'all') = 'all'
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

create or replace function public.admin_set_trip_hidden(
  p_trip_id uuid, p_hide boolean, p_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_hide and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required';
  end if;

  update public.trips
  set admin_hidden_at = case when p_hide then now() end,
      admin_hidden_reason = case when p_hide then left(trim(p_reason), 500) end
  where id = p_trip_id;
  if not found then
    raise exception 'not_found';
  end if;

  perform private.log_admin(
    case when p_hide then 'trip_hidden' else 'trip_restored' end,
    'trip', p_trip_id,
    case when p_hide then jsonb_build_object('reason', left(trim(p_reason), 500)) else '{}'::jsonb end);
end $$;

-- =====================================================================
-- Atividade recente e auditoria
-- =====================================================================

create or replace function public.admin_activity(p_limit int default 60)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_result json;
begin
  perform private.require_admin();

  select coalesce(json_agg(e order by e.at desc), '[]'::json) into v_result
  from (
    (select 'signup' as kind, u.created_at as at, u.id as user_id, null::uuid as trip_id,
            u.email as label, null::text as extra
     from auth.users u order by u.created_at desc limit p_limit)
    union all
    (select 'trip_created', t.created_at, t.organizer_id, t.id, t.title, o.name
     from public.trips t join public.organizers o on o.id = t.organizer_id
     order by t.created_at desc limit p_limit)
    union all
    (select 'registration', r.created_at, t.organizer_id, t.id, t.title, r.status
     from public.registrations r join public.trips t on t.id = r.trip_id
     order by r.created_at desc limit p_limit)
    union all
    (select 'seal_requested', v.created_at, v.organizer_id, null, o.name, v.status
     from public.cadastur_verifications v join public.organizers o on o.id = v.organizer_id
     order by v.created_at desc limit p_limit)
    order by at desc
    limit least(greatest(p_limit, 1), 200)
  ) e;
  return v_result;
end $$;

create or replace function public.admin_audit_log(p_limit int default 100)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((
    select json_agg(x order by x.created_at desc) from (
      select a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
        (select email from auth.users u where u.id = a.admin_id) as admin_email,
        case a.target_type
          when 'trip' then (select title from public.trips t where t.id = a.target_id)
          when 'organizer' then (select name from public.organizers o where o.id = a.target_id)
          when 'cadastur' then (select o.name from public.cadastur_verifications v
                                join public.organizers o on o.id = v.organizer_id
                                where v.id = a.target_id)
        end as target_label
      from private.admin_audit a
      order by a.created_at desc
      limit least(greatest(p_limit, 1), 500)
    ) x
  ), '[]'::json);
end $$;

create or replace function public.admin_list_admins()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((
    select json_agg(json_build_object('id', u.id, 'email', u.email) order by u.email)
    from private.admins a join auth.users u on u.id = a.user_id
  ), '[]'::json);
end $$;

-- =====================================================================
-- Selo Cadastur: a revisão agora também vai para a auditoria
-- =====================================================================

create or replace function public.admin_review_cadastur(
  p_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if not p_approve and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required';
  end if;

  update public.cadastur_verifications
  set status = case when p_approve then 'approved' else 'rejected' end,
      reject_reason = case when p_approve then null else left(trim(p_reason), 500) end,
      reviewed_at = now()
  where id = p_id and status = 'pending';

  if not found then
    raise exception 'not_pending';
  end if;

  perform private.log_admin(
    case when p_approve then 'cadastur_approved' else 'cadastur_rejected' end,
    'cadastur', p_id,
    case when p_approve then '{}'::jsonb else jsonb_build_object('reason', left(trim(p_reason), 500)) end);
end $$;


-- =====================================================================
-- Página pública e inscrição respeitam a moderação
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
    'organizer_whatsapp', case when v_status = 'confirmed' then v_org.whatsapp end
  );
end $$;


-- =====================================================================
-- Permissões
-- =====================================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_dashboard()',
    'public.admin_list_users(text, int, int)',
    'public.admin_user_detail(uuid)',
    'public.admin_set_suspended(uuid, boolean, text)',
    'public.admin_list_trips(text, text, text, int, int)',
    'public.admin_trip_detail(uuid)',
    'public.admin_set_trip_hidden(uuid, boolean, text)',
    'public.admin_activity(int)',
    'public.admin_audit_log(int)',
    'public.admin_list_admins()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke execute on function private.registration_amount(public.trips, boolean) from public, anon, authenticated;
revoke execute on function private.protect_moderation_columns() from public, anon, authenticated;
revoke execute on function private.block_suspended_profile_delete() from public, anon, authenticated;
