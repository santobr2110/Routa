-- Routa · guarda uma cópia do termo de responsabilidade aceito em cada inscrição.
-- Assim o organizador pode editar o termo depois sem perder qual versão cada pessoa aceitou.
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

alter table public.registrations add column terms_text_accepted text;

-- Inscrições anteriores: não há como saber a versão aceita; fica o termo atual da viagem
-- como melhor aproximação (só existem inscrições de teste até aqui).
update public.registrations r
set terms_text_accepted = t.terms_text
from public.trips t
where t.id = r.trip_id and r.terms_text_accepted is null;

alter table public.registrations alter column terms_text_accepted set not null;

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
  v_has_pillion boolean := coalesce(p_has_pillion, false);
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

  -- Inscrições fecham no dia da saída: o último dia para se inscrever é a véspera.
  if v_trip.start_date <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'trip_not_open';
  end if;

  if v_has_pillion and not v_trip.accepts_pillion then
    raise exception 'pillion_not_accepted';
  end if;

  select count(*) into v_confirmed
  from public.registrations where trip_id = v_trip.id and status = 'confirmed';

  v_status := case when v_confirmed < v_trip.capacity then 'confirmed' else 'waitlist' end;

  begin
    insert into public.registrations (
      trip_id, name, whatsapp, email, bike, has_pillion, pillion_name,
      emergency_name, emergency_phone, terms_accepted_at, terms_text_accepted, status
    ) values (
      v_trip.id, trim(p_name), p_whatsapp, lower(trim(p_email)), trim(p_bike),
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
