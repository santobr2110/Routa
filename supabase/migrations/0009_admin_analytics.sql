-- Routa · análises detalhadas para a área de administração.
--
-- admin_analytics(p_days, p_bucket): séries por dia, semana ou mês no período escolhido,
-- totais com comparação ao período anterior e quebras por categoria (terreno, nível,
-- marcas de moto, destinos, antecedência, dia da semana, ocupação, rankings).
-- Só admin (is_admin, da 0007). Datas sempre no fuso de Brasília.
--
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

create or replace function public.admin_analytics(p_days int default 30, p_bucket text default 'day')
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 7), 730);
  v_bucket text := case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end;
  v_step interval;
  v_to date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from date;
  v_prev_from date;
  v_result json;
begin
  perform private.require_admin();
  v_from := v_to - (v_days - 1);
  v_prev_from := v_from - v_days;
  v_step := ('1 ' || v_bucket)::interval;

  with
  -- Eventos com a data local (Brasília) já calculada.
  u as (select (created_at at time zone 'America/Sao_Paulo')::date as d from auth.users),
  o as (select (created_at at time zone 'America/Sao_Paulo')::date as d from public.organizers),
  t as (
    select tr.*, (tr.created_at at time zone 'America/Sao_Paulo')::date as d
    from public.trips tr
  ),
  r as (
    select rg.*, tr.title, tr.destination, tr.start_date, tr.organizer_id, tr.capacity,
      (rg.created_at at time zone 'America/Sao_Paulo')::date as d,
      (rg.cancelled_at at time zone 'America/Sao_Paulo')::date as cd,
      private.registration_amount(tr, rg.has_pillion) as amount
    from public.registrations rg join public.trips tr on tr.id = rg.trip_id
  ),
  rp as (select * from r where d between v_from and v_to),
  tp as (select * from t where d between v_from and v_to),
  buckets as (
    select greatest(b::date, v_from) as start,
      least((b + v_step)::date - 1, v_to) as finish
    from generate_series(date_trunc(v_bucket, v_from::timestamp),
                         date_trunc(v_bucket, v_to::timestamp), v_step) b
  ),
  totals as (
    select
      (select count(*) from u where d between v_from and v_to) as signups,
      (select count(*) from o where d between v_from and v_to) as organizers,
      (select count(*) from t where d between v_from and v_to) as trips,
      (select count(*) from r where d between v_from and v_to) as registrations,
      (select count(*) from r where cd between v_from and v_to) as cancellations,
      (select coalesce(sum(amount), 0) from r where d between v_from and v_to and status = 'confirmed') as value_cents,
      (select coalesce(sum(amount), 0) from r where d between v_from and v_to and status = 'confirmed'
         and payment_status = 'paid') as paid_cents,
      (select count(*) from t where start_date between v_from and v_to and status in ('published', 'closed')) as departures
  ),
  prev as (
    select
      (select count(*) from u where d between v_prev_from and v_from - 1) as signups,
      (select count(*) from o where d between v_prev_from and v_from - 1) as organizers,
      (select count(*) from t where d between v_prev_from and v_from - 1) as trips,
      (select count(*) from r where d between v_prev_from and v_from - 1) as registrations,
      (select count(*) from r where cd between v_prev_from and v_from - 1) as cancellations,
      (select coalesce(sum(amount), 0) from r where d between v_prev_from and v_from - 1 and status = 'confirmed') as value_cents,
      (select coalesce(sum(amount), 0) from r where d between v_prev_from and v_from - 1 and status = 'confirmed'
         and payment_status = 'paid') as paid_cents,
      (select count(*) from t where start_date between v_prev_from and v_from - 1 and status in ('published', 'closed')) as departures
  ),
  open_trips as (
    select tr.id, tr.capacity,
      (select count(*) from public.registrations x where x.trip_id = tr.id and x.status = 'confirmed') as confirmed
    from public.trips tr
    where tr.status = 'published' and tr.start_date >= v_to and tr.admin_hidden_at is null
  )
  select json_build_object(
    'from', v_from,
    'to', v_to,
    'bucket', v_bucket,
    'days', v_days,
    'totals', (select row_to_json(totals) from totals),
    'previous', (select row_to_json(prev) from prev),
    'series', (
      select json_agg(json_build_object(
        'start', b.start,
        'finish', b.finish,
        'signups', (select count(*) from u where d between b.start and b.finish),
        'organizers', (select count(*) from o where d between b.start and b.finish),
        'trips', (select count(*) from t where d between b.start and b.finish),
        'registrations', (select count(*) from r where d between b.start and b.finish),
        'cancellations', (select count(*) from r where cd between b.start and b.finish),
        'value_cents', (select coalesce(sum(amount), 0) from r
                        where d between b.start and b.finish and status = 'confirmed'),
        'paid_cents', (select coalesce(sum(amount), 0) from r
                       where d between b.start and b.finish and status = 'confirmed' and payment_status = 'paid'),
        'users_total', (select count(*) from u where d <= b.finish),
        'organizers_total', (select count(*) from o where d <= b.finish),
        'trips_total', (select count(*) from t where d <= b.finish)
      ) order by b.start)
      from buckets b
    ),
    'breakdowns', json_build_object(
      'trips_by_terrain', (select coalesce(json_agg(json_build_object('key', terrain, 'value', n) order by n desc), '[]'::json)
                           from (select terrain, count(*) n from tp group by terrain) x),
      'trips_by_level', (select coalesce(json_agg(json_build_object('key', level, 'value', n) order by n desc), '[]'::json)
                         from (select level, count(*) n from tp group by level) x),
      'trips_by_status', (select coalesce(json_agg(json_build_object('key', status, 'value', n) order by n desc), '[]'::json)
                          from (select status, count(*) n from tp group by status) x),
      'trips_by_pricing', (select coalesce(json_agg(json_build_object('key', pricing_mode, 'value', n) order by n desc), '[]'::json)
                           from (select pricing_mode, count(*) n from tp group by pricing_mode) x),
      'registrations_by_status', (select coalesce(json_agg(json_build_object('key', status, 'value', n) order by n desc), '[]'::json)
                                  from (select status, count(*) n from rp group by status) x),
      'pillion', json_build_object(
        'with', (select count(*) from rp where has_pillion),
        'without', (select count(*) from rp where not has_pillion)),
      'payment', json_build_object(
        'paid', (select count(*) from rp where status = 'confirmed' and payment_status = 'paid'),
        'pending', (select count(*) from rp where status = 'confirmed' and payment_status = 'pending')),
      'bike_brands', (select coalesce(json_agg(json_build_object('key', brand, 'value', n) order by n desc, brand), '[]'::json)
                      from (select coalesce(bike_brand, initcap(split_part(trim(bike), ' ', 1))) brand, count(*) n
                            from rp where status <> 'cancelled' group by 1 order by 2 desc, 1 limit 10) x),
      'destinations', (select coalesce(json_agg(json_build_object('key', destination, 'value', n) order by n desc, destination), '[]'::json)
                       from (select destination, count(*) n from rp where status <> 'cancelled'
                             group by 1 order by 2 desc, 1 limit 10) x),
      'lead_time', (select json_agg(json_build_object('key', label, 'value', n) order by ord)
                    from (select b.ord, b.label,
                            (select count(*) from rp where (start_date - d) between b.lo and b.hi) n
                          from (values (1, '0–7 dias', 0, 7), (2, '8–14 dias', 8, 14), (3, '15–30 dias', 15, 30),
                                       (4, '31–60 dias', 31, 60), (5, 'mais de 60 dias', 61, 100000)) b(ord, label, lo, hi)) x),
      'weekday', (select json_agg(json_build_object('key', label, 'value', n) order by dow)
                  from (select w.dow, w.label,
                          (select count(*) from rp where extract(isodow from d) = w.dow) n
                        from (values (1, 'Seg'), (2, 'Ter'), (3, 'Qua'), (4, 'Qui'), (5, 'Sex'), (6, 'Sáb'), (7, 'Dom')) w(dow, label)) x),
      'occupancy', (select json_agg(json_build_object('key', label, 'value', n) order by ord)
                    from (select b.ord, b.label,
                            (select count(*) from open_trips ot
                             where (ot.confirmed * 100.0 / nullif(ot.capacity, 0)) >= b.lo
                               and (ot.confirmed * 100.0 / nullif(ot.capacity, 0)) < b.hi) n
                          from (values (1, '0–24%', 0, 25), (2, '25–49%', 25, 50), (3, '50–74%', 50, 75),
                                       (4, '75–99%', 75, 100), (5, 'Lotada', 100, 100000)) b(ord, label, lo, hi)) x)
    ),
    'top_organizers', (
      select coalesce(json_agg(x order by x.registrations desc, x.name), '[]'::json) from (
        select og.id, og.name,
          (select count(*) from public.trips tr where tr.organizer_id = og.id) as trips,
          count(rp.id) filter (where rp.status <> 'cancelled') as registrations,
          coalesce(sum(rp.amount) filter (where rp.status = 'confirmed'), 0) as value_cents,
          count(rp.id) filter (where rp.status = 'confirmed' and rp.payment_status = 'paid') as paid,
          count(rp.id) filter (where rp.status = 'confirmed') as confirmed
        from public.organizers og
        join rp on rp.organizer_id = og.id
        group by og.id, og.name
        order by registrations desc, og.name
        limit 10
      ) x
    ),
    'top_trips', (
      select coalesce(json_agg(x order by x.registrations desc, x.start_date), '[]'::json) from (
        select tr.id, tr.title, tr.destination, tr.start_date, tr.capacity, og.name as organizer_name,
          count(rp.id) filter (where rp.status <> 'cancelled') as registrations,
          (select count(*) from public.registrations x where x.trip_id = tr.id and x.status = 'confirmed') as confirmed,
          (select count(*) from public.registrations x where x.trip_id = tr.id and x.status = 'confirmed'
             and x.payment_status = 'paid') as paid
        from rp
        join public.trips tr on tr.id = rp.trip_id
        join public.organizers og on og.id = tr.organizer_id
        group by tr.id, tr.title, tr.destination, tr.start_date, tr.capacity, og.name
        order by registrations desc, tr.start_date
        limit 10
      ) x
    )
  ) into v_result;

  return v_result;
end $$;

revoke execute on function public.admin_analytics(int, text) from public, anon;
grant execute on function public.admin_analytics(int, text) to authenticated;
