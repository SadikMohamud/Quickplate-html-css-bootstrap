-- ZAAT seed data.
-- Run once after the migrations, on a fresh project.

-- ---------------------------------------------------------------
-- The card
-- ---------------------------------------------------------------
--
-- Ten stamps, matching the paper card: Z A A T on the first row, Z A A T
-- A R on the second. A free wrap lands at the end of the first row, the
-- free meal at the end of the second, and claiming the meal resets the
-- card.

with rule as (
  insert into public.loyalty_rules (name, total_stamps)
  values ('ZAAT card', 10)
  returning id
)
insert into public.loyalty_milestones (rule_id, stamps_required, reward_label, sort_order)
select id, 4, 'Free wrap', 1 from rule
union all
select id, 10, 'Free ZAAT meal', 2 from rule;

-- ---------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------

insert into public.menu_categories (name, sort_order) values
  ('Starter', 1),
  ('Main', 2),
  ('Salad', 3),
  ('Sides', 4),
  ('Street Bites', 5),
  ('Bite Meal', 6),
  ('Wraps', 7),
  ('Boxs', 8),
  ('Grill', 9),
  ('Classics', 10);

-- ---------------------------------------------------------------
-- One worked example
-- ---------------------------------------------------------------
--
-- Chicken Shawarma shows how a dish priced by format is modelled: one
-- item, two variants, never two items. The owner adds the rest of the
-- menu from the dashboard, so nothing here needs a developer.

with item as (
  insert into public.menu_items (category_id, name, description, sort_order)
  select id, 'Chicken Shawarma', 'Marinated chicken, garlic sauce, pickles', 1
  from public.menu_categories where name = 'Wraps'
  returning id
)
insert into public.menu_variants (item_id, label, price, sort_order)
select id, 'Wrap', 7.90, 1 from item
union all
select id, 'Box', 12.90, 2 from item;

-- ---------------------------------------------------------------
-- Owner bootstrap
-- ---------------------------------------------------------------
--
-- Sign in to the app once with the owner's email, then run the line below
-- in the Supabase SQL editor with the real address. After that the owner
-- promotes staff from the dashboard.
--
-- update public.profiles set role = 'owner' where email = 'owner@example.com';
