-- Allow several stamps in one visit (a customer buying for friends).
-- Remove the time-based anti-double-scan cooldown entirely; the till UI
-- now controls repeats (it pauses on a result and only adds another stamp
-- on an explicit tap), so the database simply records each requested
-- stamp. The advisory lock still serialises concurrent writes.

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
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff', 'owner') then
    raise exception 'Only staff can add stamps';
  end if;

  if not exists (select 1 from public.profiles where id = p_customer_id and role = 'customer') then
    raise exception 'Customer not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_customer_id::text));

  select stamps_required into v_required
  from public.loyalty_settings
  where active
  order by updated_at desc
  limit 1;

  if v_required is null then
    raise exception 'Loyalty rule is not configured yet';
  end if;

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
