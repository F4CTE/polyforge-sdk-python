function Registry() {
  const [show] = useTweak('showBlockRegistry');
  if (!show) return null;

  const groups = [
    { key: 'trigger',   label: 'Triggers',   hint: 'event + tick',                 color: 'var(--accent-text)',     sample: ['price_crosses_up','volume_rate_tick','time_before_close'] },
    { key: 'condition', label: 'Conditions', hint: 'liquidity · limits · windows', color: 'var(--color-purple-400)', sample: ['min_liquidity','max_position','time_window'] },
    { key: 'action',    label: 'Actions',    hint: 'GTC · FOK · stops · scales',   color: 'var(--gain-text)',        sample: ['buy_yes','set_stop_loss','scale_out'] },
    { key: 'safety',    label: 'Safety',     hint: 'circuit breakers',             color: 'var(--warning)',          sample: ['stop_if_daily_loss','stop_if_consecutive_loss','pause_after_fill'] },
  ];

  return (
    <section className="pf-section" id="blocks">
      <div className="container">
        <SectionHead
          eyebrow="06 · Block registry"
          title="36 primitives. Zero code."
          body="Every block is typed, wired, and validated. Four categories. Drop on the canvas, connect, deploy."
        />

        <div style={{
          display: 'grid',
          gap: 1,
          background: 'var(--border-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          overflow: 'hidden',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }} className="registry-grid">
          {groups.map(g => {
            const count = BLOCKS.filter(b => b.cat === g.key).length;
            return (
              <div key={g.key} style={{ background: 'var(--bg-surface)', padding: '24px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{g.label}</div>
                  <div className="tabnum mono" style={{ fontSize: 13, color: g.color, fontWeight: 600 }}>{count}</div>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4, marginBottom: 16 }}>{g.hint}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.sample.map(n => (
                    <div key={n} className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                      <span style={{ color: g.color, marginRight: 8 }}>·</span>{n}
                    </div>
                  ))}
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    + {count - 3} more
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <a className="btn btn-secondary btn-sm" href="#docs">Browse full library <Icon name="arrow-right" size={13}/></a>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="mono">+ 8 logic / calc blocks · variables · sub-strategies</span>
        </div>
      </div>
    </section>
  );
}
window.Registry = Registry;
