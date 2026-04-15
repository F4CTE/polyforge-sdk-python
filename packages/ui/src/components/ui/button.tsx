import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors duration-pf-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-pf-disabled",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-inverse hover:bg-accent-hover hover:shadow-pf-glow-cyan-strong",
        secondary:
          "bg-transparent border border-subtle text-secondary hover:text-primary hover:bg-elevated",
        ghost:
          "bg-transparent text-secondary hover:text-primary hover:bg-elevated",
        danger:
          "bg-loss-subtle text-loss hover:bg-loss/20",
        success:
          "bg-gain-subtle text-gain hover:bg-gain/20",
        link:
          "text-accent underline-offset-4 hover:underline",
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
