import * as React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  wide?: boolean;
}

/** Marketing container: 1200px default, 1280px for wide preview frames. */
export function Container({ wide = false, className = "", ...props }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full px-6 ${wide ? "max-w-[1280px]" : "max-w-[1200px]"} ${className}`}
      {...props}
    />
  );
}
