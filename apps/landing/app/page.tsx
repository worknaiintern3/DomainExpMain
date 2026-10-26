import { Hero } from "@/components/hero/Hero";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Personas } from "@/components/sections/Personas";
import { Preview } from "@/components/sections/Preview";
import { PricingTruth } from "@/components/sections/PricingTruth";
import { Problem } from "@/components/sections/Problem";
import { ProofStrip } from "@/components/sections/ProofStrip";

/**
 * Landing page. Phase 7 order: Proof → Problem → Bento → How →
 * Preview → Pricing Truth → Personas → FAQ → Final CTA.
 */
export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col bg-background">
      <Hero />
      <ProofStrip />
      <Problem />
      <Features />
      <HowItWorks />
      <Preview />
      <PricingTruth />
      <Personas />
      <Faq />
      <FinalCta />
    </main>
  );
}
