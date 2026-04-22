import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full px-3 py-2 text-sm rounded-pf border border-default bg-app text-primary",
          "placeholder:text-tertiary resize-y min-h-textarea-min",
          "focus-visible:outline-none focus-visible:shadow-focus-ring focus-visible:border-accent",
          "disabled:opacity-disabled disabled:cursor-not-allowed",
          "transition-colors duration-panel",
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
