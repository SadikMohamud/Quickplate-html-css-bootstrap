import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuEditor from "./MenuEditor";

export const metadata = { title: "Menu" };

export default async function OwnerMenuPage() {
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

  if (profile?.role !== "owner") redirect("/");

  return <MenuEditor />;
}
