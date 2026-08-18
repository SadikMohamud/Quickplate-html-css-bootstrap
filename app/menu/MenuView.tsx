import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { formatPrice, priceLabel } from "@/lib/menu";
import { theme } from "@/lib/theme";
import type { MenuSection, Role } from "@/lib/types";

interface MenuViewProps {
  sections: MenuSection[];
  // Null for a diner reading the menu without an account.
  role: Role | null;
}

export default function MenuView({ sections, role }: MenuViewProps) {
  // Categories with nothing in them are noise on a public menu. The owner
  // still sees them in the dashboard, where they are added and filled.
  const visible = sections.filter((section) => section.items.length > 0);

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <Logo className="h-9 w-auto" priority />
            <p className="mt-1 text-xs text-brand-muted">{theme.descriptor}</p>
          </div>
          <Link
            href={role ? "/account" : "/login"}
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
          >
            {role ? "Account" : "Sign in"}
          </Link>
        </header>

        {visible.length === 0 ? (
          <p className="rounded-3xl bg-brand-surface p-6 text-center text-sm text-brand-muted shadow-sm">
            The menu is being set up. Please ask at the counter.
          </p>
        ) : (
          visible.map((section) => (
            <section key={section.id} className="animate-rise">
              <h2 className="mb-3 border-b-2 border-brand pb-2 text-lg font-semibold uppercase tracking-wide text-brand">
                {section.name}
              </h2>

              <ul className="overflow-hidden rounded-3xl bg-brand-surface shadow-sm">
                {section.items.map((item, i) => (
                  <li
                    key={item.id}
                    className={`px-5 py-4 ${
                      i > 0 ? "border-t border-brand-accent/15" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-brand-muted">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-medium text-brand">
                        {priceLabel(item)}
                      </span>
                    </div>

                    {item.variants.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {item.variants.map((variant) => (
                          <li
                            key={variant.id}
                            className="rounded-full bg-brand/8 px-3 py-1 text-xs"
                          >
                            {variant.label}{" "}
                            <span className="font-medium text-brand">
                              {formatPrice(variant.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="text-center text-xs text-brand-muted">
          Prices include VAT. Please ask about allergens.
        </p>

        {!role && <Footer />}
      </div>
      {role && <BottomNav role={role} />}
    </>
  );
}
