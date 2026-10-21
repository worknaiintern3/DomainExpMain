import * as React from "react";
import { Container } from "./Container";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  wide?: boolean;
  dark?: boolean;
}

/** Section rhythm: 96 desktop / 64 tablet / 48 mobile. */
export function Section({
  wide = false,
  dark = false,
  className = "",
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={`py-12 md:py-16 lg:py-24 ${dark ? "bg-dark-bg text-white" : ""} ${className}`}
      {...props}
    >
      <Container wide={wide}>{children}</Container>
    </section>
  );
}
