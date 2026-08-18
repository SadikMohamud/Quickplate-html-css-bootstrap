// ================================================================
// ZAAT BRAND THEME
//
// The single source of truth for branding. Every colour, name, letter and
// logo reference in the app reads from this file, so pointing the codebase
// at the next client is one edit here plus new files in public/.
// ================================================================

export const theme = {
  shopName: "ZAAT",
  tagline: "Taste To Love",
  descriptor: "Lebanese Grill & Salads",

  colours: {
    // Brand red. Carries the card face, filled stamps and primary buttons.
    primary: "#C8102E",
    // Deeper red for borders, rules and secondary marks.
    accent: "#8E0B20",
    // Body text. Red is the brand, not the reading colour, so type
    // defaults to ink and only accents are red.
    ink: "#1A1614",
    // Page background: a warm white, just off the surface white so cards
    // and sheets read as raised.
    background: "#FBF7F6",
    // Card and sheet surfaces.
    surface: "#FFFFFF",
    // Secondary text. Passes contrast on both whites.
    muted: "#6B625F",
    // Reward unlocked, redeemed, and other confirmations.
    success: "#1B7A4B",
    // Text and icons on red.
    onPrimary: "#FFFFFF",
  },

  logo: {
    // The wordmark is drawn as inline SVG by components/Logo.tsx, so this
    // is only the accessible name.
    alt: "ZAAT",
  },

  // Square app icon used by the PWA manifest.
  pwaIcon: "/icons/icon-512.png",

  // The stamp card face. One letter per stamp, laid out in rows exactly as
  // the paper card is printed: Z A A T over Z A A T A R. The letters total
  // ten, which must match total_stamps on the active loyalty rule; if the
  // owner ever changes the card size the grid falls back to numbers.
  stampCard: {
    rows: ["ZAAT", "ZAATAR"],
  },
} as const;

// Every cell of the card face, in stamp order.
export const stampLetters: string[] = theme.stampCard.rows.flatMap((row) =>
  row.split("")
);
