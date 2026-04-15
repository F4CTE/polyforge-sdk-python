import * as React from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          className="peer sr-only"
          onChange={handleChange}
          {...props}
        />
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-pf-xs border border-default bg-app",
            "transition-colors duration-pf-fast",
            "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
            "peer-checked:bg-accent peer-checked:border-accent",
            "peer-disabled:opacity-pf-disabled peer-disabled:cursor-not-allowed",
            className
          )}
          aria-hidden="true"
        >
          <Check className="hidden h-3 w-3 text-inverse peer-checked:block" />
        </span>
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
