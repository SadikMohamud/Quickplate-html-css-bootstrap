# ZAAT

A stamp-based loyalty card PWA for ZAAT, a Lebanese grill and salads restaurant. Customers carry a digital stamp card on their phone, staff scan a QR at the counter to add stamps, and the owner sets the rewards and runs the menu without a developer.

Built with Next.js (App Router), Supabase (Postgres, Auth, RLS) and Vercel.

## How it works

- **Customers** sign in with a six digit code emailed to them, or a password if they have set one, then see their card and show a unique QR at the counter. The card face prints one letter per stamp, Z A A T over Z A A T A R, exactly like the paper card.
- **Staff** set how many stamps the order earns, scan the customer QR (or look them up by phone, email or name), and hand over a reward when one is ready.
- **The owner** sets the card size and its rewards, edits the whole menu, manages staff, and sees the counts.

### The card

A card carries several rewards, not one. ZAAT runs a ten stamp card:

| Stamps | Reward |
| --- | --- |
| 4 | Free wrap |
| 10 | Free ZAAT meal |

Claiming the wrap at four leaves the card running. Claiming the last reward closes the card, and the next stamp opens a fresh one. The owner can add, move or remove rewards from the dashboard, and the card falls back to numbered cells if the size no longer matches the letters.

### Integrity model

- `stamp_events` is append-only: one row per stamp earned or reward claimed, never a mutable counter. Granting three stamps in one action writes three rows sharing a batch id. Update and delete are revoked at the database level, so history cannot be rewritten even by a signed-in staff device.
- All writes go through two Postgres functions, `add_stamps` and `redeem_milestone`, which verify the caller is staff or owner. Customers cannot grant themselves stamps, even with direct API access.
- A reward cannot be claimed twice on the same card. A unique index on `(customer_id, milestone_id, cycle)` refuses the second row, so replay is stopped by the database rather than by application logic.
- Both write functions take a request id, so a retried or double-tapped request replays its result instead of stamping again.
- Every customer gets a unique, opaque `card_code` shown as their QR. It never exposes the auth user id.
- Row-level security means a customer can only ever read their own card.
- Card progress is always derived from the event log, never stored.

### The menu

Categories hold dishes, and dishes carry variants, because the same dish is priced by format: Chicken Shawarma is 7.90 as a wrap and 12.90 as a box. That is one dish with two variants, never two dishes. The owner adds, edits, reorders and hides all three levels from `/owner/menu`.

`/menu` is the one page that works without an account, so a diner can scan the QR on the table and read it.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the files in `supabase/migrations/` in order, in the SQL editor (or `supabase db push` with the CLI).
3. Run `supabase/seed.sql` to create the ZAAT card, the menu categories and one worked example dish.

### 2. Email sign in

Sign in is by a six digit code emailed by Supabase. A password is optional, set per account from the Account screen, and useful on a shared counter device where fetching a code each shift is friction. In the Supabase dashboard:

1. Authentication, then Sign In / Up, then Email: make sure the email provider is enabled.
2. Authentication, then Emails, then Templates: open the "Magic Link" template and make sure it includes the code token, `{{ .Token }}`, so the email carries a code and not only a link.

The built-in email sender is fine for testing. For production volume, connect your own SMTP provider under Authentication, then Emails, then SMTP Settings.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings, API. Secrets live only in environment variables, never in the code.

### 4. Run

```bash
npm install
npm run dev
```

### 5. Owner bootstrap

Sign in to the app once as `admin@zaat.com` with an emailed code, which creates the account. Then run one line in the Supabase SQL editor (already in `supabase/seed.sql`):

```sql
update public.profiles set role = 'owner' where email = 'admin@zaat.com';
```

Sign out and back in so the new role is picked up. After that the owner adds staff from the dashboard.

Never commit a password to this repository. If the owner wants one for the counter device, they set it themselves on the Account screen after signing in. Codes keep working alongside it.

## Deploy (Vercel)

1. Push this repo to GitHub and import it into Vercel.
2. Add the two environment variables from `.env.example`.
3. In Supabase, under Authentication then URL Configuration, set the Site URL to the Vercel URL and add `https://your-domain/auth/callback` to the redirect list.

## Branding

Every brand value lives in one file, `lib/theme.ts`: the name, the strapline, the descriptor, the palette, and the letters printed on the card. Pointing this codebase at the next client is one edit there plus new PNGs in `public/icons/`. Nothing else hardcodes a brand string.

## Project structure

```
app/            Pages: login, card, menu, staff till, owner dashboard, auth callback
  owner/loyalty   Card size and rewards
  owner/menu      Categories, dishes, prices, variants
components/     Shared UI: stamp card, QR scanner, till panel, footer
lib/theme.ts    Brand config (single source of truth)
lib/menu.ts     Menu loading and price formatting
lib/supabase/   Browser and server Supabase clients
lib/v2/         Stubs for v2: Wallet passes, analytics, multi-location
supabase/       SQL migrations and seed
proxy.ts        Session refresh and signed-out redirects
```

## v2 (scaffolded, not implemented)

- Apple and Google Wallet passes (`lib/v2/wallet.ts`)
- Analytics over the event log (`lib/v2/analytics.ts`)
- Multi-location (`lib/v2/locations.ts`, plus nullable `location_id` columns already in the schema)

---

Built by [Snurm](https://github.com/SadikMohamud)
