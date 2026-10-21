import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { ConsoleMock } from "@/components/hero/ConsoleMock";
import { SearchMock } from "@/components/hero/SearchMock";
import { REGISTER_URL } from "@/lib/site";

const TRUST_ITEMS = [
  "Stored records + live RDAP/DNS/SSL checks",
  "Purchases and renewals stay with your registrars",
  "Missing data shown as “—”, never guessed",
];

/** Subtle pulse-line motif echoing the DomainPulse logomark. */
function PulseUnderline() {
  return (
    <svg
      viewBox="0 0 220 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className="absolute -bottom-1.5 left-0 h-[10px] w-full"
    >
      <path
        d="M2 8 H70 L84 3 L100 11 L114 6 H218"
        fill="none"
        stroke="#4F46E5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-background">
      <Container>
        <div className="grid items-center gap-12 py-16 md:py-20 lg:grid-cols-5 lg:gap-10 lg:py-24">
          <div className="lg:col-span-3">
            <div className="hero-enter" style={{ animationDelay: "0ms" }}>
              <Badge tone="brand">Infrastructure + Domain Portfolio Manager</Badge>
            </div>
            <h1
              id="hero-heading"
              className="hero-enter mt-5 font-display text-[36px] leading-[44px] font-extrabold tracking-tight text-balance text-foreground lg:text-[56px] lg:leading-[64px]"
              style={{ animationDelay: "60ms" }}
            >
              Every domain, server, and renewal — finally in{" "}
              <span className="relative inline-block whitespace-nowrap text-primary">
                one pulse
                <PulseUnderline />
              </span>
              .
            </h1>
            <p
              className="hero-enter mt-5 max-w-xl text-base leading-7 text-muted-foreground"
              style={{ animationDelay: "120ms" }}
            >
              DomainPulse maps your domains, servers, apps, and accounts, counts
              down every expiry, and shows live registrar renewal truth — so
              nothing expires quietly and no renewal spike surprises you.
            </p>
            <div
              className="hero-enter mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "180ms" }}
            >
              <a
                href={REGISTER_URL}
                className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl bg-primary px-7 text-base font-semibold text-on-primary shadow-micro transition-colors hover:bg-primary-hover"
              >
                Explore the live app
              </a>
              <Link
                href="#pricing-truth"
                className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-7 text-base font-semibold text-foreground shadow-micro transition-colors hover:bg-muted"
              >
                Compare registrar pricing
              </Link>
            </div>
            <ul
              className="hero-enter mt-6 flex max-w-xl flex-col gap-1.5"
              style={{ animationDelay: "240ms" }}
              aria-label="Why you can trust DomainPulse data"
            >
              {TRUST_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[13px] leading-5 text-muted-foreground"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    className="mt-[3px] shrink-0 text-success"
                  >
                    <path
                      d="M3 8.5l3.2 3.2L13 5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="hero-enter" style={{ animationDelay: "300ms" }}>
              <SearchMock />
            </div>
          </div>

          <div className="lg:col-span-2">
            <ConsoleMock />
          </div>
        </div>
      </Container>
    </section>
  );
}
