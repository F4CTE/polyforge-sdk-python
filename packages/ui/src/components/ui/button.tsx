import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-pf-cyan-500 text-pf-text-contrast hover:bg-pf-cyan-400 hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-pf-cyan-500)_30%,transparent)]",
        secondary:
          "bg-transparent border border-pf-border-subtle text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated",
        ghost:
          "bg-transparent text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated",
        danger:
          "bg-pf-danger/10 text-pf-danger hover:bg-pf-danger/20",
        success:
          "bg-pf-success/10 text-pf-success hover:bg-pf-success/20",
        link:
          "text-pf-cyan-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 rounded-pf",
        sm: "h-7 px-3 py-1 text-xs rounded-pf",
        lg: "h-11 px-6 py-3 rounded-pf",
        icon: "h-9 w-9 rounded-pf",
        "icon-sm": "h-7 w-7 rounded-pf",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type BaseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

/** Non-icon buttons: aria-label is optional */
type NonIconButtonProps = BaseButtonProps & {
  size?: Exclude<NonNullable<BaseButtonProps["size"]>, "icon" | "icon-sm">;
};

/** Icon-only buttons: aria-label is required (WCAG 4.1.2) */
type IconButtonProps = BaseButtonProps & {
  size: "icon" | "icon-sm";
  "aria-label": string;
};

export type ButtonProps = NonIconButtonProps | IconButtonProps;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }: ButtonProps, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), loading && "pointer-events-none opacity-70")}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
