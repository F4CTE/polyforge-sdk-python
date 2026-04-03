export function CtaBanner() {
  return (
    <section className="py-24" aria-labelledby="cta-heading">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="relative overflow-hidden bg-pf-surface border border-pf-cyan-500/20 rounded-pf-lg px-6 sm:px-12 py-12 sm:py-16 text-center">
          {/* Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none cta-glow"
            aria-hidden="true"
          />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 pointer-events-none cta-dots"
            aria-hidden="true"
          />

          <h2
            id="cta-heading"
            className="relative text-[clamp(24px,4vw,36px)] font-bold text-pf-text mb-4"
          >
            Ready to gain your edge?
          </h2>
          <p className="relative text-base text-pf-text-secondary max-w-[480px] mx-auto mb-8 leading-relaxed">
            Join thousands of traders who use PolyForge to make smarter
            predictions.
          </p>

          <a
            href="/signup"
            className="relative inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-pf-text-contrast font-semibold text-[16px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Get Started Free &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
