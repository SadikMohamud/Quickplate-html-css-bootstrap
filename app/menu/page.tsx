import { loadMenu } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import MenuView from "./MenuView";
import type { MenuSection, Role } from "@/lib/types";

export const metadata = { title: "Menu" };

// The menu is the one public part of the app, so a diner can scan the QR
// on the table and read it without an account.
export default async function MenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: Role | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = (profile?.role ?? "customer") as Role;
  }

  // A diner standing in the restaurant should never meet an error page.
  // If the menu cannot be read, show the empty state and let them ask at
  // the counter.
  let sections: MenuSection[] = [];
  try {
    sections = await loadMenu(supabase);
  } catch {
    sections = [];
  }

  return <MenuView sections={sections} role={role} />;
}
