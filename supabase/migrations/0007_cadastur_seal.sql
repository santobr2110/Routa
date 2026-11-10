-- Routa · selo "Agente de turismo verificado – Cadastur" (semiautomático).
--
-- A API oficial do Cadastur é restrita a órgãos públicos, então a verificação final é humana:
-- o organizador envia CNPJ, número do certificado, validade e o arquivo do certificado;
-- a Routa confere o CNPJ automaticamente (BrasilAPI) e um admin aprova ou recusa.
-- O selo vale até a data de validade e some sozinho depois (conta na hora da leitura).
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- DEPOIS, cadastre você mesmo como admin (troque pelo e-mail com que você entra na Routa):
--
--   insert into private.admins (user_id)
--   select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
--   on conflict do nothing;

-- =====================================================================
-- Admins (esquema private, criado na 0006, não é exposto pela API)
-- =====================================================================

create table if not exists private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
revoke all on private.admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- =====================================================================
-- Pedidos de verificação
-- =====================================================================

create table public.cadastur_verifications (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  cnpj text not null check (cnpj ~ '^\d{14}$'),
  -- Número do certificado Cadastur, só letras e números.
  certificate_number text not null check (certificate_number ~ '^[0-9A-Z]{8,20}$'),
  valid_until date not null,
  -- Arquivo do certificado no bucket privado cadastur-certificates: {organizer_id}/{uuid}.ext
  certificate_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (char_length(reject_reason) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Um pedido pendente por vez.
create unique index cadastur_verifications_one_pending
  on public.cadastur_verifications (organizer_id) where status = 'pending';
create index cadastur_verifications_organizer on public.cadastur_verifications (organizer_id, created_at desc);

alter table public.cadastur_verifications enable row level security;

-- O organizador vê os próprios pedidos e cria pedidos pendentes. Não altera nem apaga:
-- quem aprova ou recusa é o admin, pela função admin_review_cadastur.
create policy "cadastur: organizer reads own" on public.cadastur_verifications
  for select to authenticated
  using (organizer_id = (select auth.uid()));

create policy "cadastur: organizer requests" on public.cadastur_verifications
  for insert to authenticated
  with check (
    organizer_id = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reject_reason is null
    and valid_until > (now() at time zone 'America/Sao_Paulo')::date
    and (storage.foldername(certificate_path))[1] = (select auth.uid())::text
  );

revoke update, delete on public.cadastur_verifications from anon, authenticated;

-- =====================================================================
-- Arquivos dos certificados (bucket privado)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cadastur-certificates', 'cadastur-certificates', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "cadastur-certificates: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cadastur-certificates'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cadastur-certificates: owner or admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'cadastur-certificates'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or (select public.is_admin())));

create policy "cadastur-certificates: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cadastur-certificates'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- Selo válido
-- =====================================================================

-- Selo do organizador: aprovado e dentro da validade (fuso de Brasília), ou null.
create or replace function public.organizer_cadastur_seal(p_organizer_id uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'valid_until', v.valid_until,
    'verified_at', v.reviewed_at
  )
  from public.cadastur_verifications v
  where v.organizer_id = p_organizer_id
    and v.status = 'approved'
    and v.valid_until >= (now() at time zone 'America/Sao_Paulo')::date
  order by v.valid_until desc
  limit 1;
$$;

-- Para o futuro modo Expedição (viagens comerciais): só quem tem selo válido.
create or replace function public.has_valid_cadastur(p_organizer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.organizer_cadastur_seal(p_organizer_id) is not null;
$$;

-- =====================================================================
-- Admin: listar e revisar
-- =====================================================================

create or replace function public.admin_list_cadastur(p_status text default 'pending')
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return coalesce((
    select json_agg(row_to_json(x) order by x.created_at)
    from (
      select v.id, v.organizer_id, v.cnpj, v.certificate_number, v.valid_until,
             v.certificate_path, v.status, v.reject_reason, v.reviewed_at, v.created_at,
             o.name as organizer_name, o.whatsapp as organizer_whatsapp,
             u.email as organizer_email
      from public.cadastur_verifications v
      join public.organizers o on o.id = v.organizer_id
      left join auth.users u on u.id = v.organizer_id
      where v.status = p_status
      order by v.created_at
      limit 100
    ) x
  ), '[]'::json);
end $$;

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
end $$;

revoke execute on function public.organizer_cadastur_seal(uuid) from public;
grant execute on function public.organizer_cadastur_seal(uuid) to anon, authenticated;
revoke execute on function public.has_valid_cadastur(uuid) from public;
grant execute on function public.has_valid_cadastur(uuid) to anon, authenticated;
revoke execute on function public.admin_list_cadastur(text) from public, anon;
grant execute on function public.admin_list_cadastur(text) to authenticated;
revoke execute on function public.admin_review_cadastur(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_cadastur(uuid, boolean, text) to authenticated;

-- =====================================================================
-- Página pública: mostra o selo do organizador
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
  where t.slug = p_slug and t.status in ('published', 'closed');
$$;

