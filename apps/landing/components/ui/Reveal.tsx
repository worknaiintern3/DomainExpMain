"use client";

import * as React from "react";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
}

/**
 * One-time scroll reveal (opacity + 12px rise). Renders visible by default
 * for no-JS / reduced-motion; IntersectionObserver only enhances.
 */
export function Reveal({ delayMs = 0, className = "", ...props }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      {...props}
    />
  );
}
