"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sun, Moon, Menu, X } from "lucide-react";
import { PolyforgeLogomark } from "@polyforge/ui";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "/api-docs", label: "Developers" },
] as const;

const MOBILE_NAV_LINKS = [
  ...NAV_LINKS,
  { href: "/login", label: "Sign in" },
] as const;

function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    localStorage.setItem("polyforge:theme", next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-sm border border-subtle text-secondary hover:text-primary hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
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
      document.body.classList.add("nav-open");
      window.addEventListener("keydown", handleEscape);
      return () => {
        document.body.classList.remove("nav-open");
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [mobileOpen]);

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
      className="sticky top-0 z-50 bg-app/85 backdrop-blur-xl border-b border-subtle"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-4 md:gap-8 h-16 max-w-container-landing mx-auto px-6">
        <a
          href="/"
          className="flex items-center gap-2 text-display-sm font-semibold text-primary shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
          aria-label="Polyforge home"
        >
          <PolyforgeLogomark size={26} className="text-accent-text" />
          <span>Polyforge</span>
        </a>

        <div className="hidden md:flex gap-6 mr-auto">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm transition-colors duration-micro"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex gap-2 items-center">
          <ThemeToggle />
          <a
            href="/login"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-sm bg-transparent text-secondary border border-subtle hover:text-primary hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-sm bg-accent text-inverse transition-colors duration-micro hover:bg-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            Start free
          </a>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className="flex md:hidden flex-col items-center justify-center gap-2 w-11 h-11 bg-transparent border-none cursor-pointer ml-auto hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          onClick={toggleMobile}
        >
          {mobileOpen ? (
            <X size={22} className="text-secondary" aria-hidden="true" />
          ) : (
            <Menu size={22} className="text-secondary" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        ref={menuRef}
        id="mobile-nav-menu"
        role="navigation"
        aria-modal={mobileOpen || undefined}
        aria-label="Mobile navigation"
        className={`${mobileOpen ? "flex" : "hidden"} md:hidden flex-col gap-1 px-6 pb-4 border-t border-subtle`}
      >
        {MOBILE_NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            onClick={closeMobile}
            className="py-2 text-body-md text-secondary border-b border-subtle hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm transition-colors duration-micro"
          >
            {label}
          </a>
        ))}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-subtle">
          <ThemeToggle />
          <a
            href="/register"
            onClick={closeMobile}
            className="block text-center text-sm font-semibold px-4 py-2 rounded-sm bg-accent text-inverse transition-colors duration-micro hover:bg-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            Start free
          </a>
        </div>
      </div>
    </nav>
  );
}
