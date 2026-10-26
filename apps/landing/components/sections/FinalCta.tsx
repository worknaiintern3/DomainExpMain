import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { REGISTER_URL } from "@/lib/site";

/** Dark final CTA band. The single approved use of the indigo glow. */
export function FinalCta() {
  return (
    <section
      id="get-started"
      aria-labelledby="cta-heading"
      className="relative scroll-mt-20 overflow-hidden bg-dark-bg"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 90% at 50% 110%, rgba(79, 70, 229, 0.35) 0%, rgba(79, 70, 229, 0) 70%)",
        }}
      />
      <Container>
        <div className="relative py-16 text-center md:py-24">
          <Reveal className="mx-auto max-w-2xl">
            <h2
              id="cta-heading"
              className="font-display text-3xl font-bold tracking-tight text-balance text-white md:text-5xl"
            >
              Stop babysitting spreadsheets.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
              Bring every expiry into one view.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={REGISTER_URL}
                className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-xl bg-white px-7 text-base font-semibold text-foreground transition-colors hover:bg-slate-200 sm:w-auto"
              >
                Explore live
              </a>
              <Link
                href="#pricing-truth"
                className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-xl border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                See pricing truth
              </Link>
            </div>
            <p className="mt-6 font-mono text-xs tracking-wide text-slate-500">
              Stored records + live checks · Missing data shown as “—”, never guessed
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
