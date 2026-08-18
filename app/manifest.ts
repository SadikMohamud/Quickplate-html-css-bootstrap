import type { MetadataRoute } from "next";
import { theme } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: theme.shopName,
    short_name: theme.shopName,
    description: `${theme.descriptor}. Collect stamps on your ${theme.shopName} card and earn rewards.`,
    start_url: "/",
    display: "standalone",
    background_color: theme.colours.background,
    theme_color: theme.colours.background,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
