"use client";

import { useState, useEffect } from "react";
import type { MarketTick } from "../data/landing-data";

interface UseTickerOptions {
  volatility?: number;
  interval?: number;
}

export function useTicker(
  initial: MarketTick[],
  { volatility = 0.008, interval = 1400 }: UseTickerOptions = {},
): MarketTick[] {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const prefersReduced = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const id = setInterval(() => {
      setData((prev) =>
        prev.map((row) => {
          if (Math.random() > 0.35) return row;
          const drift = (Math.random() - 0.5) * volatility;
          const next = Math.max(0.01, Math.min(0.99, row.px + drift));
          const chg = +(row.chg + drift * 10).toFixed(1);
          return { ...row, px: +next.toFixed(2), chg };
        }),
      );
    }, interval);

    return () => clearInterval(id);
  }, [volatility, interval]);

  return data;
}
