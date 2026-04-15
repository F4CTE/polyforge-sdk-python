import * as React from "react";
import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-pf-sm bg-overlay animate-shimmer", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
