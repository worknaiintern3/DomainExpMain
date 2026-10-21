import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    number: "01",
    title: "Import your portfolio",
    copy: "Add domains manually or bulk-import CSV and JSON with validation and duplicate detection.",
  },
  {
    number: "02",
    title: "Map accounts & emails",
    copy: "Group registrar and hosting accounts under the billing emails that own them.",
  },
  {
    number: "03",
    title: "Link domains → apps → servers",
    copy: "Build the real dependency graph from domain to application to server.",
  },
  {
    number: "04",
    title: "Monitor & save",
    copy: "Review expiry, TLS, and DNS risks. Export renewal calendars or push webhook alerts.",
  },
];

/**
 * Four-step onboarding rail. Horizontal with connector on desktop,
 * vertical timeline on mobile. Reveal only — no line-draw theatrics.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-20 border-y border-border bg-card"
    >
      <Container>
        <div className="py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              How it works
            </p>
            <h2
              id="how-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              From spreadsheet to mapped inventory
            </h2>
          </Reveal>

          <ol className="relative mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span
              aria-hidden="true"
              className="absolute top-5 right-[12%] left-[12%] hidden border-t-2 border-dashed border-border lg:block"
            />
            {STEPS.map((step, index) => (
              <Reveal key={step.number} delayMs={index * 80}>
                <li className="relative flex gap-4 lg:flex-col lg:gap-0">
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-12 bottom-0 left-5 border-l-2 border-dashed border-border lg:hidden"
                    />
                  )}
                  <span className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-sm font-semibold text-primary">
                    {step.number}
                  </span>
                  <div className="pb-2 lg:mt-4 lg:pt-2">
                    <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
