import Link from "next/link";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { theme } from "@/lib/theme";
import InstallGuide from "./InstallGuide";

export const metadata = {
  title: "Install the app",
  description: `How to add the ${theme.shopName} loyalty card to your phone.`,
};

export default function InstallPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <Logo className="h-9 w-auto" priority />
        <Link
          href="/login"
          className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
        >
          Sign in
        </Link>
      </header>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">Add to your phone</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Install the card like an app, so it opens straight from your home
          screen with one tap.
        </p>
      </div>

      <InstallGuide />
      <Footer />
    </div>
  );
}
