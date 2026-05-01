/* Polyforge — Trade Journal
   Personal log: trade-by-trade notes, lessons, tags. Disciplined traders keep a journal. */

const JR_ENTRIES = [
  {
    id: 'JE-184', date: 'Apr 28', market: 'FED-CUT-JUL', side: 'YES', size: '$48,200', pnl: '+$5,280', pnlPct: '+10.9%',
    title: 'Sized in over 3 entries · waited for FOMC to confirm dovish tilt',
    body: "Held off on full size when the futures-implied prob was at 58. Watched 2 days of dot-plot leaks and re-entered at 64 with a 60% size, then added on the post-presser dip. Lesson: waiting for the curve to roll my way was worth more than catching the exact bottom.",
    tags: ['macro', 'patience', 'sized in'], rating: 5,
  },
  {
    id: 'JE-181', date: 'Apr 26', market: 'NFL-SB-CHIEFS', side: 'NO', size: '$8,400', pnl: '-$1,200', pnlPct: '-14.3%',
    title: 'Faded sharp money · got run over',
    body: "Saw heavy NO interest from sharp accounts and assumed I was reading a value play. Forgot that 'sharp' on culture markets means closer-to-the-action info, not necessarily contrarian. Should have checked who was on the other side.",
    tags: ['sports', 'mistake', 'sharp counter'], rating: 2,
  },
  {
    id: 'JE-178', date: 'Apr 22', market: 'NVDA-EARN-Q1', side: 'YES', size: '$28,000', pnl: '+$8,420', pnlPct: '+30.1%',
    title: 'Earnings beat playbook worked exactly as backtested',
    body: "Pre-earnings positioning when the analyst-revision count tipped >+12 in 5 days. The market priced it at 58 going in, resolved YES at the buzzer. This is the third time this signal has fired clean — adding it to the formal whale-shadow strategy.",
    tags: ['earnings', 'backtest validated', 'add to strategy'], rating: 5,
  },
  {
    id: 'JE-174', date: 'Apr 18', market: 'TARIFF-CHN-25', side: 'YES', size: '$22,400', pnl: '+$3,180', pnlPct: '+14.2%',
    title: 'Held through the noise · trusted the thesis',
    body: "Drew down 18% mid-trade when a Reuters piece dropped that looked dovish. Re-read my entry note (\"thesis is multi-week, not a single news cycle\") and held. Recovered + extended.",
    tags: ['politics', 'discipline', 'drawdown'], rating: 4,
  },
  {
    id: 'JE-170', date: 'Apr 14', market: 'ETH-ETF-Q3', side: 'YES', size: '$12,800', pnl: '+$5,460', pnlPct: '+42.7%',
    title: 'Best risk-adjusted trade of the month',
    body: "Spotted divergence between the spot ETF flow tracker and the prediction market — $200M+ inflows for 3 days, market still pricing 38% probability. Sized to 2× normal. Resolved YES.",
    tags: ['crypto', 'edge', 'high conviction'], rating: 5,
  },
  {
    id: 'JE-166', date: 'Apr 09', market: 'OSCARS-OPP', side: 'NO', size: '$6,400', pnl: '-$840', pnlPct: '-13.1%',
    title: 'Should not have traded this',
    body: "Cultural markets are not my edge. Got bored on a Sunday and took a contrarian play because I could 'feel' the public was wrong. Lost. Don't trade outside your circle.",
    tags: ['mistake', 'discipline', 'circle of competence'], rating: 1,
  },
];

// Only the failure modes get a quiet warn tint; everything else is neutral.
const JR_TAG_KIND = {
  mistake: 'is-loss', drawdown: 'is-warn', 'sharp counter': 'is-warn',
};

