const testimonials = [
  {
    initials: 'AK',
    name: 'Alex Kowalski',
    role: 'Quantitative Analyst',
    text: 'The strategy builder finally made prediction markets accessible for me. I went from zero automation to three live strategies in a single afternoon. The backtesting gave me confidence before I risked real capital.',
  },
  {
    initials: 'SR',
    name: 'Sarah Reeves',
    role: 'Independent Trader',
    text: 'I was manually trading Polymarket for months. Polyforge let me codify my exact thesis into blocks and run it 24/7. My win rate went from guesswork to measurable and my P&L has never been more consistent.',
  },
  {
    initials: 'MC',
    name: 'Marcus Chen',
    role: 'Crypto Fund Analyst',
    text: 'The community leaderboard is incredibly motivating. I forked a top strategy, tweaked the entry conditions, and it outperformed the original. The iteration cycle is insanely fast compared to writing code from scratch.',
  },
];

export function Testimonials() {
  return (
    <section
      className="py-24 bg-pf-surface border-t border-b border-pf-border-subtle"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center max-w-[600px] mx-auto mb-14">
          <h2
            id="testimonials-heading"
            className="text-[clamp(24px,4vw,34px)] font-bold text-pf-text mb-3.5"
          >
            Trusted by traders
          </h2>
          <p className="text-[17px] text-pf-text-secondary">
            Early adopters are already building their edge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 stagger-children">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="animate-fade-in bg-pf-base border border-pf-border-subtle rounded-pf-lg p-8 transition-all duration-200 hover:border-pf-cyan-500/20 hover:-translate-y-0.5"
            >
              <div
                className="text-5xl font-extrabold leading-none text-pf-cyan-500/15 -mb-2 font-serif"
                aria-hidden="true"
              >
                &ldquo;
              </div>
              <p className="text-sm text-pf-text-secondary leading-7 italic mb-6">
                {t.text}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pf-cyan-500/20 to-pf-cyan-500/5 border border-pf-cyan-500/25 flex items-center justify-center text-[13px] font-semibold text-pf-cyan-400 font-mono shrink-0">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-pf-text">{t.name}</div>
                  <div className="text-xs text-pf-text-muted mt-0.5">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
