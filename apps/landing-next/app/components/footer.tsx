function PolyforgeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
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

const socialLinks = [
  {
    label: 'Follow on X',
    href: 'https://twitter.com/polyforge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'Join Discord',
    href: 'https://discord.gg/polyforge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
    ),
  },
  {
    label: 'Join Telegram',
    href: 'https://t.me/polyforge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
];

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Early access', href: '/register' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Register', href: '/register' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-pf-surface border-t border-pf-border-subtle pt-15 pb-8" role="contentinfo">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 mb-10">
          {/* Brand */}
          <div className="shrink-0 min-w-[220px]">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-[17px] font-bold text-pf-text mb-2.5"
              aria-label="Polyforge home"
            >
              <PolyforgeIcon className="text-pf-cyan-400" />
              <span>Polyforge</span>
            </a>
            <p className="text-sm text-pf-text-muted mt-1.5">
              Algorithmic trading for prediction markets.
            </p>
            <div className="flex gap-3 mt-5">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  className="w-9 h-9 rounded-pf-sm border border-pf-border-subtle flex items-center justify-center text-pf-text-muted hover:text-pf-cyan-400 hover:border-pf-cyan-500/30 hover:bg-pf-cyan-500/6 transition-colors"
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex gap-8 md:gap-16 flex-wrap flex-1">
            {footerLinks.map((col) => (
              <div key={col.title} className="min-w-[120px]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted mb-3.5">
                  {col.title}
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-pf-text-secondary hover:text-pf-text transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack strip */}
        <div className="flex items-center gap-4 py-4 border-t border-pf-border-subtle">
          <span className="text-xs text-pf-text-muted uppercase tracking-wide">Built with</span>
          {/* NestJS */}
          <svg className="w-5 h-5 text-pf-text-muted opacity-50 hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="currentColor" aria-label="NestJS">
            <path d="M14.131.047c-.173 0-.334.037-.483.087.316.21.49.49.576.806.015.063.027.126.036.19l.012.126c.012.16.004.322-.03.48a1.94 1.94 0 0 1-.142.422c-.088.166-.197.32-.334.445a1.37 1.37 0 0 1-.158.124c.085.022.17.04.255.053a2.33 2.33 0 0 0 1.166-.124l.054-.026.038-.02a.693.693 0 0 1 .1-.04c.063-.019.13-.031.197-.037.275-.012.554.07.779.23-.084-.127-.178-.244-.282-.35A3.232 3.232 0 0 0 14.131.047z" />
          </svg>
          {/* Angular */}
          <svg className="w-5 h-5 text-pf-text-muted opacity-50 hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="currentColor" aria-label="Angular">
            <path d="M9.931 12.645h4.138l-2.07-4.908z" />
            <path d="m12.001.001-11 3.97 1.675 14.528L12 24l9.324-5.5L22.999 3.97 12.001.001zm6.85 17.195h-2.541l-1.37-3.428H9.058l-1.37 3.428H5.147L12 2.677l6.852 14.519z" />
          </svg>
          {/* PostgreSQL */}
          <svg className="w-5 h-5 text-pf-text-muted opacity-50 hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="currentColor" aria-label="PostgreSQL">
            <path d="M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02A10.922 10.922 0 0 0 12.6.258C11.422.238 10.295.497 9.372.945 8.817.717 7.779.353 6.583.353c-.998 0-2.046.275-2.922.917C2.615 2.044 1.89 3.195 1.526 4.84c-.483 2.178-.09 5.032.86 8.386.578 2.043 1.46 3.615 2.564 4.425.554.407 1.177.61 1.833.581.476-.02.937-.18 1.359-.455l.085.08c.505.473 1.122.754 1.803.764l.047.001c.768 0 1.47-.382 1.926-.98.224.217.474.401.748.543.325.17.676.255 1.043.248.378-.008.723-.108 1.034-.286a5.83 5.83 0 0 0 .273-.183l.148-.107c.463.36.963.574 1.49.615l.061.003c.508 0 .972-.166 1.378-.48.413-.322.747-.794.968-1.366a8.403 8.403 0 0 0 .378-1.297c.168-.738.266-1.271.33-1.728.046-.32.073-.594.087-.837.013-.24.02-.433.02-.6a.948.948 0 0 0-.005-.1l-.003-.037.069-.092c.456-.598.78-1.298.943-2.077.09-.432.137-.87.146-1.27v-.004a9.39 9.39 0 0 0-.054-1.27 8.867 8.867 0 0 0-.36-1.608c-.116-.35-.257-.677-.42-.98-.338-.626-.77-1.133-1.275-1.51C19.01.52 18.08.063 17.128 0z" opacity="0.4" />
          </svg>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-pf-border-subtle text-[13px] text-pf-text-muted">
          &copy; 2026 Polyforge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
