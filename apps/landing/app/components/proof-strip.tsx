const stats = [
  { number: "12,400+", label: "Traders" },
  { number: "847", label: "Strategies" },
  { number: "$2.3M", label: "Monthly Volume" },
  { number: "4.8★", label: "Rating" },
];

export function ProofStrip() {
  return (
    <section
      className="py-7 border-t border-b border-pf-border-subtle bg-pf-surface"
      aria-label="Platform statistics"
    >
      <div className="max-w-pf-container-landing mx-auto px-6">
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
                <dt className="order-2 text-xs sm:text-pf-body-sm text-pf-text-muted">
                  {stat.label}
                </dt>
                <dd className="order-1 m-0 text-xl sm:text-2xl font-semibold font-mono text-pf-cyan-400 tracking-tight">
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
