-- Many reward milestones per card.
--
-- Replaces the single "stamps required plus reward" rule with a rule that
-- owns an ordered set of milestones. ZAAT runs a ten stamp card with a free
-- wrap at four and a free meal at ten.
--
-- The card cycle used to be "everything since the last redeem event". That
-- breaks with several milestones, because redeeming the wrap at four must
-- not wipe the card. Instead every event now carries the cycle it belongs
-- to, written once at insert and never updated. Only redeeming the final
-- milestone advances the cycle, which is what resets the card.

-- ---------------------------------------------------------------
-- Rules and milestones
-- ---------------------------------------------------------------

create table public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_stamps int not null check (total_stamps between 1 and 50),
  active boolean not null default true,
  -- v2 stub: multi-location support. Unused in v1, always null.
  location_id uuid,
  updated_at timestamptz not null default now()
);

comment on table public.loyalty_rules is 'A stamp card design. One active row at a time.';

-- Exactly one active rule. Partial index, so inactive history is unlimited.
create unique index loyalty_rules_one_active
  on public.loyalty_rules (active)
  where active;

create trigger loyalty_rules_touch
  before update on public.loyalty_rules
  for each row execute function public.touch_updated_at();

create table public.loyalty_milestones (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.loyalty_rules (id) on delete cascade,
  stamps_required int not null check (stamps_required > 0),
  reward_label text not null,
  sort_order int not null default 0,
  unique (rule_id, stamps_required)
);

comment on table public.loyalty_milestones is 'A reward earned at a stamp count. The milestone with the highest stamps_required closes the card when redeemed.';

create index loyalty_milestones_rule_idx
  on public.loyalty_milestones (rule_id, stamps_required);

-- A milestone can never sit beyond the end of its own card. Checked from
-- both sides, so shrinking a rule cannot strand a milestone either.
create or replace function public.check_milestone_bounds()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total int;
  v_max int;
begin
  if tg_table_name = 'loyalty_milestones' then
    select total_stamps into v_total
    from public.loyalty_rules where id = new.rule_id;
    if new.stamps_required > v_total then
      raise exception 'Milestone at % stamps exceeds the card size of %',
        new.stamps_required, v_total;
    end if;
  else
    select max(stamps_required) into v_max
    from public.loyalty_milestones where rule_id = new.id;
    if v_max is not null and v_max > new.total_stamps then
      raise exception 'Card size of % is smaller than the last milestone at % stamps',
        new.total_stamps, v_max;
    end if;
  end if;
  return new;
end;
$$;

create trigger loyalty_milestones_bounds
  before insert or update on public.loyalty_milestones
  for each row execute function public.check_milestone_bounds();

create trigger loyalty_rules_bounds
  before update on public.loyalty_rules
  for each row execute function public.check_milestone_bounds();

-- ---------------------------------------------------------------
-- Carry the old single rule across
-- ---------------------------------------------------------------

do $$
declare
  v_rule uuid;
  v_settings record;
begin
  select stamps_required, reward_description into v_settings
  from public.loyalty_settings
  where active
  order by updated_at desc
  limit 1;

  if found then
    insert into public.loyalty_rules (name, total_stamps)
    values ('Stamp card', v_settings.stamps_required)
    returning id into v_rule;

    insert into public.loyalty_milestones (rule_id, stamps_required, reward_label, sort_order)
    values (v_rule, v_settings.stamps_required, v_settings.reward_description, 1);
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Events gain a milestone, a batch and a cycle
-- ---------------------------------------------------------------

alter table public.stamp_events
  -- Which reward a redeem event claimed. Null on stamp events.
  add column milestone_id uuid references public.loyalty_milestones (id),
  -- Groups the rows written by one staff action, and doubles as the
  -- idempotency key so a retried request cannot stamp twice.
  add column batch_id uuid not null default gen_random_uuid(),
  -- Which run of the card this event belongs to. Set at insert, never updated.
  add column cycle int not null default 0;

-- Backfill: each event sits in a cycle numbered by how many redeems came
-- before it. Under the old single-milestone rule every redeem closed the
-- card, so this reproduces the previous behaviour exactly.
update public.stamp_events e
set cycle = (
  select count(*)
  from public.stamp_events r
  where r.customer_id = e.customer_id
    and r.event_type = 'redeem'
    and r.created_at < e.created_at
);

