-- Allow multiple stamps per day (the owner rewards repeat visits).
-- Replaces the once-per-calendar-day rule with a short cooldown that
-- only prevents the same visit being scanned twice by accident.

create or replace function public.add_stamp(p_customer_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_required int;
  v_current int;
  v_recent boolean;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff', 'owner') then
    raise exception 'Only staff can add stamps';
  end if;

  if not exists (select 1 from public.profiles where id = p_customer_id and role = 'customer') then
    raise exception 'Customer not found';
  end if;

  -- Serialise concurrent writes for the same customer.
  perform pg_advisory_xact_lock(hashtext(p_customer_id::text));

  select stamps_required into v_required
  from public.loyalty_settings
  where active
  order by updated_at desc
  limit 1;

  if v_required is null then
    raise exception 'Loyalty rule is not configured yet';
  end if;

  -- Stamps on the current (open) card.
  select count(*) into v_current
  from public.stamp_events e
  where e.customer_id = p_customer_id
    and e.event_type = 'stamp'
    and e.created_at > coalesce(
      (select max(created_at) from public.stamp_events
       where customer_id = p_customer_id and event_type = 'redeem'),
      '-infinity'::timestamptz
    );

  -- Card already full: signal that the reward is ready to redeem.
  if v_current >= v_required then
    return json_build_object(
      'status', 'complete',
      'stamps_on_card', v_current,
      'stamps_required', v_required,
      'card_complete', true
    );
  end if;

  -- Anti-double-scan only: block a second stamp within two minutes so a
  -- single visit is not counted twice. Later visits the same day still
  -- earn their own stamp.
  select exists (
    select 1 from public.stamp_events
    where customer_id = p_customer_id
      and event_type = 'stamp'
      and created_at > now() - interval '2 minutes'
  ) into v_recent;

  if v_recent then
    return json_build_object(
      'status', 'too_soon',
      'stamps_on_card', v_current,
      'stamps_required', v_required,
      'card_complete', false
    );
  end if;

  insert into public.stamp_events (customer_id, staff_id, event_type)
  values (p_customer_id, auth.uid(), 'stamp');

  return json_build_object(
    'status', 'stamped',
    'stamps_on_card', v_current + 1,
    'stamps_required', v_required,
    'card_complete', v_current + 1 >= v_required
  );
end;
$$;
