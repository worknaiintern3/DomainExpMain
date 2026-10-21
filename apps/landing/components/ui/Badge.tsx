import * as React from "react";

type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "critical"
  | "mono";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-muted text-foreground border-border",
  brand: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success-bg text-success-text border-success-border",
  warning: "bg-warning-bg text-warning-text border-warning-border",
  critical: "bg-critical-bg text-critical-text border-critical-border",
  mono: "bg-card text-muted-foreground border-border font-mono",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Small status/label pill. Never the only carrier of meaning — pair with text. */
export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight whitespace-nowrap ${toneStyles[tone]} ${className}`}
      {...props}
    />
  );
}
