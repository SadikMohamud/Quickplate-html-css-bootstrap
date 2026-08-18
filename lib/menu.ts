import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuItem, MenuSection, MenuVariant } from "@/lib/types";

// The menu lives in the database and is edited from the owner dashboard.
// Row-level security does the filtering: a diner sees only visible
// categories and available dishes, while the owner sees everything.

export function formatPrice(pence: number): string {
  return `£${pence.toFixed(2)}`;
}

// What to show against a dish. With variants the price comes from them,
// so the menu shows the cheapest as a "from" price.
export function priceLabel(item: MenuItem): string {
  const available = item.variants.filter((v) => v.is_available);
  if (available.length === 1) return formatPrice(available[0].price);
  if (available.length > 1) {
    return `from ${formatPrice(Math.min(...available.map((v) => v.price)))}`;
  }
  return item.base_price === null ? "" : formatPrice(item.base_price);
}

const SELECT = `
  id, name, sort_order, is_visible,
  items:menu_items (
    id, category_id, name, description, base_price, is_available, sort_order,
    variants:menu_variants (
      id, item_id, label, price, is_available, sort_order
    )
  )
`;

interface RawVariant extends Omit<MenuVariant, "price"> {
  price: number | string;
}

interface RawItem extends Omit<MenuItem, "base_price" | "variants"> {
  base_price: number | string | null;
  variants: RawVariant[] | null;
}

interface RawSection extends Omit<MenuSection, "items"> {
  items: RawItem[] | null;
}

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) =>
  a.sort_order - b.sort_order;

// Numeric columns arrive as numbers, but coerce anyway so a driver change
// can never turn a price into string concatenation.
const toNumber = (value: number | string): number => Number(value);

export async function loadMenu(
  supabase: SupabaseClient
): Promise<MenuSection[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select(SELECT)
    .order("sort_order");

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawSection[]).map((section) => ({
    ...section,
    items: (section.items ?? []).sort(bySortOrder).map((item) => ({
      ...item,
      base_price: item.base_price === null ? null : toNumber(item.base_price),
      variants: (item.variants ?? []).sort(bySortOrder).map((variant) => ({
        ...variant,
        price: toNumber(variant.price),
      })),
    })),
  }));
}
