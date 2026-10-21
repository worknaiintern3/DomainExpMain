import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const REGISTRARS = [
  "Cloudflare",
  "Namecheap",
  "GoDaddy",
];

const TLDS = [".com", ".in", ".ai", ".io", ".org", ".dev"];

/**
 * Proof strip. Text chips only — no logo images, no customer claims.
 * Static; no marquee.
 */
export function ProofStrip() {
  return (
    <section aria-label="Registrars and extensions covered" className="border-y border-border bg-card">
      <Container>
        <Reveal className="flex flex-col gap-5 py-10">
          <p className="text-center text-[13px] font-medium text-muted-foreground">
            Registrar integrations supported by DomainPulse central search
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Registrars">
            {REGISTRARS.map((name) => (
              <li
                key={name}
                className="inline-flex min-h-[36px] items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
          <ul
            className="flex flex-wrap items-center justify-center gap-1.5"
            aria-label="Extensions"
          >
            {TLDS.map((tld) => (
              <li
                key={tld}
                className="inline-flex min-h-[32px] items-center rounded-full bg-muted px-3 font-mono text-[13px] text-muted-foreground"
              >
                {tld}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
