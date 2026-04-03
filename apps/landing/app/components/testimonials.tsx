const testimonials = [
  {
    initials: "AK",
    name: "Alex Kowalski",
    role: "Quantitative Analyst",
    text: "The visual canvas builder is incredible. I wired up IF/THEN blocks, logic gates, and variables into a full strategy in under an hour. Backtesting gave me the confidence to go live, and the advanced orders keep my risk locked down.",
  },
  {
    initials: "SR",
    name: "Sarah Reeves",
    role: "Independent Trader",
    text: "Copy trading changed everything for me. I follow two whale wallets and mirror their trades automatically. The whale tracker alerts me the moment big money moves, and I can react instantly without staring at screens all day.",
  },
  {
    initials: "MC",
    name: "Marcus Chen",
    role: "Crypto Fund Analyst",
    text: "The AI signals pipeline is a game-changer. It picks up breaking news, matches it to markets I care about, and generates trade signals before I even see the headline. I just review and approve. My hit rate has never been higher.",
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
            className="text-[clamp(24px,4vw,34px)] font-bold text-pf-text mb-4"
          >
            Trusted by traders
          </h2>
          <p className="text-pf-subhead text-pf-text-secondary">
            Early adopters are already building their edge.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="animate-fade-in bg-pf-base border border-pf-border-subtle rounded-pf-lg p-6 sm:p-8 transition-all duration-200 hover:border-pf-cyan-500/20"
            >
              <div
                className="text-5xl font-extrabold leading-none text-pf-cyan-500/15 -mb-2 font-serif"
                aria-hidden="true"
              >
                &ldquo;
              </div>
              <blockquote>
                <p className="text-sm text-pf-text-secondary leading-7 italic mb-6">
                  {t.text}
                </p>
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-pf-full bg-gradient-to-br from-pf-cyan-500/20 to-pf-cyan-500/5 border border-pf-cyan-500/25 flex items-center justify-center text-pf-body-sm font-semibold text-pf-cyan-400 font-mono shrink-0"
                  aria-hidden="true"
                >
                  {t.initials}
                </div>
                <cite className="not-italic">
                  <div className="text-sm font-semibold text-pf-text">
                    {t.name}
                  </div>
                  <div className="text-xs text-pf-text-muted mt-1">
                    {t.role}
                  </div>
                </cite>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
