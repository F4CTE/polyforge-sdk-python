import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const chipVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium",
  {
    variants: {
      variant: {
        default: "bg-pf-overlay text-pf-text",
        success: "bg-pf-success/20 text-pf-success",
        danger: "bg-pf-danger/20 text-pf-danger",
        warning: "bg-pf-warning/20 text-pf-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  onRemove?: () => void;
}

function Chip({ children, onRemove, variant, className, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant }), className)} {...props}>
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="hover:opacity-70 cursor-pointer focus:outline-none"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export { Chip, chipVariants };
