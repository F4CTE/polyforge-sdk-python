const stats = [
  { number: "50+", label: "Strategy blocks" },
  { number: "24/7", label: "Execution" },
  { number: "< 50 ms", label: "Latency" },
  { number: "3", label: "Official SDKs" },
];

export function ProofStrip() {
  return (
    <section
      className="py-7 border-t border-b border-pf-border-subtle bg-pf-surface"
      aria-label="Platform statistics"
    >
      <div className="max-w-[1100px] mx-auto px-6">
        <dl className="flex items-center justify-center flex-wrap m-0">
          {stats.map((stat, i) => (
            <div key={stat.label} className="contents">
              {i > 0 && (
                <div
                  className="w-px h-12 bg-pf-border-subtle hidden sm:block"
                  role="separator"
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col items-center gap-1 px-4 sm:px-10 py-3">
                <dt className="order-2 text-xs sm:text-[13px] text-pf-text-muted">
                  {stat.label}
                </dt>
                <dd className="order-1 m-0 text-xl sm:text-[28px] font-extrabold text-pf-cyan-400 tracking-tight">
                  {stat.number}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
