import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardView from "./CardView";
import type { Role } from "@/lib/types";

export const metadata = { title: "My card" };

export default async function CardPage() {
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

  return (
    <CardView userId={user.id} role={(profile?.role ?? "customer") as Role} />
  );
}
