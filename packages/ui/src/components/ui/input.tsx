import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text",
          "placeholder:text-pf-text-tertiary",
          "focus:outline-none focus:ring-1 focus:ring-pf-cyan-500 focus:border-pf-cyan-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
