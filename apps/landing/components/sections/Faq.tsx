"use client";

import * as React from "react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const FAQS = [
  {
    question: "Does DomainPulse renew or transfer domains for me?",
    answer:
      "No. Purchases, billing, transfers, and automatic renewals stay with your registrars. DomainPulse tracks dates, costs, and risks so you act in time — it never touches your registrations.",
  },
  {
    question: "Where do registrar prices come from?",
    answer:
      "Official registrar APIs, checked through DomainPulse's central service — you never connect your own account to search. A dash means the registrar didn't return that price; nothing is scraped or estimated.",
  },
  {
    question: "Why does an expiry show as Unknown?",
    answer:
      "The registry redacted the date or the RDAP lookup timed out. Refresh the record or check DNS — the product labels unconfirmed data instead of guessing.",
  },
  {
    question: "Do you convert currencies?",
    answer:
      "No. Registrars price in their own currencies, and there is no exchange-rate source — so different currencies are never converted, summed, or ranked against each other.",
  },
  {
    question: "Where is my portfolio data stored?",
    answer:
      "In your workspace inventory, with TRACKED and ARCHIVED states and a provenance label on every record — user-added, imported, or retrieved from RDAP, DNS, SSL, or HTTP.",
  },
  {
    question: "Which TLDs are covered?",
    answer:
      ".com, .in, .co.in, .ai, .io, .org, .net, .co, .tech, .app, .dev, .xyz, and more. Availability states distinguish available, premium, registered, and unconfigured providers.",
  },
  {
    question: "How do alerts reach me?",
    answer:
      "An in-app center with open, acknowledged, and resolved states, .ics calendar exports for Google, Apple, and Outlook, plus Slack, Discord, and Telegram webhooks.",
  },
  {
    question: "Is this a production SaaS?",
    answer:
      "DomainPulse is a complete working portfolio product. Billing, single sign-on, and scaled infrastructure are future production work — the landing page makes no subscription promises.",
  },
];

/** Accessible accordion: native buttons, aria-expanded, keyboard free, 200ms. */
export function Faq() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 border-y border-border bg-card">
      <Container>
        <div className="mx-auto max-w-3xl py-16 md:py-20">
          <Reveal>
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase">
              FAQ
            </p>
            <h2
              id="faq-heading"
              className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl"
            >
              Honest answers, upfront
            </h2>
          </Reveal>
          <div className="mt-8 flex flex-col gap-3">
            {FAQS.map((faq, index) => {
              const open = openIndex === index;
              const panelId = `faq-panel-${index}`;
              const buttonId = `faq-button-${index}`;
              return (
                <Reveal key={faq.question} delayMs={Math.min(index, 3) * 60}>
                  <div
                    className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                      open ? "border-primary/30 bg-background" : "border-border bg-background"
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        id={buttonId}
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setOpenIndex(open ? null : index)}
                        className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-display text-[15px] font-bold tracking-tight text-foreground md:text-base">
                          {faq.question}
                        </span>
                        <span
                          className="faq-chevron inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
                          data-open={open}
                          aria-hidden="true"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M4 6l4 4 4-4"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="faq-panel"
                      data-open={open}
                    >
                      <div className="faq-inner">
                        <p className="px-5 pb-5 text-[15px] leading-6 text-muted-foreground">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
