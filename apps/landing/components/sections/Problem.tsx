import { BellOff, Network, Receipt } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const PROBLEMS = [
  {
    icon: BellOff,
    accent: "bg-critical",
    title: "Domains expire silently",
    copy: "Spreadsheet dates drift. Auto-renew is off somewhere. You learn from downtime.",
  },
  {
    icon: Receipt,
    accent: "bg-warning",
    title: "Year-1 prices hide renewal spikes",
    copy: "Teaser pricing looks cheap until renewal. See the longer-term cost instead.",
  },
  {
    icon: Network,
    accent: "bg-primary",
    title: "Inventory lives everywhere",
    copy: "Registrar panels, DNS, server dashboards and notes give you no single dependency view.",
  },
];

/** Problem → solution: three premium cards, scroll reveal, no decoration excess. */
export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="bg-background">
      <Container>
        <div className="py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              The problem
            </p>
            <h2
              id="problem-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              Renewals shouldn&apos;t be a surprise
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((problem, index) => (
              <Reveal key={problem.title} delayMs={index * 80}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-micro transition-shadow duration-200 hover:shadow-card">
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-1 ${problem.accent} opacity-80`}
                  />
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-on-primary">
                    <problem.icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-foreground">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{problem.copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
