import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-xs px-2 py-1 text-label font-medium uppercase tracking-wider transition-colors duration-micro",
  {
    variants: {
      variant: {
        default:
          "bg-accent-subtle text-accent border border-accent-border",
        secondary:
          "bg-elevated text-secondary border border-default",
        success:
          "bg-gain-subtle text-gain border border-gain-border",
        danger:
          "bg-loss-subtle text-loss border border-loss-border",
        warning:
          "bg-warning-subtle text-warning border border-warning-border",
        info:
          "bg-info-subtle text-info border border-info-border",
        ghost:
          "bg-transparent text-tertiary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
