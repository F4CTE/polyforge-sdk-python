// Command palette — opened by clicking the ⌘K button, pressing ⌘K / Ctrl+K, or "/"
// Fuzzy-searches across pages, docs, markets, whales, and quick actions.

const CMD_INDEX = [
  // --- Pages (primary nav) ---
  { g: 'Pages', t: 'Landing — The trading terminal for prediction markets', k: 'home landing index overview', href: 'Landing Page.html', icon: 'home' },
  { g: 'Pages', t: 'Product', k: 'product features overview terminal', href: 'Landing Page.html#product', icon: 'layers' },
  { g: 'Pages', t: 'Blocks — visual strategy builder', k: 'blocks builder no-code visual drag drop', href: 'Landing Page.html#blocks', icon: 'grid' },
  { g: 'Pages', t: 'Whales — copy proven traders', k: 'whales copy trade leaderboard wallets', href: 'Landing Page.html#whales', icon: 'users' },
  { g: 'Pages', t: 'Developers — API, SDK, MCP', k: 'developers api sdk mcp code', href: 'Landing Page.html#developers', icon: 'code' },
  { g: 'Pages', t: 'Pricing', k: 'pricing plans cost billing free pro team', href: 'Pricing.html', icon: 'credit-card' },
  { g: 'Pages', t: 'About', k: 'about team company mission london', href: 'About.html', icon: 'info' },
  { g: 'Pages', t: 'Careers — we\'re hiring', k: 'careers jobs hiring roles openings', href: 'Careers.html', icon: 'briefcase' },
  { g: 'Pages', t: 'Changelog', k: 'changelog releases updates versions', href: 'Changelog.html', icon: 'clock' },
  { g: 'Pages', t: 'Security', k: 'security audit infosec soc trust', href: 'Security.html', icon: 'shield' },
  { g: 'Pages', t: 'Status', k: 'status uptime incidents health', href: 'Status.html', icon: 'activity' },

  // --- Docs ---
  { g: 'Docs', t: 'Docs home', k: 'docs documentation reference guides', href: 'Docs.html', icon: 'book' },
  { g: 'Docs', t: 'Quickstart — 15 minutes to live', k: 'quickstart getting started install npm', href: 'Docs-Quickstart.html', icon: 'zap' },
  { g: 'Docs', t: 'API reference', k: 'api rest endpoints keys auth http curl', href: 'Docs-API.html', icon: 'code' },
  { g: 'Docs', t: 'SDK — TypeScript & Python', k: 'sdk typescript python library npm pypi', href: 'Docs-SDK.html', icon: 'code' },
  { g: 'Docs', t: 'MCP Server', k: 'mcp model context protocol claude cursor agent', href: 'Docs-MCP.html', icon: 'code' },

  // --- Guides ---
  { g: 'Guides', t: 'Using Polyforge — Guide', k: 'guide tutorial how to use polyforge', href: 'Guide.html', icon: 'book' },
  { g: 'Guides', t: 'Building your first strategy', k: 'guide first strategy build starter tutorial', href: 'Guide-First-Strategy.html', icon: 'sparkles' },
  { g: 'Guides', t: 'Backtesting strategies', k: 'guide backtest history replay simulate', href: 'Guide-Backtest.html', icon: 'clock' },
  { g: 'Guides', t: 'Paper → Live (safely)', k: 'guide paper live production switch safe', href: 'Guide-Live.html', icon: 'shield' },
  { g: 'Guides', t: 'Account & billing', k: 'guide account billing wallet plans funding', href: 'Guide-Account-Billing.html', icon: 'credit-card' },

  // --- Legal ---
  { g: 'Legal', t: 'Terms of Service', k: 'legal terms tos service agreement', href: 'Terms.html', icon: 'file-text' },
  { g: 'Legal', t: 'Privacy Policy', k: 'legal privacy policy gdpr data', href: 'Privacy.html', icon: 'shield' },
  { g: 'Legal', t: 'Cookies', k: 'legal cookies tracking consent', href: 'Cookies.html', icon: 'file-text' },
  { g: 'Legal', t: 'Risk Disclosure', k: 'legal risk disclosure warning trading', href: 'Risk Disclosure.html', icon: 'shield' },

  // --- Quick actions ---
  { g: 'Actions', t: 'Sign in', k: 'sign in log login account', href: 'Login.html', icon: 'user', action: true },
  { g: 'Actions', t: 'Start free — create account', k: 'sign up register start free account create', href: 'Sign Up.html', icon: 'sparkles', action: true },
  { g: 'Actions', t: 'Toggle theme (dark / light)', k: 'theme dark light mode toggle', icon: 'moon', onRun: () => {
      try {
        const cur = localStorage.getItem('pf-tweak-theme') || 'dark';
        const nxt = cur === 'dark' ? 'light' : 'dark';
        localStorage.setItem('pf-tweak-theme', nxt);
        document.documentElement.dataset.theme = nxt;
        window.dispatchEvent(new StorageEvent('storage', { key: 'pf-tweak-theme', newValue: nxt }));
      } catch (_) {}
  }},
  { g: 'Actions', t: 'Check system status', k: 'status uptime incidents health', href: 'Status.html', icon: 'activity', action: true },
  { g: 'Actions', t: 'Talk to sales', k: 'sales contact enterprise team talk', href: 'mailto:sales@polyforge.app', icon: 'mail', action: true },

  // --- Markets (demo data) ---
  { g: 'Markets', t: 'US Election 2028', k: 'election president 2028 politics trump harris', href: 'Landing Page.html#whales', icon: 'activity', meta: '¢42  +2.4%' },
  { g: 'Markets', t: 'BTC > $150k by Dec', k: 'bitcoin btc 150k crypto price december', href: 'Landing Page.html#whales', icon: 'activity', meta: '¢31  −1.1%' },
  { g: 'Markets', t: 'Fed Rate Cut · Jul', k: 'fed fomc rate cut july interest', href: 'Landing Page.html#whales', icon: 'activity', meta: '¢73  +4.2%' },
  { g: 'Markets', t: 'ETH Spot ETF · Q2', k: 'ethereum eth spot etf q2 sec approval', href: 'Landing Page.html#whales', icon: 'activity', meta: '¢88  +0.6%' },
  { g: 'Markets', t: 'NVDA Earnings Beat', k: 'nvda nvidia earnings beat q stock', href: 'Landing Page.html#whales', icon: 'activity', meta: '¢81  +1.2%' },

  // --- Whales (demo) ---
  { g: 'Whales', t: 'whale.alpha.eth', k: 'whale alpha eth copy trade leaderboard wallet', href: 'Landing Page.html#whales', icon: 'users', meta: '+$142k · 30d' },
  { g: 'Whales', t: '0xLibra', k: 'whale libra 0x copy trade wallet', href: 'Landing Page.html#whales', icon: 'users', meta: '+$88k · 30d' },
  { g: 'Whales', t: 'moonshot.sol', k: 'whale moonshot sol copy trade wallet solana', href: 'Landing Page.html#whales', icon: 'users', meta: '+$61k · 30d' },
];

