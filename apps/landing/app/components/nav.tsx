"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sun, Moon, Menu, X } from "lucide-react";
import { PolyforgeLogomark } from "@polyforge/ui";

const MOBILE_NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/login", label: "Sign in" },
] as const;

function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("pf-theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("pf-theme", "dark");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-pf-sm border border-pf-border-subtle text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 transition-colors duration-pf-fast"
    >
      {isLight ? (
        <Moon size={18} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Sun size={18} strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
}

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    }
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [mobileOpen]);

  // Focus management: move focus into menu on open, return to button on close
  useEffect(() => {
    if (mobileOpen) {
      const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  // Focus trap: keep Tab within the open menu
  useEffect(() => {
    if (!mobileOpen || !menuRef.current) return;
    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [mobileOpen]);

  return (
    <nav
      className="sticky top-0 z-50 bg-pf-base/85 backdrop-blur-xl border-b border-pf-border-subtle"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-4 md:gap-8 h-16 max-w-pf-container-landing mx-auto px-6">
        <a
          href="/"
          className="flex items-center gap-2 text-pf-subhead font-bold text-pf-text shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm"
          aria-label="Polyforge home"
        >
          <PolyforgeLogomark size={26} className="text-pf-cyan-400" />
          <span>Polyforge</span>
        </a>

        <div className="hidden md:flex gap-6 mr-auto">
          <a
            href="#features"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            How it works
          </a>
          <a
            href="/terms"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            Terms
          </a>
          <a
            href="/api-docs"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            API Docs
          </a>
          <a
            href="/privacy"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            Privacy
          </a>
        </div>

        <div className="hidden md:flex gap-2 items-center">
          <ThemeToggle />
          <a
            href="/login"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-transparent text-pf-text-secondary border border-pf-border-subtle hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 transition-colors duration-pf-fast"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-pf-text-contrast transition-all duration-pf-normal hover:bg-pf-cyan-400 hover:shadow-pf-glow-cyan-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            Start building free
          </a>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="flex md:hidden flex-col items-center justify-center gap-2 w-11 h-11 bg-transparent border-none cursor-pointer ml-auto hover:bg-pf-text/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          onClick={toggleMobile}
        >
          {mobileOpen ? (
            <X size={22} className="text-pf-text-secondary" aria-hidden="true" />
          ) : (
            <Menu size={22} className="text-pf-text-secondary" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        ref={menuRef}
        id="mobile-nav-menu"
        role="navigation"
        aria-modal={mobileOpen || undefined}
        aria-label="Mobile navigation"
        className={`${mobileOpen ? "flex" : "hidden"} md:hidden flex-col gap-1 px-6 pb-4 border-t border-pf-border-subtle`}
      >
        {MOBILE_NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            onClick={closeMobile}
            className="py-2 text-pf-body text-pf-text-secondary border-b border-pf-border-subtle hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-pf-sm transition-colors duration-pf-fast"
          >
            {label}
          </a>
        ))}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-pf-border-subtle">
          <ThemeToggle />
          <a
            href="/register"
            onClick={closeMobile}
            className="block text-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-pf-text-contrast transition-all duration-pf-normal hover:bg-pf-cyan-400 hover:shadow-pf-glow-cyan-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            Start building free
          </a>
        </div>
      </div>
    </nav>
  );
}
