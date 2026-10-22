import Image from "next/image";
import Link from "next/link";
import { LOGIN_URL, REGISTER_URL } from "@/lib/site";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "App preview", href: "#preview" },
      { label: "For whom", href: "#personas" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "Pricing truth", href: "#pricing-truth" },
      { label: "Find a domain", href: "#hero-search" },
      { label: "Transfer savings", href: "#pricing-truth" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Methodology", href: "#pricing-truth" },
      { label: "Sign in", href: LOGIN_URL },
      { label: "Get started", href: REGISTER_URL },
    ],
  },
];

/** Global footer. Anchor targets resolve as Phase 2 sections land. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link
            href="#main"
            className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg"
            aria-label="DomainPulse — back to top"
          >
            <Image
              src="/logo.svg"
              alt="DomainPulse logo"
              width={32}
              height={32}
              loading="lazy"
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              DomainPulse
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
            Infrastructure and domain portfolio manager. Stored records plus
            live checks — renewals stay with your registrars.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={`Footer — ${column.title}`}>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {column.title}
            </h2>
            <ul className="mt-3 flex flex-col">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("#") ? (
                    <Link
                      href={link.href}
                      className="inline-flex min-h-[44px] items-center rounded-lg text-sm text-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="inline-flex min-h-[44px] items-center rounded-lg text-sm text-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">
            © 2026 DomainPulse · Demo data labeled where shown.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Missing data shown as “—”, never guessed.
          </p>
        </div>
      </div>
    </footer>
  );
}
