"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sun, Moon, Menu, X, Search, ArrowRight } from "lucide-react";
import { PolyforgeLogomark } from "@polyforge/ui";

const NAV_LINKS = [
  { href: "#product", label: "product" },
  { href: "#blocks", label: "blocks" },
  { href: "#whales", label: "whales" },
  { href: "/api-docs", label: "developers" },
  { href: "/pricing", label: "pricing" },
] as const;

const MOBILE_NAV_LINKS = [
  ...NAV_LINKS,
  { href: "/login", label: "sign in" },
] as const;

function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.setAttribute(
      "data-theme",
      next ? "light" : "dark",
    );
    localStorage.setItem("polyforge:theme", next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-transparent text-secondary hover:text-primary hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
    >
      {isLight ? (
        <Moon size={14} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Sun size={14} strokeWidth={1.5} aria-hidden="true" />
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
      className="sticky top-0 z-50 bg-app/85 backdrop-blur-xl saturate-[1.4] border-b border-subtle"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-7 h-16 max-w-[1200px] mx-auto px-6 md:px-8">
        {/* Logo + beta chip */}
        <a
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-primary shrink-0 tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
          aria-label="Polyforge home"
        >
          <PolyforgeLogomark size={20} className="text-accent-text" />
          <span>polyforge</span>
          <span className="inline-flex items-center h-[18px] px-2 ml-1.5 rounded text-caption font-medium bg-elevated border border-subtle text-secondary">
            beta
          </span>
        </a>

        {/* Desktop nav links — hidden below 820px */}
        <div className="hidden min-[820px]:flex gap-6">
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

        {/* Right section */}
        <div className="hidden min-[820px]:flex gap-2 items-center ml-auto">
          {/* Search button */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-transparent text-secondary hover:text-primary hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
            aria-label="Search markets"
          >
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            <kbd className="inline-flex items-center justify-center min-w-[16px] h-[18px] px-1 rounded bg-elevated border border-default font-mono text-caption text-tertiary">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />

          <a
            href="/login"
            className="inline-flex items-center justify-center text-sm font-medium h-7 px-4 rounded-md bg-transparent text-primary border border-default hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
          >
            sign in
          </a>
          <a
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm font-semibold h-7 px-4 rounded-md bg-accent text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text transition-colors duration-micro"
          >
            start free
            <ArrowRight size={13} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          ref={menuButtonRef}
          type="button"
          className="flex min-[820px]:hidden items-center justify-center w-10 h-10 bg-transparent border-none cursor-pointer ml-auto hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          onClick={toggleMobile}
        >
          {mobileOpen ? (
            <X size={20} className="text-secondary" aria-hidden="true" />
          ) : (
            <Menu size={20} className="text-secondary" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        ref={menuRef}
        id="mobile-nav-menu"
        role="navigation"
        aria-modal={mobileOpen || undefined}
        aria-label="Mobile navigation"
        className={`${mobileOpen ? "flex" : "hidden"} min-[820px]:hidden flex-col gap-1 px-6 pb-4 border-t border-subtle`}
      >
        {MOBILE_NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            onClick={closeMobile}
            className="py-2 text-sm text-secondary border-b border-subtle hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text rounded-sm transition-colors duration-micro"
          >
            {label}
          </a>
        ))}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-subtle">
          <ThemeToggle />
          <a
            href="/register"
            onClick={closeMobile}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md bg-accent text-white transition-colors duration-micro hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
          >
            start free
            <ArrowRight size={13} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </div>
    </nav>
  );
}
