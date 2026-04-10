import * as React from "react";
import { Badge, type BadgeProps } from "./badge";
import { cn } from "../../lib/utils";

export interface StatusBadgeProps extends Omit<BadgeProps, "children"> {
  label: string;
  icon?: React.ReactNode;
}

function StatusBadge({ label, icon, className, ...props }: StatusBadgeProps) {
  return (
    <Badge className={cn("uppercase tracking-wider", className)} {...props}>
      {icon}
      {label}
    </Badge>
  );
}

export { StatusBadge };
