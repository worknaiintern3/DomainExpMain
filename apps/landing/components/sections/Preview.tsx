import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Large dark product-preview zone. Pure code, no screenshot. All values are
 * illustrative demo data — labeled twice, exposed as a single image to
 * assistive tech.
 */
export function Preview() {
  return (
    <section id="preview" aria-labelledby="preview-heading" className="scroll-mt-20 bg-dark-bg">
      <Container wide>
        <div className="py-16 md:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs font-medium tracking-wider text-dark-primary uppercase">
              Product preview
            </p>
            <h2
              id="preview-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-white md:text-4xl"
            >
              The estate, at a glance
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-400">
              Portfolio summary, critical renewals, health, and the dependency
              graph — one dark console for operations.
            </p>
          </Reveal>

          <Reveal delayMs={120} className="mt-10">
            <div
              role="img"
              aria-label="Illustrative dark dashboard preview with demo data: portfolio summary metrics, critical renewals strip, health bar, and a domain to app to server topology map."
              className="overflow-hidden rounded-[20px] border border-dark-border bg-dark-surface shadow-pop"
            >
              <div aria-hidden="true">
                <div className="flex items-center justify-between gap-3 border-b border-dark-border px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                    <span className="ml-3 hidden font-mono text-xs text-slate-400 sm:inline">
                      workspace · overview
                    </span>
                  </div>
                  <span className="rounded-full border border-dark-border bg-dark-bg px-2.5 py-1 font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                    Demo data
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
                  {[
                    { label: "Total", value: "42", note: "assets mapped" },
                    { label: "Critical", value: "2", note: "expiring ≤ 7 days", hot: true },
                    { label: "Warning", value: "6", note: "expiring ≤ 30 days", warm: true },
                    { label: "Run-rate", value: "₹48,240", note: "annual renewal" },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-dark-border bg-dark-bg p-4"
                    >
                      <p className="font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                        {metric.label}
                      </p>
                      <p
                        className={`tnum mt-1 font-display text-2xl font-bold ${
                          metric.hot
                            ? "text-red-400"
                            : metric.warm
                              ? "text-amber-300"
                              : "text-white"
                        }`}
                      >
                        {metric.value}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{metric.note}</p>
                    </div>
                  ))}
                </div>

                <div className="mx-5 flex flex-col gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-red-200">
                    <span className="font-mono font-semibold">2 Critical</span>
                    <span className="text-red-200/70"> — renewals need review</span>
                  </p>
                  <span className="inline-flex w-fit items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-[13px] font-semibold text-red-100">
                    Review
                  </span>
                </div>

                <div className="grid gap-3 p-5 lg:grid-cols-5">
                  <div className="rounded-2xl border border-dark-border bg-dark-bg p-4 lg:col-span-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Portfolio health</p>
                      <p className="font-mono text-[11px] text-slate-500">42 assets</p>
                    </div>
                    <div className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/10">
                      <div className="bar-grow h-full rounded-full bg-emerald-400" style={{ width: "81%" }} />
                      <div className="bar-grow h-full rounded-full bg-amber-400" style={{ width: "14%", transitionDelay: "150ms" }} />
                      <div className="bar-grow h-full rounded-full bg-red-400" style={{ width: "5%", transitionDelay: "300ms" }} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                      <span>Healthy 34</span>
                      <span>Warning 6</span>
                      <span>Critical 2</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dark-border bg-dark-bg p-4 lg:col-span-2">
                    <p className="text-sm font-semibold text-white">Topology</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      <span className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-sky-300">
                        example.com
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                        storefront
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2 py-1 text-violet-300">
                        vps-eu-01
                      </span>
                    </div>
                    <p className="mt-2.5 font-mono text-[11px] text-slate-500">
                      USES_DOMAIN · HOSTED_ON — stored edges only
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-dark-border px-5 py-3.5">
                  <p className="font-mono text-[11px] text-slate-500">
                    Stored records · exact totals
                  </p>
                  <p className="rounded-full border border-dark-border bg-dark-bg px-2.5 py-1 font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                    Illustrative preview
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <p className="mx-auto mt-5 max-w-xl text-center text-[13px] leading-5 text-slate-500">
            Illustrative preview using demo data. In the product, live, stored,
            and sample values are always labeled.
          </p>
        </div>
      </Container>
    </section>
  );
}
