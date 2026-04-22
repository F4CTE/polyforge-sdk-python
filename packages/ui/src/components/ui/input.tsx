import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full px-3 py-2 text-sm rounded-pf border border-default bg-app text-primary",
          "placeholder:text-tertiary",
          "focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:border-accent",
          "disabled:opacity-disabled disabled:cursor-not-allowed",
          "transition-colors duration-panel",
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
