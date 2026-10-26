"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "@/components/ui/Icon";
import { LOGIN_URL, REGISTER_URL } from "@/lib/site";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing truth", href: "#pricing-truth" },
  { label: "FAQ", href: "#faq" },
];

/**
 * Sticky 64px global navbar. Light-first.
 * Mobile menu below lg (1024px). Section anchors resolve as Phase 2 lands.
 */
export function Navbar() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-card/90 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-6"
      >
        <Link
          href="#main"
          className="flex min-h-[44px] items-center gap-2.5 rounded-lg"
          aria-label="DomainPulse — back to top"
        >
          <Image
            src="/logo.svg"
            alt="DomainPulse logo"
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            DomainPulse
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={LOGIN_URL}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Sign in
          </a>
          <a
            href={REGISTER_URL}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-micro transition-colors hover:bg-primary-hover"
          >
            Get started
          </a>
        </div>

        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="sheet-enter border-t border-border bg-card px-6 pt-2 pb-6 lg:hidden"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center rounded-lg text-base font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={LOGIN_URL}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Sign in
            </a>
            <a
              href={REGISTER_URL}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              Get started
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
