"use client";

import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";
import TillPanel from "@/components/TillPanel";

interface StaffViewProps {
  isOwner: boolean;
}

export default function StaffView({ isOwner }: StaffViewProps) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <Logo className="h-9 w-auto" priority />
            <p className="mt-1 text-xs text-brand-muted">Staff till</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
            >
              Account
            </Link>
            <SignOutButton />
          </div>
        </header>

        <TillPanel />
      </div>
      <BottomNav role={isOwner ? "owner" : "staff"} />
    </>
  );
}
