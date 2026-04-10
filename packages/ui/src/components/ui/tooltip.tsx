import * as React from "react";
import { cn } from "../../lib/utils";

export interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const sideStyles: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
  left: "right-full top-1/2 -translate-y-1/2 mr-1",
  right: "left-full top-1/2 -translate-y-1/2 ml-1",
};

function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const id = React.useId();
  const tooltipId = `tooltip-${id}`;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <div aria-describedby={visible ? tooltipId : undefined} className="contents">
        {children}
      </div>
      <div
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap",
          "bg-pf-elevated border border-pf-border text-pf-text text-xs rounded-pf-sm px-2 py-1 shadow-pf-lg",
          "transition-all duration-pf-fast",
          sideStyles[side],
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
          className
        )}
      >
        {content}
      </div>
    </div>
  );
}

export { Tooltip };