-- Point historic redeems at the migrated milestone.
update public.stamp_events e
set milestone_id = (
  select m.id
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id and r.active
  order by m.stamps_required desc
  limit 1
)
where e.event_type = 'redeem'
  and e.milestone_id is null;

alter table public.stamp_events
  add constraint stamp_events_redeem_has_milestone
  check ((event_type = 'redeem') = (milestone_id is not null));

-- A milestone can be claimed once per cycle. This is what makes a redeem
-- impossible to replay: a repeated call hits the index, not a code path.
create unique index stamp_events_redeem_once
  on public.stamp_events (customer_id, milestone_id, cycle)
  where event_type = 'redeem';

create index stamp_events_cycle_idx
  on public.stamp_events (customer_id, cycle, event_type);

create index stamp_events_batch_idx on public.stamp_events (batch_id);

-- ---------------------------------------------------------------
-- Cycle helper
-- ---------------------------------------------------------------

-- The cycle a new event belongs to. Advances only once the final
-- milestone of the active rule has been redeemed.
--
-- Security definer with execute revoked below: this is internal to the
-- write RPCs, never called by a client. The card_status view repeats the
-- same rule inline, because a view cannot call a function its caller may
-- not execute. Keep the two in step.
create or replace function public.card_cycle(p_customer_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max int;
  v_final uuid;
begin
  select coalesce(max(cycle), 0) into v_max
  from public.stamp_events
  where customer_id = p_customer_id;

  select m.id into v_final
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id and r.active
  order by m.stamps_required desc
  limit 1;

  if v_final is not null and exists (
    select 1 from public.stamp_events
    where customer_id = p_customer_id
      and event_type = 'redeem'
      and cycle = v_max
      and milestone_id = v_final
  ) then
    return v_max + 1;
  end if;

  return v_max;
end;
$$;

-- ---------------------------------------------------------------
-- Derived card state
-- ---------------------------------------------------------------

drop view public.card_status;

create view public.card_status
with (security_invoker = on)
as
with active_rule as (
  select
    r.id,
    r.total_stamps,
    (
      select m.id from public.loyalty_milestones m
      where m.rule_id = r.id
      order by m.stamps_required desc
      limit 1
    ) as final_milestone_id
  from public.loyalty_rules r
  where r.active
  limit 1
),
tally as (
  select
    e.customer_id,
    max(e.cycle) as max_cycle,
    count(*) filter (where e.event_type = 'stamp') as lifetime_stamps,
    count(*) filter (where e.event_type = 'redeem') as rewards_redeemed,
    max(e.created_at) filter (where e.event_type = 'stamp') as last_stamp_at
  from public.stamp_events e
  group by e.customer_id
),
current_cycle as (
  -- Mirrors public.card_cycle. Kept inline so the view stays usable by
  -- any authenticated caller under their own row-level security.
  select
    t.customer_id,
    case
      when exists (
        select 1 from public.stamp_events r
        cross join active_rule ar
        where r.customer_id = t.customer_id
          and r.event_type = 'redeem'
          and r.cycle = t.max_cycle
          and r.milestone_id = ar.final_milestone_id
      ) then t.max_cycle + 1
      else t.max_cycle
    end as cycle
  from tally t
)
select
  p.id as customer_id,
  p.card_code,
  p.phone,
  p.email,
  p.display_name,
  coalesce(c.cycle, 0) as cycle,
  (
    select count(*)
    from public.stamp_events s
    where s.customer_id = p.id
      and s.event_type = 'stamp'
      and s.cycle = coalesce(c.cycle, 0)
  ) as stamps_on_card,
  coalesce(t.lifetime_stamps, 0) as lifetime_stamps,
  coalesce(t.rewards_redeemed, 0) as rewards_redeemed,
  t.last_stamp_at
from public.profiles p
left join tally t on t.customer_id = p.id
left join current_cycle c on c.customer_id = p.id
where p.role = 'customer';

comment on view public.card_status is 'Derived card progress per customer for the current cycle. Security invoker, so row-level security on the underlying tables applies.';

-- Every milestone on the active rule, with whether this customer has
-- earned it and whether they have already claimed it this cycle.
create view public.card_milestones
with (security_invoker = on)
as
select
  cs.customer_id,
  m.id as milestone_id,
  m.stamps_required,
  m.reward_label,
  m.sort_order,
  cs.stamps_on_card >= m.stamps_required as earned,
  exists (
    select 1 from public.stamp_events e
    where e.customer_id = cs.customer_id
      and e.event_type = 'redeem'
      and e.milestone_id = m.id
      and e.cycle = cs.cycle
  ) as redeemed
from public.card_status cs
cross join (
  select m.*
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id
  where r.active
) m;

comment on view public.card_milestones is 'Per customer milestone progress for the current cycle.';

-- ---------------------------------------------------------------
-- Write path: RPCs only
-- ---------------------------------------------------------------

drop function public.add_stamp (uuid);
drop function public.redeem_reward (uuid);

-- Milestones this customer has earned but not yet claimed in this cycle.
-- Used by the till to offer the right reward straight after a stamp.
create or replace function public.claimable_milestones(
  p_customer_id uuid,
  p_cycle int,
  p_stamps int
)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', m.id,
        'stamps_required', m.stamps_required,
        'reward_label', m.reward_label
      )
      order by m.stamps_required
    ),
    '[]'::json
  )
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id and r.active
  where m.stamps_required <= p_stamps
    and not exists (
      select 1 from public.stamp_events e
      where e.customer_id = p_customer_id
        and e.event_type = 'redeem'
        and e.milestone_id = m.id
        and e.cycle = p_cycle
    );
