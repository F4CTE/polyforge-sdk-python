import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex w-full appearance-none px-3 py-2 pr-8 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:border-pf-cyan-500",
            "disabled:opacity-pf-disabled disabled:cursor-not-allowed",
            "transition-colors cursor-pointer",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-secondary pointer-events-none"
          aria-hidden="true"
        />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
