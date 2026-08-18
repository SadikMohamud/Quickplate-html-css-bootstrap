import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountView from "./AccountView";
import type { Role } from "@/lib/types";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  return (
    <AccountView
      userId={user.id}
      email={user.email ?? ""}
      displayName={profile?.display_name ?? null}
      role={(profile?.role ?? "customer") as Role}
    />
  );
}