function App() {
  const [tab, setTab] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filtered = JR_ENTRIES.filter(e => {
    if (tab === 'wins' && !e.pnl.startsWith('+')) return false;
    if (tab === 'losses' && !e.pnl.startsWith('-')) return false;
    if (tab === 'lessons' && e.rating > 3) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const wins = JR_ENTRIES.filter(e => e.pnl.startsWith('+')).length;
  const losses = JR_ENTRIES.filter(e => e.pnl.startsWith('-')).length;
  const allTags = [...new Set(JR_ENTRIES.flatMap(e => e.tags))].slice(0, 14);

  return (
    <UsrShell active="journal" title="Trade journal" crumbs={[{ label: 'Journal' }]} actions={
      <button className="adm-btn adm-btn-primary"><AdmIcon name="plus" size={12} />New entry</button>
    }>
      <AdmPageHead
        title="Trade journal"
        sub="Disciplined traders keep notes · 184 entries · what worked, what didn't, what to repeat"
      />

      <div className="adm-grid-4" style={{ marginBottom: 20 }}>
        <AdmStat label="Total entries"     value={JR_ENTRIES.length} delta="6 this week" deltaKind="gain" />
        <AdmStat label="Wins"               value={wins} delta={`${Math.round(wins/JR_ENTRIES.length*100)}% rate`} deltaKind="gain" />
        <AdmStat label="Losses"             value={losses} delta="learning material" deltaKind="warn" />
        <AdmStat label="Avg rating"         value="3.7 / 5" delta="↑ from 3.4" deltaKind="gain" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, alignItems: 'start' }}>
        {/* Main feed */}
        <div>
          {/* Tabs + search */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="adm-filter-group">
              {[
                { id: 'all',     label: `All (${JR_ENTRIES.length})` },
                { id: 'wins',    label: `Wins (${wins})` },
                { id: 'losses',  label: `Losses (${losses})` },
                { id: 'lessons', label: 'Lessons' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`adm-filter ${tab === t.id ? 'is-active' : ''}`}>{t.label}</button>
              ))}
            </div>
            <input
              className="adm-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries…"
              style={{ marginLeft: 'auto', width: 240, padding: '6px 10px', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(e => {
              const win = e.pnl.startsWith('+');
              return (
                <div key={e.id} className="adm-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.date}</span>
                        <span style={{ width: 1, height: 10, background: 'var(--border-subtle)' }} />
                        <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)' }}>{e.market}</span>
                        <span className={`adm-pill ${e.side === 'YES' ? 'is-gain' : 'is-loss'}`} style={{ fontSize: 9.5, height: 16 }}>{e.side}</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.size}</span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>{e.title}</h3>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="mono tabnum" style={{ fontSize: 13.5, fontWeight: 600, color: win ? 'var(--gain-text)' : 'var(--loss-text)' }}>{e.pnl}</div>
                      <div className="mono tabnum" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{e.pnlPct}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{e.body}</p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {e.tags.map(t => (
                      <span key={t} className={`adm-pill ${JR_TAG_KIND[t] || ''}`} style={{ fontSize: 10, height: 18 }}>{t}</span>
                    ))}
                    <div className="mono tabnum" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                      {e.rating}<span style={{ color: 'var(--border-default)' }}> / 5</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 80 }}>
          <div className="adm-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {allTags.map(t => (
                <button key={t} className={`adm-pill ${JR_TAG_KIND[t] || ''}`} style={{ fontSize: 10, height: 18, cursor: 'pointer', border: 'none' }}>{t}</button>
              ))}
            </div>
          </div>

          <div className="adm-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>This week</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12 }}>
              {[
                ['Entries', '6', null],
                ['Win rate', '67%', 'gain'],
                ['Avg rating', '4.0 / 5', null],
                ['Streak', '12 days', null],
              ].map(([label, val, kind]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>{label}</span>
                  <span className="mono tabnum" style={{ fontWeight: 500, color: kind === 'gain' ? 'var(--gain-text)' : 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="adm-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Pinned lessons</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <li style={{ paddingLeft: 10, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 6, width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />Don't trade outside circle of competence</li>
              <li style={{ paddingLeft: 10, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 6, width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />Sharp on culture ≠ contrarian</li>
              <li style={{ paddingLeft: 10, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 6, width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />Re-read entry note when drawing down</li>
            </ul>
          </div>
        </aside>
      </div>
    </UsrShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);