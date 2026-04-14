import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full px-3 py-2 text-sm rounded-pf-sm border border-pf-border bg-pf-base text-pf-text",
          "placeholder:text-pf-text-tertiary resize-y min-h-pf-textarea-min",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40 focus-visible:border-pf-cyan-500",
          "disabled:opacity-pf-disabled disabled:cursor-not-allowed",
          "transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
