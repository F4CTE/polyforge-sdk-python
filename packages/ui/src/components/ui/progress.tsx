import * as React from "react";
import { cn } from "../../lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indeterminate?: boolean;
}

function Progress({ value = 0, indeterminate = false, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={props["aria-label"] ?? "Progress"}
      className={cn("h-1 w-full overflow-hidden rounded-pf-full bg-pf-overlay", className)}
      {...props}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 rounded-pf-full bg-pf-cyan-500 animate-pulse" />
      ) : (
        <div
          className="h-full rounded-pf-full bg-pf-cyan-500 transition-all duration-pf-slow"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

export { Progress };
