import { BellRing, LayoutDashboard, Network, Scale, Search, Timer } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

function TileShell({
  children,
  wide = false,
  delayMs = 0,
}: {
  children: React.ReactNode;
  wide?: boolean;
  delayMs?: number;
}) {
  return (
    <Reveal delayMs={delayMs} className={wide ? "md:col-span-2" : ""}>
      <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-micro transition-shadow duration-200 hover:shadow-card">
        {children}
      </article>
    </Reveal>
  );
}

function TileHeader({
  icon: Icon,
  source,
}: {
  icon: typeof Timer;
  source: "Stored" | "Live" | "Stored + Live";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <Badge tone="mono">{source}</Badge>
    </div>
  );
}

/**
 * Asymmetric bento: six capabilities. Expiry engine spans two columns with a
 * timeline visual. Thresholds match the product engine (≤7 / 8–30 / beyond).
 */
export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-20 bg-background">
      <Container>
        <div className="py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              Capabilities
            </p>
            <h2
              id="features-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              One workspace for the whole portfolio
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Every tile below maps to a real workspace view. Stored records are
              exact; live values are labeled — nothing is estimated.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <TileShell delayMs={0}>
              <TileHeader icon={LayoutDashboard} source="Stored" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Portfolio command center
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                Add, import, tag, and archive domains, servers, apps, and accounts.
                Filters apply to what you loaded — totals are exact.
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                CSV / JSON · TRACKED / ARCHIVED
              </p>
            </TileShell>

            <TileShell wide delayMs={80}>
              <TileHeader icon={Timer} source="Stored + Live" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Expiry engine
              </h3>
              <p className="mt-2 max-w-lg text-[15px] leading-6 text-muted-foreground">
                Every record counts down to expiry with the same tiers the product
                uses. Thresholds are configurable in Settings.
              </p>
              <div className="mt-5 rounded-xl border border-border bg-background p-4" aria-hidden="true">
                <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                  <div className="bar-grow h-full rounded-full bg-success" style={{ width: "70%" }} />
                  <div className="bar-grow h-full rounded-full bg-warning" style={{ width: "22%", transitionDelay: "120ms" }} />
                  <div className="bar-grow h-full rounded-full bg-critical" style={{ width: "8%", transitionDelay: "240ms" }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs">
                  <span className="text-critical-text">● Critical ≤ 7 days</span>
                  <span className="text-warning-text">● Warning 8–30 days</span>
                  <span className="text-success-text">● Healthy beyond 30</span>
                </div>
              </div>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                RDAP-verified dates · configurable horizons
              </p>
            </TileShell>

            <TileShell delayMs={0}>
              <TileHeader icon={Search} source="Live" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Finder + watchlist
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                Multi-TLD availability with premium and registered states, plus a
                saved watchlist for candidates.
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                .com .in .ai .io · 8 more
              </p>
            </TileShell>

            <TileShell delayMs={80}>
              <TileHeader icon={Scale} source="Live" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Registrar truth
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                First-year, renewal, and transfer prices side by side. A dash means
                the registrar didn&apos;t return it.
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                Year-1 · Renewal · Transfer
              </p>
            </TileShell>

            <TileShell delayMs={160}>
              <TileHeader icon={Network} source="Stored" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Infra map
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                Stored relationships only — which app uses which domain on which
                server. Nothing is inferred.
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                HOSTED_ON · USES_DOMAIN · ROUTES_TO
              </p>
            </TileShell>

            <TileShell delayMs={240}>
              <TileHeader icon={BellRing} source="Stored + Live" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                Alerts + calendar
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
                Open, acknowledged, resolved. Export renewal calendars and push to
                Slack, Discord, or Telegram.
              </p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                .ics export · webhooks
              </p>
            </TileShell>
          </div>
        </div>
      </Container>
    </section>
  );
}
