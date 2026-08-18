"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const CARD = "card";
const TILL = "till";
const DASH = "dash";
const MENU = "menu";
const ACCOUNT = "account";

function icon(kind: string) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case CARD:
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case TILL:
      return (
        <svg {...common}>
          <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
          <path d="M4 12h16" />
        </svg>
      );
    case DASH:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case MENU:
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case ACCOUNT:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    default:
      return null;
  }
}

function tabsFor(role: Role): Tab[] {
  const menu = { href: "/menu", label: "Menu", icon: icon(MENU) };
  const account = { href: "/account", label: "Account", icon: icon(ACCOUNT) };
  if (role === "customer") {
    return [
      { href: "/card", label: "Card", icon: icon(CARD) },
      menu,
      account,
    ];
  }
  if (role === "owner") {
    return [
      { href: "/staff", label: "Till", icon: icon(TILL) },
      { href: "/owner", label: "Dashboard", icon: icon(DASH) },
      menu,
      account,
    ];
  }
  return [
    { href: "/staff", label: "Till", icon: icon(TILL) },
    menu,
    account,
  ];
}

export default function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = tabsFor(role);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-accent/20 bg-brand-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors ${
                active ? "text-brand" : "text-brand-muted"
              }`}
            >
              <span
                className={`flex h-7 w-16 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-brand-accent/20" : ""
                }`}
              >
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
