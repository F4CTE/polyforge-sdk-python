import * as React from "react";
import { cn } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/*  CardSkeleton — shimmer wrapper matching Card's visual shell       */
/* ------------------------------------------------------------------ */

interface CardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Override default padding (p-4). Pass e.g. "p-5" when needed. */
  padding?: string;
}

function CardSkeleton({
  className,
  padding = "p-4",
  children,
  ...props
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-elevated border border-subtle rounded-lg animate-shimmer",
        padding,
        children ? "space-y-3" : "",
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonLine — rectangular placeholder bar                        */
/* ------------------------------------------------------------------ */

interface SkeletonLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Height class, e.g. "h-3", "h-4", "h-5", "h-8", "h-9". Default "h-3". */
  h?: string;
  /** Width class, e.g. "w-[50%]", "w-full", "w-24". Default "w-full". */
  w?: string;
}

function SkeletonLine({
  className,
  h = "h-3",
  w = "w-full",
  ...props
}: SkeletonLineProps) {
  return (
    <div
      className={cn("bg-overlay rounded", h, w, className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCircle — rounded placeholder (avatars, icons, badges)     */
/* ------------------------------------------------------------------ */

interface SkeletonCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size class, e.g. "size-10", "w-12 h-12". Default "size-10". */
  size?: string;
  /** Border-radius override. Default "rounded-full". */
  rounded?: string;
}

function SkeletonCircle({
  className,
  size = "size-10",
  rounded = "rounded-full",
  ...props
}: SkeletonCircleProps) {
  return (
    <div
      className={cn("bg-overlay shrink-0", size, rounded, className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonBadge — pill-shaped placeholder for chips / badges        */
/* ------------------------------------------------------------------ */

interface SkeletonBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Height class. Default "h-5". */
  h?: string;
  /** Width class. Default "w-16". */
  w?: string;
}

function SkeletonBadge({
  className,
  h = "h-5",
  w = "w-16",
  ...props
}: SkeletonBadgeProps) {
  return (
    <div
      className={cn("bg-overlay rounded-full", h, w, className)}
      {...props}
    />
  );
}

export { CardSkeleton, SkeletonLine, SkeletonCircle, SkeletonBadge };
export type {
  CardSkeletonProps,
  SkeletonLineProps,
  SkeletonCircleProps,
  SkeletonBadgeProps,
};
