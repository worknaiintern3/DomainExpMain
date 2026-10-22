import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { FIND_DOMAIN_URL } from "@/lib/site";

const ROWS = [
  {
    registrar: "Cloudflare",
    year1: "$9.15",
    renewal: "$9.15",
    transfer: "$9.15",
    privacy: "Included",
    spike: false,
  },
  {
    registrar: "Porkbun",
    year1: "$9.73",
    renewal: "$9.73",
    transfer: "$9.73",
    privacy: "Included",
    spike: false,
  },
  {
    registrar: "GoDaddy",
    year1: "$11.99",
    renewal: "$21.99",
    transfer: "$21.99",
    privacy: "Paid",
    spike: true,
  },
];

/**
 * Registrar economics — NOT SaaS subscription pricing. All figures are
 * labeled samples for layout; live values come from registrar APIs in-app.
 */
export function PricingTruth() {
  return (
    <section
      id="pricing-truth"
      aria-labelledby="pricing-heading"
      className="scroll-mt-20 bg-background"
    >
      <Container>
        <div className="grid items-start gap-10 py-16 md:py-20 lg:grid-cols-2 lg:gap-14">
          <Reveal className="min-w-0">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              Pricing truth
            </p>
            <h2
              id="pricing-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              Renewal truth, not teaser pricing.
            </h2>
            <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">
              We show what each registrar&apos;s API returns — first-year,
              renewal, and transfer side by side. Nothing scraped, nothing
              filled in. A dash means the registrar didn&apos;t return that price.
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-micro">
              <p className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Ownership math
              </p>
              <p className="tnum mt-2 font-mono text-sm font-medium text-foreground md:text-base">
                5-year cost = Year 1 + 4 × Renewal
              </p>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                Same currency only. Different currencies are never converted or
                ranked.
              </p>
            </div>
            <a
              href={FIND_DOMAIN_URL}
              className="mt-6 inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl bg-primary px-7 text-base font-semibold text-on-primary shadow-micro transition-colors hover:bg-primary-hover"
            >
              Compare a live domain
            </a>
          </Reveal>

          <Reveal delayMs={120} className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                <p className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Registrar comparison · .com
                </p>
                <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Sample
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">
                    Sample registrar price comparison for illustration. Verify live prices in the app.
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-muted font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                      <th scope="col" className="sticky left-0 bg-muted px-5 py-3 font-medium">Registrar</th>
                      <th scope="col" className="px-4 py-3 font-medium">Year-1</th>
                      <th scope="col" className="px-4 py-3 font-medium">Renewal</th>
                      <th scope="col" className="px-4 py-3 font-medium">Transfer</th>
                      <th scope="col" className="px-5 py-3 font-medium">Privacy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ROWS.map((row) => (
                      <tr key={row.registrar} className="transition-colors hover:bg-muted/40">
                        <th scope="row" className="sticky left-0 bg-card px-5 py-3.5 font-semibold text-foreground">
                          {row.registrar}
                        </th>
                        <td className="tnum px-4 py-3.5 font-mono text-foreground">{row.year1}</td>
                        <td
                          className={`tnum px-4 py-3.5 font-mono ${
                            row.spike
                              ? "rounded-lg bg-warning-bg font-semibold text-warning-text"
                              : "text-foreground"
                          }`}
                        >
                          {row.renewal}
                          {row.spike && (
                            <span className="ml-2 rounded-full bg-warning-bg px-2 py-0.5 font-sans text-[10px] font-semibold tracking-wide uppercase">
                              Spike
                            </span>
                          )}
                        </td>
                        <td className="tnum px-4 py-3.5 font-mono text-foreground">{row.transfer}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{row.privacy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border px-5 py-3.5 text-[13px] leading-5 text-muted-foreground">
                Sample figures for layout only — verify live in-app. A dash (—)
                means the registrar didn&apos;t return that price.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