$$;

-- The only way stamps are granted. One main item earns one stamp; staff
-- may grant several at once, and each one is still written as its own
-- append-only row sharing a batch id.
create or replace function public.add_stamps(
  p_customer_id uuid,
  p_quantity int default 1,
  p_request_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_rule_id uuid;
  v_total int;
  v_cycle int;
  v_current int;
  v_room int;
  v_granted int;
  v_batch uuid;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff', 'owner') then
    raise exception 'Only staff can add stamps';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be a whole number between 1 and 20';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_customer_id and role = 'customer'
  ) then
    raise exception 'Customer not found';
  end if;

  -- Serialise concurrent writes for the same customer.
  perform pg_advisory_xact_lock(hashtext(p_customer_id::text));

  select r.id, r.total_stamps into v_rule_id, v_total
  from public.loyalty_rules r
  where r.active
  limit 1;

  if v_rule_id is null then
    raise exception 'Loyalty rule is not configured yet';
  end if;

  v_cycle := public.card_cycle(p_customer_id);

  -- Idempotency: a retried or double-tapped request replays its result
  -- instead of stamping again.
  if p_request_id is not null and exists (
    select 1 from public.stamp_events
    where batch_id = p_request_id and event_type = 'stamp'
  ) then
    select count(*) into v_current
    from public.stamp_events
    where customer_id = p_customer_id
      and event_type = 'stamp'
      and cycle = v_cycle;

    return json_build_object(
      'status', 'duplicate',
      'granted', 0,
      'requested', p_quantity,
      'stamps_on_card', v_current,
      'total_stamps', v_total,
      'card_complete', v_current >= v_total,
      'claimable', public.claimable_milestones(p_customer_id, v_cycle, v_current)
    );
  end if;

  select count(*) into v_current
  from public.stamp_events
  where customer_id = p_customer_id
    and event_type = 'stamp'
    and cycle = v_cycle;

  v_room := v_total - v_current;

  -- Card already full: nothing to add until a reward is claimed.
  if v_room <= 0 then
    return json_build_object(
      'status', 'complete',
      'granted', 0,
      'requested', p_quantity,
      'stamps_on_card', v_current,
      'total_stamps', v_total,
      'card_complete', true,
      'claimable', public.claimable_milestones(p_customer_id, v_cycle, v_current)
    );
  end if;

  v_granted := least(p_quantity, v_room);
  v_batch := coalesce(p_request_id, gen_random_uuid());

  -- One row per stamp. Never a counter.
  insert into public.stamp_events (customer_id, staff_id, event_type, batch_id, cycle)
  select p_customer_id, auth.uid(), 'stamp', v_batch, v_cycle
  from generate_series(1, v_granted);

  v_current := v_current + v_granted;

  return json_build_object(
    'status', case when v_granted < p_quantity then 'partial' else 'stamped' end,
    'granted', v_granted,
    'requested', p_quantity,
    'stamps_on_card', v_current,
    'total_stamps', v_total,
    'card_complete', v_current >= v_total,
    'claimable', public.claimable_milestones(p_customer_id, v_cycle, v_current)
  );
