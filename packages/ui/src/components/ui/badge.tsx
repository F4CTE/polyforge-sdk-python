import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pf-xs px-2 py-1 text-pf-label font-medium uppercase tracking-wider transition-colors duration-pf-fast",
  {
    variants: {
      variant: {
        default:
          "bg-accent-subtle text-accent border border-accent/20",
        secondary:
          "bg-elevated text-secondary border border-default",
        success:
          "bg-gain-subtle text-gain border border-gain/20",
        danger:
          "bg-loss-subtle text-loss border border-loss/20",
        warning:
          "bg-warning-subtle text-warning border border-warning/20",
        info:
          "bg-info-subtle text-info border border-info/20",
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
