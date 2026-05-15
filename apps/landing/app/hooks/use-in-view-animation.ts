"use client";

import { useEffect, useRef, useState } from "react";

interface UseInViewAnimationOptions {
  /** Fraction of the element that must be visible before animating (0–1). Default: 0.15 */
  threshold?: number;
  /** Root margin for IntersectionObserver. Default: "0px" */
  rootMargin?: string;
  /** Only animate once (stop observing after first intersection). Default: true */
  once?: boolean;
}

/**
 * Returns a ref to attach to a DOM element and a boolean `inView` that
 * becomes true once the element reaches the viewport threshold.
 *
 * Use `inView` to drive CSS class application:
 *   className={`opacity-0 translate-y-4 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : ''}`}
 *
 * No external library required — uses the native IntersectionObserver API.
 */
export function useInViewAnimation<T extends Element = HTMLDivElement>(
  options: UseInViewAnimationOptions = {},
) {
  const { threshold = 0.15, rootMargin = "0px", once = true } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}
