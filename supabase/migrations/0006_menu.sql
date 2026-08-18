-- The menu, owned by the restaurant rather than the codebase.
--
-- Previously the menu was a hardcoded TypeScript array, so every price
-- change needed a developer and a deploy. It now lives in three tables the
-- owner edits from the dashboard.
--
-- Variants exist because the same dish is priced by format: Chicken
-- Shawarma is 7.90 as a wrap and 12.90 as a box. That is one item with two
-- variants, never two items.

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menu_categories is 'Menu sections in display order. Hidden categories stay in the data but leave the menu.';

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null,
  description text,
  -- Used only when an item has no variants. With variants, price comes
  -- from the variant rows and the menu shows "from" the cheapest.
  base_price numeric(10, 2) check (base_price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menu_items is 'A dish. Priced by base_price, or by its variants when it has any.';

create index menu_items_category_idx
  on public.menu_items (category_id, sort_order);

create table public.menu_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  label text not null,
  price numeric(10, 2) not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  unique (item_id, label)
);

comment on table public.menu_variants is 'A format of a dish, such as Wrap or Box, with its own price.';

create index menu_variants_item_idx
  on public.menu_variants (item_id, sort_order);

create trigger menu_categories_touch
  before update on public.menu_categories
  for each row execute function public.touch_updated_at();

create trigger menu_items_touch
  before update on public.menu_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------
--
-- The menu is the one public part of the app: a diner scanning the QR on
-- the table can read it without an account. Everything hidden or
-- unavailable is invisible to them, and only the owner can write.

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_variants enable row level security;

grant select on public.menu_categories to anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant select on public.menu_variants to anon, authenticated;

revoke insert, update, delete on public.menu_categories from anon;
revoke insert, update, delete on public.menu_items from anon;
revoke insert, update, delete on public.menu_variants from anon;

-- Returns null for a signed-out visitor, which fails the owner checks
-- below without erroring.
grant execute on function public.current_user_role () to anon;

create policy "read visible categories"
  on public.menu_categories for select
  using (is_visible or public.current_user_role() = 'owner');

create policy "owner writes categories"
  on public.menu_categories for all
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

create policy "read available items"
  on public.menu_items for select
  using (
    public.current_user_role() = 'owner'
    or (
      is_available
      and exists (
        select 1 from public.menu_categories c
        where c.id = category_id and c.is_visible
      )
    )
  );

create policy "owner writes items"
  on public.menu_items for all
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

create policy "read available variants"
  on public.menu_variants for select
  using (
    public.current_user_role() = 'owner'
    or (
      is_available
      and exists (
        select 1
        from public.menu_items i
        join public.menu_categories c on c.id = i.category_id
        where i.id = item_id and i.is_available and c.is_visible
      )
    )
  );

create policy "owner writes variants"
  on public.menu_variants for all
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');
