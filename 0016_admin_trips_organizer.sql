-- Routa — lista de viagens do admin mostra de quem é cada viagem
--
-- admin_list_trips passa a devolver o e-mail do organizador e o nome do clube (quando a
-- página do clube está ligada), e a busca também procura por e-mail e nome do clube.
-- Cópia da versão da 0014 com essas mudanças.

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
      u.email as organizer_email,
      case when o.page_enabled then o.page_name end as organizer_club,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'confirmed') as confirmed,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'waitlist') as waitlist,
      (select count(*) from public.registrations r
       where r.trip_id = t.id and r.status = 'confirmed' and r.payment_status = 'paid') as paid
    from public.trips t
    join public.organizers o on o.id = t.organizer_id
    left join auth.users u on u.id = t.organizer_id
    where (v_q is null or t.title ilike '%' || v_q || '%' or t.destination ilike '%' || v_q || '%'
           or o.name ilike '%' || v_q || '%' or t.slug ilike '%' || v_q || '%'
           or u.email ilike '%' || v_q || '%' or o.page_name ilike '%' || v_q || '%')
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

