-- Routa — Raio-X do comboio
--
-- Perguntas novas na inscrição (o organizador escolhe por viagem: desligada, opcional ou
-- obrigatória): autonomia da moto, experiência (faixas + terra) e habilidades (mecânica,
-- primeiros socorros, kit de ferramentas). Cilindrada e estilo vêm da tabela de modelos do
-- app (src/lib/bike-specs.ts); se o modelo não estiver lá, a pessoa escolhe a faixa.
-- O organizador informa o maior trecho sem posto. As respostas ficam em convoy_profiles
-- (1 por inscrição) e são gravadas só pela função save_convoy_profile, com o token do link
-- pessoal: na inscrição e depois, pela página do inscrito ("Complete seu Raio-X").
-- O organizador lê tudo (RLS); o inscrito vê só as próprias respostas e um resumo anônimo.

-- =====================================================================
-- Configuração por viagem
-- =====================================================================

alter table public.trips
  add column if not exists convoy_range text not null default 'optional'
    check (convoy_range in ('off', 'optional', 'required')),
  add column if not exists convoy_experience text not null default 'optional'
    check (convoy_experience in ('off', 'optional', 'required')),
  add column if not exists convoy_skills text not null default 'optional'
    check (convoy_skills in ('off', 'optional', 'required')),
  add column if not exists longest_stretch_km smallint
    check (longest_stretch_km between 10 and 2000);

-- =====================================================================
-- Respostas
-- =====================================================================

create table if not exists public.convoy_profiles (
  registration_id uuid primary key references public.registrations (id) on delete cascade,
  -- Autonomia com o tanque cheio, em km (null + range_unknown = "não sei").
  range_km smallint check (range_km between 30 and 2000),
  range_unknown boolean not null default false,
  experience text check (experience in ('first', 'some', 'experienced', 'veteran')),
  offroad text check (offroad in ('never', 'some', 'lots')),
  skills text[] not null default '{}'
    check (skills <@ array['mechanic', 'first_aid', 'toolkit']::text[]),
  -- Cilindrada da tabela de modelos (quando achou) e a faixa (sempre que souber).
  cc smallint check (cc between 50 and 3000),
  cc_band text check (cc_band in ('up_to_300', '300_700', '700_1000', 'over_1000')),
  style text check (style in ('street', 'trail', 'sport', 'custom', 'scooter', 'touring')),
  updated_at timestamptz not null default now(),
  check (not (range_unknown and range_km is not null))
);

alter table public.convoy_profiles enable row level security;

drop policy if exists "owner reads convoy profiles" on public.convoy_profiles;
create policy "owner reads convoy profiles" on public.convoy_profiles
  for select to authenticated
  using (exists (
    select 1 from public.registrations r
    join public.trips t on t.id = r.trip_id
    where r.id = registration_id and t.organizer_id = (select auth.uid())));

revoke all on public.convoy_profiles from anon, authenticated;
grant select on public.convoy_profiles to authenticated;

-- =====================================================================
-- Gravar (na inscrição e pelo link pessoal)
-- =====================================================================

