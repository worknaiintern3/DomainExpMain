"use client";

import * as React from "react";
import { FIND_DOMAIN_URL } from "@/lib/site";

const TLDS = [".com", ".in", ".ai", ".io"] as const;

/**
 * Interactive search mock. Composes a domain from input + selected TLD and
 * echoes it with the helper. Live availability is checked in the app.
 */
export function SearchMock() {
  const [name, setName] = React.useState("");
  const [tld, setTld] = React.useState<(typeof TLDS)[number]>(".com");
  const [composed, setComposed] = React.useState<string | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
    if (!clean) {
      setComposed(null);
      return;
    }
    setComposed(`${clean}${tld}`);
  };

  return (
    <div id="hero-search" className="mt-8 w-full max-w-xl scroll-mt-24">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-card p-3 shadow-micro sm:p-4"
      >
        <label
          htmlFor="hero-domain-input"
          className="px-1 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          Find your next domain
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="hero-domain-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Try a name — e.g. acmestudio"
            autoComplete="off"
            spellCheck={false}
            maxLength={63}
            className="h-12 min-h-[48px] w-full min-w-0 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-base text-foreground placeholder:text-muted-foreground/70 focus:border-primary sm:text-sm"
          />
          <button
            type="submit"
            className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold whitespace-nowrap text-on-primary transition-colors hover:bg-primary-hover"
          >
            Preview name
          </button>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-2 px-1"
          role="group"
          aria-label="Choose an extension"
        >
          {TLDS.map((option) => {
            const selected = option === tld;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setTld(option)}
                className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 font-mono text-[13px] font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </form>
      <p className="mt-2.5 px-1 text-[13px] leading-5 text-muted-foreground" role="status">
        {composed ? (
          <>
            <span className="font-mono font-medium text-foreground">{composed}</span>
            {" is a name preview. Availability has not been checked."}
          </>
        ) : (
          "Preview a name here, then check live availability in the app."
        )}
      </p>
      <a
        href={FIND_DOMAIN_URL}
        className="mt-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-[13px] font-semibold text-primary hover:text-primary-hover"
      >
        Open live domain finder →
      </a>
    </div>
  );
}