end;
$$;

-- The only way a reward is claimed. Cannot be replayed: the unique index
-- on (customer_id, milestone_id, cycle) refuses a second row.
create or replace function public.redeem_milestone(
  p_customer_id uuid,
  p_milestone_id uuid,
  p_request_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_required int;
  v_label text;
  v_final uuid;
  v_cycle int;
  v_current int;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role not in ('staff', 'owner') then
    raise exception 'Only staff can redeem rewards';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_customer_id::text));

  select m.stamps_required, m.reward_label into v_required, v_label
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id and r.active
  where m.id = p_milestone_id;

  if v_required is null then
    raise exception 'That reward is not part of the active card';
  end if;

  select m.id into v_final
  from public.loyalty_milestones m
  join public.loyalty_rules r on r.id = m.rule_id and r.active
  order by m.stamps_required desc
  limit 1;

  v_cycle := public.card_cycle(p_customer_id);

  select count(*) into v_current
  from public.stamp_events
  where customer_id = p_customer_id
    and event_type = 'stamp'
    and cycle = v_cycle;

  if v_current < v_required then
    return json_build_object(
      'status', 'not_yet',
      'reward_label', v_label,
      'stamps_on_card', v_current,
      'stamps_required', v_required
    );
  end if;

  if exists (
    select 1 from public.stamp_events
    where customer_id = p_customer_id
      and event_type = 'redeem'
      and milestone_id = p_milestone_id
      and cycle = v_cycle
  ) then
    return json_build_object(
      'status', 'already_redeemed',
      'reward_label', v_label,
      'stamps_on_card', v_current,
      'stamps_required', v_required
    );
  end if;

  insert into public.stamp_events (
    customer_id, staff_id, event_type, milestone_id, batch_id, cycle
  )
  values (
    p_customer_id, auth.uid(), 'redeem', p_milestone_id,
    coalesce(p_request_id, gen_random_uuid()), v_cycle
  );

  return json_build_object(
    'status', 'redeemed',
    'reward_label', v_label,
    'stamps_on_card', v_current,
    'stamps_required', v_required,
    -- Claiming the last milestone closes the card. The next stamp opens
    -- a fresh one, and the history stays exactly where it was written.
    'card_reset', p_milestone_id = v_final
  );
end;
$$;

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------

alter table public.loyalty_rules enable row level security;
alter table public.loyalty_milestones enable row level security;

revoke all on public.loyalty_rules from anon;
revoke all on public.loyalty_milestones from anon;
revoke all on public.card_status from anon;
revoke all on public.card_milestones from anon;

revoke delete on public.loyalty_rules from authenticated;

grant select on public.card_status to authenticated;
grant select on public.card_milestones to authenticated;

create policy "authenticated read rules"
  on public.loyalty_rules for select
  using (auth.uid() is not null);

create policy "owner insert rules"
  on public.loyalty_rules for insert
  with check (public.current_user_role() = 'owner');

create policy "owner update rules"
  on public.loyalty_rules for update
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

create policy "authenticated read milestones"
  on public.loyalty_milestones for select
  using (auth.uid() is not null);

create policy "owner writes milestones"
  on public.loyalty_milestones for all
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

-- ---------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------

revoke execute on function public.add_stamps (uuid, int, uuid) from public, anon;
revoke execute on function public.redeem_milestone (uuid, uuid, uuid) from public, anon;
-- Internal to the RPCs above. No client ever calls these directly.
revoke execute on function public.card_cycle (uuid) from public, anon, authenticated;
revoke execute on function public.claimable_milestones (uuid, int, int) from public, anon, authenticated;

grant execute on function public.add_stamps (uuid, int, uuid) to authenticated;
grant execute on function public.redeem_milestone (uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------
-- The old single rule table is now unused
-- ---------------------------------------------------------------

drop table public.loyalty_settings;
