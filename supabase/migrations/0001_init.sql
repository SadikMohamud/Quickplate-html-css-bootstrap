-- ZAAT loyalty schema
-- Stamp card model: append-only events, derived card state, RLS throughout.
-- Apply with: supabase db push, or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'staff', 'owner')),
  -- Unique opaque code shown as the customer's QR. Never the auth user id,
  -- so it can be regenerated if ever leaked without touching auth.
  card_code uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Role is customer, staff or owner.';

create table public.loyalty_settings (
  id uuid primary key default gen_random_uuid(),
  stamps_required int not null check (stamps_required between 1 and 50),
  reward_description text not null,
  active boolean not null default true,
  -- v2 stub: multi-location support. Unused in v1, always null.
  location_id uuid,
  updated_at timestamptz not null default now()
);

comment on table public.loyalty_settings is 'The stamp card rule. One active row in v1.';

create table public.stamp_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  staff_id uuid not null references public.profiles (id),
  event_type text not null check (event_type in ('stamp', 'redeem')),
  -- v2 stub: multi-location support. Unused in v1, always null.
  location_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.stamp_events is 'Append-only. One row per stamp earned or reward redeemed. Never updated or deleted.';

create index stamp_events_customer_idx on public.stamp_events (customer_id, created_at desc);

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------

-- Role of the calling user. Security definer so RLS policies can use it
-- without recursing into the profiles policies.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only the owner may change roles. auth.uid() is null for service or
-- SQL editor sessions, which stay allowed for bootstrapping.
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(public.current_user_role(), 'customer') <> 'owner' then
    raise exception 'Only the owner can change roles';
  end if;
  return new;
end;
$$;

create trigger protect_role_change
  before update on public.profiles
  for each row execute function public.protect_role_change();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger loyalty_settings_touch
  before update on public.loyalty_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Derived card state
-- ---------------------------------------------------------------

-- Progress is always derived from the event log. A redeem event closes
-- the current card and the next stamp starts a fresh one.
create view public.card_status
with (security_invoker = on)
as
with last_redeem as (
  select customer_id, max(created_at) as redeemed_at
  from public.stamp_events
  where event_type = 'redeem'
  group by customer_id
)
select
  p.id as customer_id,
  p.card_code,
  p.phone,
  p.email,
  p.display_name,
  count(e.id) filter (
    where e.event_type = 'stamp'
      and (lr.redeemed_at is null or e.created_at > lr.redeemed_at)
  ) as stamps_on_card,
  count(e.id) filter (where e.event_type = 'stamp') as lifetime_stamps,
  count(e.id) filter (where e.event_type = 'redeem') as rewards_redeemed,
  max(e.created_at) filter (where e.event_type = 'stamp') as last_stamp_at
from public.profiles p
left join last_redeem lr on lr.customer_id = p.id
left join public.stamp_events e on e.customer_id = p.id
where p.role = 'customer'
group by p.id, p.card_code, p.phone, p.email, p.display_name, lr.redeemed_at;

comment on view public.card_status is 'Derived card progress per customer. Security invoker, so RLS on the underlying tables applies.';

-- ---------------------------------------------------------------
-- Write path: RPCs only
-- ---------------------------------------------------------------

-- The only way stamps are granted. Verifies the caller is staff or owner,
-- guards against double scans, and refuses to overfill a completed card.
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

  if exists (
    select 1 from public.stamp_events
    where customer_id = p_customer_id
      and event_type = 'stamp'
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'A stamp was already added for this customer moments ago';
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

  if v_current >= v_required then
    raise exception 'This card is already complete. Redeem the reward first';
  end if;

  insert into public.stamp_events (customer_id, staff_id, event_type)
  values (p_customer_id, auth.uid(), 'stamp');

  return json_build_object(
    'stamps_on_card', v_current + 1,
    'stamps_required', v_required,
    'card_complete', v_current + 1 >= v_required
  );
end;
$$;

-- The only way rewards are redeemed. Requires a complete card.
create or replace function public.redeem_reward(p_customer_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_required int;
  v_reward text;
  v_current int;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff', 'owner') then
    raise exception 'Only staff can redeem rewards';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_customer_id::text));

  select stamps_required, reward_description into v_required, v_reward
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

  if v_current < v_required then
    raise exception 'Card is not complete yet (% of % stamps)', v_current, v_required;
  end if;

  insert into public.stamp_events (customer_id, staff_id, event_type)
  values (p_customer_id, auth.uid(), 'redeem');

  return json_build_object('redeemed', true, 'reward_description', v_reward);
end;
$$;

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.loyalty_settings enable row level security;
alter table public.stamp_events enable row level security;

-- The app never runs unauthenticated queries.
revoke all on public.profiles from anon;
revoke all on public.loyalty_settings from anon;
revoke all on public.stamp_events from anon;
revoke all on public.card_status from anon;

-- stamp_events is append-only and written only by the RPCs above,
-- which run as the function owner. No direct writes for anyone.
revoke insert, update, delete on public.stamp_events from authenticated;

-- Customers may only edit their display name. Role changes are gated by
-- the owner-only RLS policy plus the protect_role_change trigger.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, role) on public.profiles to authenticated;

revoke delete on public.loyalty_settings from authenticated;

grant select on public.card_status to authenticated;

-- profiles
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "staff read all profiles"
  on public.profiles for select
  using (public.current_user_role() in ('staff', 'owner'));

create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "owner update any profile"
  on public.profiles for update
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

-- loyalty_settings
create policy "authenticated read settings"
  on public.loyalty_settings for select
  using (auth.uid() is not null);

create policy "owner insert settings"
  on public.loyalty_settings for insert
  with check (public.current_user_role() = 'owner');

create policy "owner update settings"
  on public.loyalty_settings for update
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

-- stamp_events: read only, and only your own unless you are staff.
-- No insert, update or delete policies exist on purpose.
create policy "customer reads own events"
  on public.stamp_events for select
  using (customer_id = auth.uid());

create policy "staff read all events"
  on public.stamp_events for select
  using (public.current_user_role() in ('staff', 'owner'));

-- ---------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------

revoke execute on function public.add_stamp (uuid) from public, anon;
revoke execute on function public.redeem_reward (uuid) from public, anon;
revoke execute on function public.current_user_role () from public, anon;

grant execute on function public.add_stamp (uuid) to authenticated;
grant execute on function public.redeem_reward (uuid) to authenticated;
grant execute on function public.current_user_role () to authenticated;