// Lightweight fuzzy score: substring-of + token-prefix-of + gap penalty
function scoreItem(item, q) {
  if (!q) return 1;
  const hay = (item.t + ' ' + (item.k || '')).toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return 1;

  // Exact title match = top score
  if (item.t.toLowerCase() === needle) return 1000;
  if (item.t.toLowerCase().startsWith(needle)) return 500 + (200 - item.t.length);
  if (hay.includes(needle)) return 300 + (200 - hay.indexOf(needle));

  // subsequence
  let hi = 0, score = 0, gap = 0;
  for (let i = 0; i < needle.length; i++) {
    const c = needle[i];
    const found = hay.indexOf(c, hi);
    if (found === -1) return 0;
    score += found === hi ? 10 : 3;
    gap += found - hi;
    hi = found + 1;
  }
  return Math.max(1, score - Math.floor(gap / 2));
}

function CommandPalette({ open, onClose }) {
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQ(''); setIdx(0);
      // Focus next tick
      requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
    }
  }, [open]);

  // Results
  const results = React.useMemo(() => {
    const scored = CMD_INDEX
      .map((it) => ({ it, s: scoreItem(it, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((r) => r.it);
    // Group by g, preserving order
    const groups = [];
    const map = new Map();
    for (const it of scored) {
      if (!map.has(it.g)) { map.set(it.g, []); groups.push({ g: it.g, items: map.get(it.g) }); }
      map.get(it.g).push(it);
    }
    return { flat: scored, groups };
  }, [q]);

  // Clamp idx when results change
  React.useEffect(() => {
    if (idx >= results.flat.length) setIdx(Math.max(0, results.flat.length - 1));
  }, [results.flat.length]);

  const run = React.useCallback((item) => {
    if (!item) return;
    if (item.onRun) { item.onRun(); onClose(); return; }
    if (item.href) {
      // External-like (mailto) — use location
      if (/^(mailto:|https?:)/i.test(item.href)) {
        window.location.href = item.href;
      } else {
        // Same-origin navigation (works in sandboxed iframes too)
        try { window.top.location.href = item.href; }
        catch (_) { window.location.href = item.href; }
      }
      onClose();
    }
  }, [onClose]);

  // Keyboard nav
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.flat.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); run(results.flat[idx]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results.flat, idx, run, onClose]);

  // Scroll selected into view (within the list only)
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${idx}"]`);
    if (!el) return;
    const list = listRef.current;
    const elTop = el.offsetTop;
    const elBot = elTop + el.offsetHeight;
    if (elTop < list.scrollTop) list.scrollTop = elTop - 4;
    else if (elBot > list.scrollTop + list.clientHeight) list.scrollTop = elBot - list.clientHeight + 4;
  }, [idx, open]);

  if (!open) return null;

  let runningIdx = -1;
  const panel = (
    <div className="cmdk-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk-panel" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            placeholder="Search pages, markets, whales, docs…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="kbd cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.flat.length === 0 ? (
            <div className="cmdk-empty">
              No results for <span className="mono">"{q}"</span>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>Try "pricing", "backtest", "BTC", or "whale".</div>
            </div>
          ) : results.groups.map((group) => (
            <div key={group.g} className="cmdk-group">
              <div className="cmdk-group-title">{group.g}</div>
              {group.items.map((it) => {
                runningIdx++;
                const selected = runningIdx === idx;
                const myIdx = runningIdx;
                return (
                  <button
                    key={group.g + '-' + it.t}
                    data-cmd-idx={myIdx}
                    className={'cmdk-item' + (selected ? ' is-selected' : '')}
                    onMouseMove={() => setIdx(myIdx)}
                    onClick={() => run(it)}
                  >
                    <span className="cmdk-item-icon"><Icon name={it.icon || 'arrow-right'} size={14} /></span>
                    <span className="cmdk-item-title">{it.t}</span>
                    {it.meta && <span className="cmdk-item-meta mono tabnum">{it.meta}</span>}
                    <span className="cmdk-item-enter" aria-hidden>
                      {selected ? <Icon name="arrow-right" size={12} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span className="cmdk-foot-group"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="cmdk-foot-group"><span className="kbd">↵</span> open</span>
          <span className="cmdk-foot-group"><span className="kbd">esc</span> close</span>
          <span style={{ flex: 1 }} />
          <span className="cmdk-foot-hint">{results.flat.length} result{results.flat.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(panel, document.body);
}

// Global open/close hook — binds ⌘K and "/" and exposes window.openCmdK()
function useCmdK() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !open) {
        const t = e.target;
        const tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    window.openCmdK = () => setOpen(true);
    window.closeCmdK = () => setOpen(false);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return [open, setOpen];
}

Object.assign(window, { CommandPalette, useCmdK });
