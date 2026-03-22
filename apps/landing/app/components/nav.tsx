'use client';

import { useState } from 'react';

function PolyforgeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      <path d="M13 5L7.5 13H11L10 19L16.5 11H13L13 5Z" fill="currentColor" />
    </svg>
  );
}

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 bg-pf-base/85 backdrop-blur-xl border-b border-pf-border-subtle"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-8 h-16 max-w-[1100px] mx-auto px-6">
        <a
          href="/"
          className="flex items-center gap-2 text-[17px] font-bold text-pf-text shrink-0"
          aria-label="Polyforge home"
        >
          <PolyforgeIcon className="text-pf-cyan-400" />
          <span>Polyforge</span>
        </a>

        <div className="hidden md:flex gap-6 mr-auto">
          <a
            href="#features"
            className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
          >
            How it works
          </a>
          <a
            href="/terms"
            className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
          >
            Terms
          </a>
          <a
            href="/privacy"
            className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
          >
            Privacy
          </a>
        </div>

        <div className="hidden md:flex gap-2">
          <a
            href="/login"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-transparent text-pf-text-secondary border border-pf-border-subtle hover:text-pf-text hover:bg-pf-elevated transition-colors"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors"
          >
            Get early access
          </a>
        </div>

        <button
          className="flex md:hidden flex-col gap-1 bg-transparent border-none cursor-pointer p-1 ml-auto"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
          <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
          <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
        </button>
      </div>

      {mobileOpen && (
        <div className="flex md:hidden flex-col gap-1 px-6 pb-4 border-t border-pf-border-subtle">
          <a
            href="#features"
            className="py-2 text-[15px] text-pf-text-secondary border-b border-pf-border-subtle hover:text-pf-text"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="py-2 text-[15px] text-pf-text-secondary border-b border-pf-border-subtle hover:text-pf-text"
          >
            How it works
          </a>
          <a
            href="/login"
            className="py-2 text-[15px] text-pf-text-secondary border-b border-pf-border-subtle hover:text-pf-text"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="mt-2 block text-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-black hover:bg-pf-cyan-400 transition-colors"
          >
            Get early access
          </a>
        </div>
      )}
    </nav>
  );
}
