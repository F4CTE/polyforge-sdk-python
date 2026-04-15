import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Context ──────────────────────────────────────────────────────────────────

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu components must be used inside <DropdownMenu>");
  return ctx;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

function DropdownMenu({ children, className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </DropdownMenuContext.Provider>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function DropdownMenuTrigger({ children, className, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu();

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40", className)}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(!open);
        }
        props.onKeyDown?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

export interface DropdownMenuContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

function DropdownMenuContent({ children, className, align = "start" }: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = contentRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])'
        );
        if (!items?.length) return;
        const arr = Array.from(items);
        const current = document.activeElement as HTMLElement;
        const idx = arr.indexOf(current);
        if (e.key === "ArrowDown") {
          arr[(idx + 1) % arr.length]?.focus();
        } else {
          arr[(idx - 1 + arr.length) % arr.length]?.focus();
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        "absolute z-50 mt-1 min-w-pf-dropdown-min p-1",
        "bg-pf-elevated border border-pf-border rounded-pf shadow-pf-lg",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelect?: () => void;
  disabled?: boolean;
}

function DropdownMenuItem({ children, onSelect, disabled, className, ...props }: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenu();

  const handleSelect = () => {
    if (disabled) return;
    onSelect?.();
    setOpen(false);
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={cn(
        "px-2 py-1 text-sm rounded-pf-xs cursor-pointer select-none outline-none",
        "hover:bg-pf-overlay focus-visible:bg-pf-overlay",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
        props.onKeyDown?.(e);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("my-1 h-px bg-pf-border", className)} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
