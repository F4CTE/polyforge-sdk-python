import * as React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-pf-full",
          "transition-colors duration-pf-fast",
          props.disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          className="peer sr-only"
          onChange={handleChange}
          {...props}
        />
        <span
          className={cn(
            "absolute inset-0 rounded-pf-full bg-pf-overlay",
            "transition-colors duration-pf-fast",
            "peer-checked:bg-pf-cyan-500",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-pf-cyan-500/40"
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-pf-full bg-pf-text-contrast",
            "shadow-pf-sm transition-transform duration-pf-fast",
            "peer-checked:translate-x-4"
          )}
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
