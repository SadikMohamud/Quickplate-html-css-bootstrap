export type Role = "customer" | "staff" | "owner";

export interface Profile {
  id: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  role: Role;
  card_code: string;
  created_at: string;
}

// ----------------------------------------------------------------
// Loyalty
// ----------------------------------------------------------------

export interface LoyaltyRule {
  id: string;
  name: string;
  total_stamps: number;
  active: boolean;
  location_id: string | null;
  updated_at: string;
}

export interface LoyaltyMilestone {
  id: string;
  rule_id: string;
  stamps_required: number;
  reward_label: string;
  sort_order: number;
}

export interface CardStatus {
  customer_id: string;
  card_code: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  cycle: number;
  stamps_on_card: number;
  lifetime_stamps: number;
  rewards_redeemed: number;
  last_stamp_at: string | null;
}

// A milestone as the customer sees it: earned once they have the stamps,
// redeemed once staff have handed it over on this run of the card.
export interface CardMilestone {
  customer_id: string;
  milestone_id: string;
  stamps_required: number;
  reward_label: string;
  sort_order: number;
  earned: boolean;
  redeemed: boolean;
}

// A reward the customer has earned but not yet been given, returned by
// add_stamps so the till can offer it straight away.
export interface ClaimableMilestone {
  id: string;
  stamps_required: number;
  reward_label: string;
}

export type AddStampsStatus = "stamped" | "partial" | "complete" | "duplicate";

export interface AddStampsResult {
  status: AddStampsStatus;
  granted: number;
  requested: number;
  stamps_on_card: number;
  total_stamps: number;
  card_complete: boolean;
  claimable: ClaimableMilestone[];
}

export type RedeemStatus = "redeemed" | "already_redeemed" | "not_yet";

export interface RedeemResult {
  status: RedeemStatus;
  reward_label: string;
  stamps_on_card: number;
  stamps_required: number;
  card_reset?: boolean;
}

// ----------------------------------------------------------------
// Menu
// ----------------------------------------------------------------

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
}

export interface MenuVariant {
  id: string;
  item_id: string;
  label: string;
  price: number;
  is_available: boolean;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  is_available: boolean;
  sort_order: number;
  variants: MenuVariant[];
}

export interface MenuSection extends MenuCategory {
  items: MenuItem[];
}
