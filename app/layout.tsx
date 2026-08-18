import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { theme } from "@/lib/theme";
import LoadingScreen from "@/components/LoadingScreen";
import SwRegister from "@/components/SwRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: theme.shopName,
    template: `%s | ${theme.shopName}`,
  },
  description: `${theme.descriptor}. Collect stamps on your ${theme.shopName} card and earn rewards.`,
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: theme.shopName,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: theme.colours.background,
  width: "device-width",
  initialScale: 1,
  // Cover the full screen including under the notch, then pad content
  // back in with safe-area insets. Pinch zoom stays enabled for a11y.
  viewportFit: "cover",
};

const brandVars = {
  "--brand-primary": theme.colours.primary,
  "--brand-ink": theme.colours.ink,
  "--brand-accent": theme.colours.accent,
  "--brand-background": theme.colours.background,
  "--brand-surface": theme.colours.surface,
  "--brand-muted": theme.colours.muted,
  "--brand-success": theme.colours.success,
  "--brand-on-primary": theme.colours.onPrimary,
} as React.CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      style={brandVars}
      className={`${geistSans.variable} antialiased`}
    >
      {/* 100dvh tracks the real visible height as mobile browser chrome
          shows and hides, so the footer never sits under the URL bar. */}
      <body className="flex min-h-[100dvh] flex-col">
        <LoadingScreen />
        <SwRegister />
        <main
          className="flex flex-1 flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
