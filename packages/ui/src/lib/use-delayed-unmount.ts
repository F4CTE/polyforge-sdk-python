"use client";

import { useState, useEffect } from "react";

/**
 * Keeps a component mounted for `delayMs` after `open` turns false,
 * allowing CSS exit animations to complete before the DOM node is removed.
 *
 * Returns `mounted` (controls render) and `visible` (drives data-state
 * for CSS selectors).
 *
 * Usage:
 *   const { mounted, visible } = useDelayedUnmount(open, 120);
 *   if (!mounted) return null;
 *   return <div data-state={visible ? "open" : "closed"} />;
 */
export function useDelayedUnmount(open: boolean, delayMs: number) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Allow one frame for mount before setting visible so entry animation fires
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), delayMs);
      return () => clearTimeout(timer);
    }
  }, [open, delayMs]);

  return { mounted, visible };
}
