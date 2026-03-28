'use client';

import { useState, useEffect } from 'react';

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

function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light'));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pf-landing-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('pf-landing-theme', 'dark');
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-pf-sm border border-pf-border-subtle text-pf-text-secondary hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 transition-colors"
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
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
          className="flex items-center gap-2 text-[17px] font-bold text-pf-text shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm"
          aria-label="Polyforge home"
        >
          <PolyforgeIcon className="text-pf-cyan-400" />
          <span>Polyforge</span>
        </a>

        <div className="hidden md:flex gap-6 mr-auto">
          <a
            href="#features"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors duration-150"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors duration-150"
          >
            How it works
          </a>
          <a
            href="/terms"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors duration-150"
          >
            Terms
          </a>
          <a
            href="/api-docs"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors duration-150"
          >
            API Docs
          </a>
          <a
            href="/privacy"
            className="text-sm text-pf-text-secondary hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors duration-150"
          >
            Privacy
          </a>
        </div>

        <div className="hidden md:flex gap-2 items-center">
          <ThemeToggle />
          <a
            href="/login"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-transparent text-pf-text-secondary border border-pf-border-subtle hover:text-pf-text hover:bg-pf-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 transition-colors"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-black transition-all duration-200 hover:bg-pf-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            Start building free
          </a>
        </div>

        <button
          className="flex md:hidden flex-col gap-1.5 bg-transparent border-none cursor-pointer p-1 ml-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-pf-text-secondary">
              <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <>
              <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
              <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
              <span className="block w-[22px] h-0.5 bg-pf-text-secondary rounded-sm" />
            </>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav-menu" className="flex md:hidden flex-col gap-1 px-6 pb-4 border-t border-pf-border-subtle">
          {[
            { href: '#features', label: 'Features' },
            { href: '#how-it-works', label: 'How it works' },
            { href: '/api-docs', label: 'API Docs' },
            { href: '/login', label: 'Sign in' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="py-2 text-[15px] text-pf-text-secondary border-b border-pf-border-subtle hover:text-pf-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400 rounded-sm transition-colors"
            >
              {label}
            </a>
          ))}
          <a
            href="/register"
            onClick={() => setMobileOpen(false)}
            className="mt-2 block text-center text-sm font-semibold px-4 py-2 rounded-pf-sm bg-pf-cyan-500 text-black transition-all duration-200 hover:bg-pf-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-cyan-400"
          >
            Start building free
          </a>
        </div>
      )}
    </nav>
  );
}
