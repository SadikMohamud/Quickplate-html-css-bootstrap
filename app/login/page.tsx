import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Footer from "@/components/Footer";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return (
    <>
      <LoginForm />
      <Footer />
    </>
  );
}
