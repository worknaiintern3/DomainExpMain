import { Briefcase, Code2, LineChart, Rocket } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const PERSONAS = [
  {
    icon: Rocket,
    title: "Entrepreneur",
    points: [
      "One renewal calendar for every venture.",
      "Teaser-price traps flagged before they compound.",
      "CSV handoffs your accountant can read.",
    ],
  },
  {
    icon: LineChart,
    title: "Investor",
    points: [
      "Spot renewal spikes before they eat margin.",
      "Track dozens of names with exact totals.",
      "Watchlist candidates across 12+ TLDs.",
    ],
  },
  {
    icon: Briefcase,
    title: "Agency",
    points: [
      "Client tags keep every portfolio separate.",
      "Export .ics calendars owners actually open.",
      "Hand off domains, apps, and servers as one map.",
    ],
  },
  {
    icon: Code2,
    title: "Developer",
    points: [
      "Domain → server → app mapped, TLS and DNS verified.",
      "RDAP facts, not scraped guesses.",
      "Webhooks into the tools you already use.",
    ],
  },
];

/** Four persona blocks. No photos, no testimonials. */
export function Personas() {
  return (
    <section id="personas" aria-labelledby="personas-heading" className="scroll-mt-20 bg-background">
      <Container>
        <div className="py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              Who it&apos;s for
            </p>
            <h2
              id="personas-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              Built for people with more than one domain
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((persona, index) => (
              <Reveal key={persona.title} delayMs={(index % 4) * 80}>
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-micro transition-shadow duration-200 hover:shadow-card">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                    <persona.icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                    {persona.title}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {persona.points.map((point) => (
                      <li key={point} className="text-sm leading-6 text-muted-foreground">
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
