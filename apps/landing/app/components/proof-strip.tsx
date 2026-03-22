const stats = [
  { number: '500+', label: 'Markets tracked' },
  { number: '24/7', label: 'Automated execution' },
  { number: '< 50 ms', label: 'Order latency' },
  { number: 'Free', label: 'During beta' },
];

export function ProofStrip() {
  return (
    <section
      className="py-7 border-t border-b border-pf-border-subtle bg-pf-surface"
      aria-label="Platform statistics"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="flex items-center justify-center flex-wrap">
          {stats.map((stat, i) => (
            <div key={stat.label} className="contents">
              {i > 0 && (
                <div
                  className="w-px h-12 bg-pf-border-subtle hidden sm:block"
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col items-center gap-1 px-10 py-3 sm:px-10">
                <span className="text-[28px] font-bold text-pf-cyan-300 font-mono">
                  {stat.number}
                </span>
                <span className="text-[13px] text-pf-text-muted">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
