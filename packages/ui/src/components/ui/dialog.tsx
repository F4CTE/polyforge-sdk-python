"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useDelayedUnmount } from "../../lib/use-delayed-unmount";

const DialogStateContext = React.createContext<"open" | "closed">("open");

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const { mounted, visible } = useDelayedUnmount(open, 120);

  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  const state = visible ? "open" : "closed";

  return (
    <DialogStateContext.Provider value={state}>
      <div
        role="presentation"
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div
          data-state={state}
          className="animate-backdrop absolute inset-0 bg-backdrop backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </DialogStateContext.Provider>
  );
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const state = React.useContext(DialogStateContext);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      data-state={state}
      className={cn(
        "relative z-10 w-full max-w-lg bg-elevated border border-default rounded-lg [box-shadow:var(--shadow-elevation-3)]",
        "animate-dialog-content",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DialogContent.displayName = "DialogContent";

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

function DialogHeader({ className, children, onClose, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-default",
        className
      )}
      {...props}
    >
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="ml-4 p-1 rounded-sm text-secondary hover:text-primary hover:bg-overlay transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-base font-semibold text-primary", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-secondary mt-1", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
));
DialogBody.displayName = "DialogBody";

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-end gap-2 px-6 py-4 border-t border-default",
      className
    )}
    {...props}
  />
));
DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
};
