import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-pf-label font-medium uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-pf-cyan-500/10 text-pf-cyan-500 border border-pf-cyan-500/20",
        secondary:
          "bg-pf-elevated text-pf-text-secondary border border-pf-border",
        success:
          "bg-pf-success/10 text-pf-success border border-pf-success/20",
        danger:
          "bg-pf-danger/10 text-pf-danger border border-pf-danger/20",
        warning:
          "bg-pf-warning/10 text-pf-warning border border-pf-warning/20",
        info:
          "bg-pf-info/10 text-pf-info border border-pf-info/20",
        ghost:
          "bg-transparent text-pf-text-muted",
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
