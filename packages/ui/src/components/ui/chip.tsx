import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const chipVariants = cva(
  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium",
  {
    variants: {
      variant: {
        default: "bg-overlay text-primary",
        success: "bg-gain-subtle text-gain",
        danger: "bg-loss-subtle text-loss",
        warning: "bg-warning-subtle text-warning",
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
          className="hover:opacity-70 cursor-pointer focus-visible:outline-none focus-visible:shadow-focus-ring rounded-full"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export { Chip, chipVariants };
