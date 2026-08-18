import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OwnerView from "./OwnerView";

export const metadata = { title: "Dashboard" };

export default async function OwnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") redirect("/card");

  return <OwnerView />;
}
