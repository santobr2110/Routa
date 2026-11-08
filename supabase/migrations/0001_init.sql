-- Routa · migration inicial
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar uma vez só, num projeto vazio.

-- =====================================================================
-- Tabelas
-- =====================================================================

create table public.organizers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^55\d{10,11}$'),
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 3 and 100),
  destination text not null check (char_length(destination) between 2 and 80),
  description text not null default '',
  start_date date not null,
  end_date date not null,
  meeting_point text not null,
  meeting_point_url text,
  pricing_mode text not null check (pricing_mode in ('fixed', 'split')),
  price_cents integer check (price_cents >= 0),
  level text not null check (level in ('beginner', 'intermediate', 'experienced')),
  terrain text not null check (terrain in ('asphalt', 'mixed', 'offroad')),
  capacity integer not null check (capacity between 1 and 500),
  pix_key text not null,
  terms_text text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((pricing_mode = 'fixed') = (price_cents is not null))
);
create index on public.trips (organizer_id);

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 0 and 4), -- máx. 5 fotos
  unique (trip_id, position)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^55\d{10,11}$'),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  bike text not null check (char_length(bike) between 2 and 80),
  has_pillion boolean not null default false,
  pillion_name text,
  emergency_name text not null check (char_length(emergency_name) between 2 and 80),
  emergency_phone text not null check (emergency_phone ~ '^55\d{10,11}$'),
  terms_accepted_at timestamptz not null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  status text not null check (status in ('confirmed', 'waitlist', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (not has_pillion or char_length(coalesce(pillion_name, '')) >= 2)
);
-- Um WhatsApp só pode ter uma inscrição ativa por viagem.
create unique index registrations_one_per_whatsapp
  on public.registrations (trip_id, whatsapp) where status <> 'cancelled';
-- A ordem da lista de espera é a ordem de chegada (created_at).
create index on public.registrations (trip_id, status, created_at);

-- =====================================================================
-- Row Level Security
-- Visitante (anon) não tem nenhuma policy: não lê nem escreve tabela nenhuma.
-- A página pública e a inscrição passam pelas funções lá embaixo.
-- =====================================================================

alter table public.organizers enable row level security;
alter table public.trips enable row level security;
alter table public.trip_photos enable row level security;
alter table public.registrations enable row level security;

create policy "own profile" on public.organizers
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own trips" on public.trips
  for all to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

create policy "own trip photos" on public.trip_photos
  for all to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_id and t.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t
                      where t.id = trip_id and t.organizer_id = (select auth.uid())));

create policy "owner reads registrations" on public.registrations
  for select to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_id and t.organizer_id = (select auth.uid())));

create policy "owner updates registrations" on public.registrations
  for update to authenticated
  using (exists (select 1 from public.trips t
                 where t.id = trip_id and t.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t
                      where t.id = trip_id and t.organizer_id = (select auth.uid())));

-- O organizador só altera o status de pagamento direto na tabela.
-- Cancelar passa pela função cancel_registration.
revoke insert, update, delete on public.registrations from anon, authenticated;
grant update (payment_status) on public.registrations to authenticated;

-- =====================================================================
-- updated_at automático
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Funções
-- =====================================================================

-- Promove os mais antigos da lista de espera até preencher as vagas livres.
-- Uso interno (ninguém de fora pode chamar).
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
    update public.registrations set status = 'confirmed'
    where id in (
      select id from public.registrations
      where trip_id = p_trip_id and status = 'waitlist'
      order by created_at
      limit v_free
    );
  end if;
end $$;

-- Dados públicos da viagem, sem a chave Pix e sem dados de inscritos.
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
    'meeting_point', t.meeting_point,
    'meeting_point_url', t.meeting_point_url,
    'pricing_mode', t.pricing_mode,
    'price_cents', t.price_cents,
    'level', t.level,
    'terrain', t.terrain,
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

-- Inscrição sem login. Trava a viagem para duas pessoas não pegarem a última vaga.
-- A chave Pix e o WhatsApp do organizador só voltam para quem ficou confirmado.
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

  select count(*) into v_confirmed
  from public.registrations where trip_id = v_trip.id and status = 'confirmed';

  v_status := case when v_confirmed < v_trip.capacity then 'confirmed' else 'waitlist' end;

  begin
    insert into public.registrations (
      trip_id, name, whatsapp, email, bike, has_pillion, pillion_name,
      emergency_name, emergency_phone, terms_accepted_at, status
    ) values (
      v_trip.id, trim(p_name), p_whatsapp, lower(trim(p_email)), trim(p_bike),
      coalesce(p_has_pillion, false),
      case when p_has_pillion then nullif(trim(p_pillion_name), '') end,
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
    'price_cents', v_trip.price_cents,
    'has_pillion', coalesce(p_has_pillion, false),
    'organizer_name', v_org.name,
    'pix_key', case when v_status = 'confirmed' then v_trip.pix_key end,
    'organizer_whatsapp', case when v_status = 'confirmed' then v_org.whatsapp end
  );
end $$;

-- O organizador remove um inscrito; a primeira pessoa da lista de espera sobe.
create or replace function public.cancel_registration(p_registration_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_trip_id uuid;
begin
  select r.trip_id into v_trip_id
  from public.registrations r
  join public.trips t on t.id = r.trip_id
  where r.id = p_registration_id
    and t.organizer_id = (select auth.uid())
    and r.status <> 'cancelled';
  if not found then
    raise exception 'not_found';
  end if;

  update public.registrations
  set status = 'cancelled', cancelled_at = now()
  where id = p_registration_id;

  perform public.promote_waitlist(v_trip_id);
end $$;

-- Capacidade: não deixa reduzir abaixo dos confirmados; se aumentar, promove a fila.
create or replace function public.check_trip_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_confirmed int;
begin
  select count(*) into v_confirmed
  from public.registrations where trip_id = new.id and status = 'confirmed';
  if new.capacity < v_confirmed then
    raise exception 'capacity_below_confirmed';
  end if;
  return new;
end $$;

create or replace function public.after_trip_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity > old.capacity then
    perform public.promote_waitlist(new.id);
  end if;
  return null;
end $$;

create trigger trips_check_capacity before update of capacity on public.trips
  for each row execute function public.check_trip_capacity();
create trigger trips_after_capacity after update of capacity on public.trips
  for each row execute function public.after_trip_capacity();

-- Quem pode chamar o quê
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.check_trip_capacity() from public, anon, authenticated;
revoke execute on function public.after_trip_capacity() from public, anon, authenticated;
revoke execute on function public.cancel_registration(uuid) from public, anon;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.get_public_trip(text) to anon, authenticated;
grant execute on function public.register_for_trip(
  text, text, text, text, text, boolean, text, text, text, boolean
) to anon, authenticated;

-- =====================================================================
-- Storage: fotos das viagens
-- Caminho do arquivo: {organizer_id}/{trip_id}/{nome}.jpg
-- Leitura pública (bucket público); upload e exclusão só na pasta do próprio organizador.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

create policy "trip-photos: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "trip-photos: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
