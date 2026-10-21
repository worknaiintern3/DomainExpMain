/**
 * Pure-code operations console mockup. Presentational only: exposed to
 * assistive tech as a single image with a summary label; inner values are
 * illustrative placeholders, never customer statistics.
 */
export function ConsoleMock() {
  return (
    <div
      role="img"
      aria-label="Illustrative operations console preview: portfolio summary with loaded, tracked, critical and run-rate metrics, a critical-renewals row, and a portfolio health bar."
      className="hero-enter w-full rounded-[20px] border border-border bg-card p-4 shadow-card sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="truncate font-mono text-xs font-medium tracking-wider text-foreground">
              PORTFOLIO SUMMARY
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground">
            INR (₹)
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div
            className="hero-enter rounded-2xl border border-border bg-background p-3.5"
            style={{ animationDelay: "180ms" }}
          >
            <p className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Loaded
            </p>
            <p className="tnum mt-1 font-display text-2xl font-bold text-foreground">42</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Domains tracked</p>
          </div>
          <div
            className="hero-enter rounded-2xl border border-critical-border bg-critical-bg p-3.5"
            style={{ animationDelay: "240ms" }}
          >
            <p className="font-mono text-[11px] font-medium tracking-wider text-critical-text uppercase">
              Critical
            </p>
            <p className="tnum mt-1 font-display text-2xl font-bold text-critical-text">2</p>
            <p className="mt-0.5 truncate text-xs text-critical-text/80">Expiring ≤ 7 days</p>
          </div>
          <div
            className="hero-enter hidden rounded-2xl border border-border bg-background p-3.5 sm:block"
            style={{ animationDelay: "300ms" }}
          >
            <p className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Tracked
            </p>
            <p className="tnum mt-1 font-display text-2xl font-bold text-foreground">40</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Active records</p>
          </div>
          <div
            className="hero-enter hidden rounded-2xl border border-border bg-background p-3.5 sm:block"
            style={{ animationDelay: "360ms" }}
          >
            <p className="font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Run-rate
            </p>
            <p className="tnum mt-1 font-display text-2xl font-bold text-foreground">₹48,240</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Annual renewal</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-critical-border bg-critical-bg px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 items-center rounded-full bg-critical px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
              2 Critical
            </span>
            <span className="truncate text-[13px] text-critical-text">
              Renewals need review
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-critical-text">
            Review
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 8h10M8.5 4.5L12 8l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <div className="mt-2.5 rounded-2xl border border-border bg-background p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground">Portfolio health</p>
            <p className="font-mono text-[11px] text-muted-foreground">42 assets</p>
          </div>
          <div
            className="mt-2.5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <div className="h-full rounded-full bg-success" style={{ width: "81%" }} />
            <div className="h-full rounded-full bg-warning" style={{ width: "14%" }} />
            <div className="h-full rounded-full bg-critical" style={{ width: "5%" }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-success" />
              Healthy 34
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-warning" />
              Warning 6
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-critical" />
              Critical 2
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="font-mono text-[11px] text-muted-foreground">
            Stored records · exact totals
          </p>
          <p className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            Illustrative preview
          </p>
        </div>
      </div>
    </div>
  );
}
