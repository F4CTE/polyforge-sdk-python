"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue {
  active: string;
  setActive: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [internalActive, setInternalActive] = React.useState(defaultValue);
  const active = value ?? internalActive;
  const setActive = (v: string) => {
    setInternalActive(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "relative flex gap-1 bg-elevated border border-default rounded-lg p-1 w-fit",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, children, ...props }, ref) => {
    const { active, setActive } = useTabs();
    const isActive = active === value;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => setActive(value)}
        className={cn(
          "relative px-4 py-2 text-sm rounded-sm transition-colors duration-micro",
          "focus-visible:outline-none focus-visible:shadow-focus-ring",
          isActive
            ? "bg-accent-subtle text-accent font-medium"
            : "text-secondary hover:text-primary",
          className
        )}
        {...props}
      >
        {children}
        {/* Sliding underline accent on active tab */}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-accent transition-all duration-micro"
          />
        )}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, ...props }, ref) => {
    const { active } = useTabs();
    if (active !== value) return null;
    return (
      <div
        key={value}
        ref={ref}
        role="tabpanel"
        className={cn("mt-4 animate-tab-content-in", className)}
        {...props}
      />
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
