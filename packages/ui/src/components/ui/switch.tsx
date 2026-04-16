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
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
          "transition-colors duration-micro",
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
            "absolute inset-0 rounded-full bg-overlay",
            "transition-colors duration-micro",
            "peer-checked:bg-accent",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute left-px top-px h-4 w-4 rounded-full bg-inverse",
            "shadow-sm transition-transform duration-micro",
            "peer-checked:translate-x-4"
          )}
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
