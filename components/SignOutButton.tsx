"use client";

import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await getBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
    >
      Sign out
    </button>
  );
}