create or replace function public.save_convoy_profile(
  p_token text,
  p_range_km integer,
  p_range_unknown boolean,
  p_experience text,
  p_offroad text,
  p_skills text[],
  p_cc integer,
  p_cc_band text,
  p_style text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations;
  v_trip public.trips;
  v_range smallint;
  v_unknown boolean;
  v_exp text;
  v_off text;
  v_skills text[];
  v_band text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found';
  end if;
  select * into v_reg from public.registrations where access_token = p_token;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_trip from public.trips where id = v_reg.trip_id;
  if v_reg.status = 'cancelled' or v_trip.deleted_at is not null
     or v_trip.end_date < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'closed';
  end if;

  -- Só guarda o que a viagem pergunta.
  v_range := case when v_trip.convoy_range <> 'off' and not coalesce(p_range_unknown, false)
                  then p_range_km end;
  v_unknown := v_trip.convoy_range <> 'off' and coalesce(p_range_unknown, false);
  v_exp := case when v_trip.convoy_experience <> 'off' then p_experience end;
  v_off := case when v_trip.convoy_experience <> 'off' then p_offroad end;
  v_skills := case when v_trip.convoy_skills <> 'off'
                   then array(select distinct s from unnest(coalesce(p_skills, '{}')) s order by s)
                   else '{}' end;

  if v_trip.convoy_range = 'required' and v_range is null and not v_unknown then
    raise exception 'required_missing';
  end if;
  if v_trip.convoy_experience = 'required' and (v_exp is null or v_off is null) then
    raise exception 'required_missing';
  end if;

  -- Faixa: da cilindrada quando veio da tabela; senão, a que a pessoa escolheu.
  v_band := case
    when p_cc is null then p_cc_band
    when p_cc <= 300 then 'up_to_300'
    when p_cc <= 700 then '300_700'
    when p_cc <= 1000 then '700_1000'
    else 'over_1000' end;

  insert into public.convoy_profiles as c
    (registration_id, range_km, range_unknown, experience, offroad, skills, cc, cc_band, style, updated_at)
  values (v_reg.id, v_range, v_unknown, v_exp, v_off, v_skills, p_cc, v_band, p_style, now())
  on conflict (registration_id) do update set
    range_km = excluded.range_km, range_unknown = excluded.range_unknown,
    experience = excluded.experience, offroad = excluded.offroad, skills = excluded.skills,
    cc = excluded.cc, cc_band = excluded.cc_band, style = excluded.style, updated_at = now();
end $$;

revoke execute on function public.save_convoy_profile(text, integer, boolean, text, text, text[], integer, text, text) from public;
grant execute on function public.save_convoy_profile(text, integer, boolean, text, text, text[], integer, text, text) to anon, authenticated;

-- =====================================================================
-- Resumo anônimo do grupo (para a página do inscrito): só contagens dos confirmados
-- =====================================================================

create or replace function private.convoy_summary(p_trip_id uuid)
returns json language sql stable security definer set search_path = '' as $$
  with g as (
    select c.* from public.registrations r
    left join public.convoy_profiles c on c.registration_id = r.id
    where r.trip_id = p_trip_id and r.status = 'confirmed'
  )
  select json_build_object(
    'bikes', (select count(*) from g),
    'answered', (select count(*) from g where g.updated_at is not null),
    'cc_bands', json_build_object(
      'up_to_300', (select count(*) from g where cc_band = 'up_to_300'),
      '300_700', (select count(*) from g where cc_band = '300_700'),
      '700_1000', (select count(*) from g where cc_band = '700_1000'),
      'over_1000', (select count(*) from g where cc_band = 'over_1000')),
    'experience', json_build_object(
      'first', (select count(*) from g where experience = 'first'),
      'some', (select count(*) from g where experience = 'some'),
      'experienced', (select count(*) from g where experience = 'experienced'),
      'veteran', (select count(*) from g where experience = 'veteran')),
    'skills', json_build_object(
      'mechanic', (select count(*) from g where 'mechanic' = any(skills)),
      'first_aid', (select count(*) from g where 'first_aid' = any(skills)),
      'toolkit', (select count(*) from g where 'toolkit' = any(skills))),
    'min_range_km', (select min(range_km) from g)
  );
$$;
revoke execute on function private.convoy_summary(uuid) from public, anon, authenticated;

-- =====================================================================
-- Página pública e página do inscrito (cópias da 0014 + Raio-X)
-- =====================================================================

-- Da 0014.
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
    -- Raio-X do comboio: quais perguntas a inscrição faz (off | optional | required).
    'convoy', json_build_object(
      'range', t.convoy_range, 'experience', t.convoy_experience, 'skills', t.convoy_skills,
      'longest_stretch_km', t.longest_stretch_km),
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


-- Da 0014.
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
      'bike_brand', v_reg.bike_brand,
      'bike_model', v_reg.bike_model,
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
    -- Raio-X: perguntas da viagem, as respostas da própria pessoa e o resumo anônimo do grupo.
    'convoy', json_build_object(
      'range', v_trip.convoy_range, 'experience', v_trip.convoy_experience,
      'skills', v_trip.convoy_skills, 'longest_stretch_km', v_trip.longest_stretch_km,
      'can_edit', v_reg.status <> 'cancelled' and v_trip.deleted_at is null
        and v_trip.end_date >= (now() at time zone 'America/Sao_Paulo')::date,
      'profile', (select json_build_object(
          'range_km', c.range_km, 'range_unknown', c.range_unknown, 'experience', c.experience,
          'offroad', c.offroad, 'skills', c.skills, 'cc', c.cc, 'cc_band', c.cc_band,
          'updated_at', c.updated_at)
        from public.convoy_profiles c where c.registration_id = v_reg.id),
      'summary', case when v_reg.status <> 'cancelled' then private.convoy_summary(v_trip.id) end
    ),
    'updates', case when v_reg.status <> 'cancelled' then coalesce((
      select json_agg(json_build_object('id', u.id, 'body', u.body, 'created_at', u.created_at)
                      order by u.created_at desc)
      from public.trip_updates u where u.trip_id = v_trip.id), '[]'::json) else '[]'::json end
  );
end $$;

