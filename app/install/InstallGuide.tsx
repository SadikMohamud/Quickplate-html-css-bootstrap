"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

type Platform = "ios" | "android" | "desktop";

interface Step {
  text: string;
  glyph: React.ReactNode;
}

export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("ios");

  // Default to the visitor's platform, but let them switch.
  useEffect(() => {
    const ua = navigator.userAgent;
    const detected: Platform = /android/i.test(ua)
      ? "android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "ios"
        : "desktop";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detected);
  }, []);

  const tabs: { id: Platform; label: string }[] = [
    { id: "ios", label: "iPhone" },
    { id: "android", label: "Android" },
    { id: "desktop", label: "Computer" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-brand-surface p-5 text-center shadow-sm">
        <Image
          src="/icons/icon-192.png"
          alt={`${theme.shopName} app icon`}
          width={72}
          height={72}
          className="mx-auto rounded-2xl shadow-sm"
        />
        <p className="mt-3 text-sm text-brand-muted">
          Once installed, this icon opens your loyalty card instantly, no
          browser needed.
        </p>
      </div>

      <div className="flex rounded-xl bg-brand-accent/15 p-1 text-sm font-medium">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPlatform(t.id)}
            className={`flex-1 rounded-lg py-2 transition-colors ${
              platform === t.id
                ? "bg-brand-surface shadow-sm"
                : "text-brand-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS[platform].map((step, i) => (
          <li
            key={i}
            className="animate-rise flex items-center gap-4 rounded-2xl bg-brand-surface p-4 shadow-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-on-primary">
              {i + 1}
            </span>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 text-brand">
              {step.glyph}
            </div>
            <p className="text-sm">{step.text}</p>
          </li>
        ))}
      </ol>

      {platform === "ios" && (
        <p className="rounded-xl bg-brand-accent/10 px-4 py-3 text-center text-xs text-brand-muted">
          On iPhone this only works in <strong>Safari</strong>. If you are in
          another browser, open this page in Safari first.
        </p>
      )}
    </div>
  );
}

// --- Step content per platform -----------------------------------

const STEPS: Record<Platform, Step[]> = {
  ios: [
    { text: "Open the site in Safari on your iPhone.", glyph: <SafariGlyph /> },
    {
      text: "Tap the Share button at the bottom of the screen.",
      glyph: <ShareGlyph />,
    },
    {
      text: 'Scroll down and tap "Add to Home Screen".',
      glyph: <AddSquareGlyph />,
    },
    {
      text: 'Tap "Add" in the top corner. The icon appears on your home screen.',
      glyph: <HomeGlyph />,
    },
  ],
  android: [
    { text: "Open the site in Chrome on your phone.", glyph: <ChromeGlyph /> },
    {
      text: "Tap the three-dot menu in the top corner.",
      glyph: <DotsGlyph />,
    },
    {
      text: 'Tap "Install app" (or "Add to Home screen").',
      glyph: <DownloadGlyph />,
    },
    {
      text: 'Tap "Install" to confirm. The app lands on your home screen.',
      glyph: <HomeGlyph />,
    },
  ],
  desktop: [
    {
      text: "Open the site in Chrome or Microsoft Edge.",
      glyph: <ChromeGlyph />,
    },
    {
      text: "Click the install icon at the right of the address bar.",
      glyph: <DownloadGlyph />,
    },
    {
      text: 'Click "Install". It opens in its own window like an app.',
      glyph: <HomeGlyph />,
    },
  ],
};

// --- Glyphs ------------------------------------------------------

function ShareGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function AddSquareGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function DotsGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function HomeGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function SafariGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChromeGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 8.8h8M8.6 14l-4 6.9M15.4 14l-4 6.9" />
    </svg>
  );
}
