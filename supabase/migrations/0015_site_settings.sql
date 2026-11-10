-- Routa · 0015: aparência do site (Site Settings) e imagem do painel do clube.
--
-- 1. public.site_settings: uma linha só com o visual padrão da Routa (imagem do login,
--    imagem do painel e cor). Ninguém lê a tabela direto (o visitante não lê tabela nenhuma):
--    a leitura é pela função pública get_site_settings(); a gravação só pela
--    admin_update_site_settings(), que confere is_admin() e registra na auditoria.
-- 2. organizers.panel_image_path: foto da capa do painel do organizador (editada na Página
--    do clube). O RLS de organizers já deixa cada um alterar só o próprio cadastro.
-- 3. Storage: admin envia as imagens do site para trip-photos/site/.
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

-- ---------------------------------------------------------------------
-- 1. Site Settings
-- ---------------------------------------------------------------------

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  login_image_path text check (login_image_path ~ '^site/[A-Za-z0-9._-]{1,120}$'),
  panel_image_path text check (panel_image_path ~ '^site/[A-Za-z0-9._-]{1,120}$'),
  -- Cor principal (botões, links, destaques). Null = laranja Routa.
  brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.site_settings (id) values (1);

alter table public.site_settings enable row level security;
-- Sem policies: nem anon nem authenticated leem ou gravam direto.
revoke all on public.site_settings from anon, authenticated;

create or replace function public.get_site_settings()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'login_image_path', s.login_image_path,
    'panel_image_path', s.panel_image_path,
    'brand_color', s.brand_color,
    'updated_at', s.updated_at
  )
  from public.site_settings s
  where s.id = 1;
$$;
revoke execute on function public.get_site_settings() from public;
grant execute on function public.get_site_settings() to anon, authenticated;

-- Grava os três campos de uma vez (o app manda o estado completo do formulário).
-- Devolve os caminhos de imagem que deixaram de ser usados, para o app apagar do Storage.
create or replace function public.admin_update_site_settings(
  p_login_image_path text,
  p_panel_image_path text,
  p_brand_color text
)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_before public.site_settings;
  v_login text := nullif(trim(coalesce(p_login_image_path, '')), '');
  v_panel text := nullif(trim(coalesce(p_panel_image_path, '')), '');
  v_color text := lower(nullif(trim(coalesce(p_brand_color, '')), ''));
begin
  perform private.require_admin();

  if v_login is not null and v_login !~ '^site/[A-Za-z0-9._-]{1,120}$' then
    raise exception 'invalid_image';
  end if;
  if v_panel is not null and v_panel !~ '^site/[A-Za-z0-9._-]{1,120}$' then
    raise exception 'invalid_image';
  end if;
  if v_color is not null and v_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'invalid_color';
  end if;

  select * into v_before from public.site_settings where id = 1 for update;

  update public.site_settings
     set login_image_path = v_login,
         panel_image_path = v_panel,
         brand_color = v_color,
         updated_at = now(),
         updated_by = (select auth.uid())
   where id = 1;

  perform private.log_admin('site_settings_updated', 'site', null, jsonb_build_object(
    'login_image', jsonb_build_object('from', v_before.login_image_path, 'to', v_login),
    'panel_image', jsonb_build_object('from', v_before.panel_image_path, 'to', v_panel),
    'brand_color', jsonb_build_object('from', v_before.brand_color, 'to', v_color)
  ));

  return json_build_object('unused', (
    select coalesce(json_agg(p), '[]'::json)
    from unnest(array[v_before.login_image_path, v_before.panel_image_path]) p
    where p is not null and p is distinct from v_login and p is distinct from v_panel
  ));
end $$;
revoke execute on function public.admin_update_site_settings(text, text, text) from public, anon;
grant execute on function public.admin_update_site_settings(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Imagem do painel do organizador
-- ---------------------------------------------------------------------

alter table public.organizers
  add column panel_image_path text check (char_length(panel_image_path) <= 300);

-- ---------------------------------------------------------------------
-- 3. Storage: pasta site/ do bucket trip-photos, só para admin
-- (a leitura continua pública pela URL do bucket)
-- ---------------------------------------------------------------------

create policy "trip-photos: admin uploads site images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-photos'
              and (storage.foldername(name))[1] = 'site'
              and public.is_admin());

create policy "trip-photos: admin reads site images" on storage.objects
  for select to authenticated
  using (bucket_id = 'trip-photos'
         and (storage.foldername(name))[1] = 'site'
         and public.is_admin());

create policy "trip-photos: admin deletes site images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-photos'
         and (storage.foldername(name))[1] = 'site'
         and public.is_admin());
