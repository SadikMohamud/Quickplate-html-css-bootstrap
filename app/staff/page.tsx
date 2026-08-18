import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaffView from "./StaffView";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
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

  if (profile?.role !== "staff" && profile?.role !== "owner") {
    redirect("/card");
  }

  return <StaffView isOwner={profile.role === "owner"} />;
}
