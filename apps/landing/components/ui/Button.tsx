import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover shadow-micro active:scale-[0.99]",
  secondary:
    "bg-card text-foreground border border-border hover:bg-muted shadow-micro",
  ghost: "bg-transparent text-foreground hover:bg-muted",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 gap-1.5 text-[13px] font-semibold",
  md: "min-h-[44px] px-5 gap-2 text-sm font-semibold",
  lg: "min-h-[52px] px-6 gap-2 text-base font-semibold",
};

/**
 * Precision Ops Minimal button.
 * Always meets 44px touch target at md/lg. sm is for dense in-console use only.
 */
export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center rounded-xl transition-colors duration-200 select-none disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    />
  );
}
