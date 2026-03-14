import { useState } from "react";

const T = {
  bgBase: "#080C14",
  bgSurface: "#0D1421",
  bgElevated: "#111D2E",
  bgOverlay: "#162030",
  borderSubtle: "#1A2840",
  borderDefault: "#1E3350",
  borderStrong: "#264060",
  textPrimary: "#E8EDF5",
  textSecondary: "#7A94B4",
  textMuted: "#445E7A",
  cyan300: "#67E8F9",
  cyan400: "#22D3EE",
  cyan500: "#06B6D4",
  cyan600: "#0891B2",
  cyanGlow: "rgba(6,182,212,0.15)",
  success: "#10B981",
  successBg: "rgba(16,185,129,0.08)",
  danger: "#EF4444",
  dangerBg: "rgba(239,68,68,0.08)",
  warning: "#F59E0B",
  warningBg: "rgba(245,158,11,0.08)",
  info: "#3B82F6",
  infoBg: "rgba(59,130,246,0.08)",
};

const mono = "'JetBrains Mono', 'Fira Code', monospace";
const sans = "'Outfit', system-ui, sans-serif";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #080C14; }
  ::-webkit-scrollbar-thumb { background: #1E3350; border-radius: 3px; }

  @keyframes pulse {
    0%,100% { opacity:1; box-shadow: 0 0 6px rgba(6,182,212,0.8); }
    50% { opacity:0.4; box-shadow: 0 0 2px rgba(6,182,212,0.3); }
  }
  @keyframes tickUp { 0% { color: #67E8F9; } 100% { color: #06B6D4; } }
  @keyframes fadeIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:translateY(0); } }

  .section-enter { animation: fadeIn 0.3s ease forwards; }
  .tab-btn { transition: all 0.15s ease; }
  .tab-btn:hover { color: #E8EDF5 !important; }
  .tab-btn.active { color: #06B6D4 !important; border-bottom: 2px solid #06B6D4 !important; }
  .nav-item { transition: all 0.15s ease; cursor: pointer; }
  .nav-item:hover { background: #162030 !important; color: #06B6D4 !important; }
  .nav-item.active { background: rgba(6,182,212,0.08) !important; color: #06B6D4 !important; }
  .btn-primary:hover { background: #0891B2 !important; }
  .btn-secondary:hover { background: #111D2E !important; border-color: #264060 !important; }
  .btn-ghost:hover { background: #162030 !important; }
  .card-hover:hover { border-color: #1E3350 !important; }
  .running-dot { animation: pulse 2s ease-in-out infinite; }
  .price-tick { animation: tickUp 0.4s ease-out; }
`;

const TABS = ["Couleurs", "Typographie", "Composants", "Aperçu dashboard"];

const ColorSwatch = ({ hex, name, sub }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
    <div style={{
      width: 32, height: 32, borderRadius: 4, background: hex,
      border: `1px solid ${T.borderSubtle}`, flexShrink: 0,
    }} />
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, color: T.textPrimary }}>{hex}</div>
      <div style={{ fontFamily: sans, fontSize: 11, color: T.textMuted }}>{name}{sub ? ` — ${sub}` : ""}</div>
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32 }}>
    <div style={{
      fontFamily: sans, fontSize: 11, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.1em",
      color: T.textMuted, marginBottom: 12,
      paddingBottom: 8, borderBottom: `1px solid ${T.borderSubtle}`,
    }}>{title}</div>
    {children}
  </div>
);

const Badge = ({ label, bg, color, dot }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    background: bg, borderRadius: 4, padding: "3px 10px",
  }}>
    {dot && <div className={dot === "pulse" ? "running-dot" : ""} style={{
      width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0,
      boxShadow: dot === "pulse" ? `0 0 6px ${color}88` : "none",
    }} />}
    <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 500, color, letterSpacing: "0.04em" }}>
      {label}
    </span>
  </div>
);

const ColorsTab = () => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }} className="section-enter">
    <Section title="Backgrounds">
      <ColorSwatch hex="#080C14" name="bg-base" sub="Fond principal" />
      <ColorSwatch hex="#0D1421" name="bg-surface" sub="Cartes, sidebar" />
      <ColorSwatch hex="#111D2E" name="bg-elevated" sub="Modals" />
      <ColorSwatch hex="#162030" name="bg-overlay" sub="Hover states" />
    </Section>
    <Section title="Accent Cyan — Signature">
      <ColorSwatch hex="#67E8F9" name="cyan-300" sub="Pulse, glow" />
      <ColorSwatch hex="#22D3EE" name="cyan-400" sub="Secondaire" />
      <ColorSwatch hex="#06B6D4" name="cyan-500" sub="Accent principal ←" />
      <ColorSwatch hex="#0891B2" name="cyan-600" sub="Hover" />
      <ColorSwatch hex="#0E7490" name="cyan-700" sub="Active" />
    </Section>
    <Section title="Sémantique">
      <ColorSwatch hex="#10B981" name="success" sub="Profit, confirmé" />
      <ColorSwatch hex="#EF4444" name="danger" sub="Perte, erreur" />
      <ColorSwatch hex="#F59E0B" name="warning" sub="Alerte, en attente" />
      <ColorSwatch hex="#3B82F6" name="info" sub="Information" />
      <ColorSwatch hex="#A855F7" name="paper" sub="Paper trading" />
    </Section>
    <Section title="Texte">
      <ColorSwatch hex="#E8EDF5" name="text-primary" sub="Titres, valeurs" />
      <ColorSwatch hex="#7A94B4" name="text-secondary" sub="Labels" />
      <ColorSwatch hex="#445E7A" name="text-muted" sub="Placeholders" />
      <ColorSwatch hex="#2A3D52" name="text-disabled" />
    </Section>
    <Section title="Bordures">
      <ColorSwatch hex="#1A2840" name="border-subtle" sub="Séparateurs" />
      <ColorSwatch hex="#1E3350" name="border-default" sub="Cartes, inputs" />
      <ColorSwatch hex="#264060" name="border-strong" sub="Focus, actif" />
    </Section>
    <Section title="P&L">
      <ColorSwatch hex="#10B981" name="pnl-positive" sub="+$124.50" />
      <ColorSwatch hex="#EF4444" name="pnl-negative" sub="-$43.20" />
      <ColorSwatch hex="#7A94B4" name="pnl-neutral" sub="$0.00" />
    </Section>
  </div>
);

const TypographyTab = () => (
  <div className="section-enter">
    <Section title="Familles de polices">
      <div style={{
        background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
        borderRadius: 8, padding: 24, marginBottom: 16,
      }}>
        <div style={{ fontFamily: sans, fontSize: 11, color: T.textMuted, marginBottom: 8, letterSpacing:"0.08em", textTransform:"uppercase" }}>Outfit — UI / Labels / Boutons</div>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 32, color: T.textPrimary, marginBottom: 4 }}>Polyforge</div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 22, color: T.textPrimary, marginBottom: 4 }}>Strategy Builder</div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 15, color: T.textSecondary, marginBottom: 4 }}>Automated trading for Polymarket</div>
        <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 14, color: T.textSecondary }}>Create, backtest, and deploy strategies with a drag-and-drop block editor.</div>
      </div>
      <div style={{
        background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
        borderRadius: 8, padding: 24,
      }}>
        <div style={{ fontFamily: sans, fontSize: 11, color: T.textMuted, marginBottom: 8, letterSpacing:"0.08em", textTransform:"uppercase" }}>JetBrains Mono — Prix / P&L / Données</div>
        <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 500, color: T.cyan500, marginBottom: 4 }}>0.7241</div>
        <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, color: T.success, marginBottom: 4 }}>+$124.50  +8.34%</div>
        <div style={{ fontFamily: mono, fontSize: 14, color: T.textSecondary, marginBottom: 4 }}>intent_id: 8f2a3b1c-4d5e-...</div>
        <div style={{ fontFamily: mono, fontSize: 12, color: T.textMuted }}>2026-03-13T10:42:31.204Z</div>
      </div>
    </Section>
    <Section title="Échelle typographique">
      {[
        { size: 36, weight: 700, label: "3xl — Titre principal", text: "Portfolio" },
        { size: 28, weight: 600, label: "2xl — Titre de page", text: "My Strategies" },
        { size: 22, weight: 600, label: "xl — Section title", text: "Active Positions" },
        { size: 18, weight: 600, label: "lg — Card title", text: "Price Crosses Up" },
        { size: 15, weight: 500, label: "md — Body emphasis", text: "Strategy is running" },
        { size: 14, weight: 400, label: "base — Body text", text: "Place a buy order when price crosses above the threshold." },
        { size: 12, weight: 400, label: "sm — Secondary", text: "Updated 2 minutes ago" },
        { size: 11, weight: 500, label: "xs — Labels / Badges", text: "TRIGGER BLOCK" },
      ].map(({ size, weight, label, text }) => (
        <div key={size} style={{
          display: "flex", alignItems: "baseline", gap: 16,
          padding: "8px 0", borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted, minWidth: 160 }}>{label}</div>
          <div style={{ fontFamily: size === 11 ? sans : sans, fontSize: size, fontWeight: weight, color: T.textPrimary, letterSpacing: size === 11 ? "0.08em" : 0, textTransform: size === 11 ? "uppercase" : "none" }}>{text}</div>
        </div>
      ))}
    </Section>
  </div>
);

const ComponentsTab = () => {
  const [inputVal, setInputVal] = useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="section-enter">
      <Section title="Boutons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="btn-primary" style={{
            background: T.cyan500, border: "none", borderRadius: 6,
            padding: "8px 16px", fontFamily: sans, fontSize: 14, fontWeight: 500,
            color: T.bgBase, cursor: "pointer",
          }}>Start Strategy</button>
          <button className="btn-secondary" style={{
            background: "transparent", border: `1px solid ${T.borderDefault}`,
            borderRadius: 6, padding: "8px 16px", fontFamily: sans, fontSize: 14,
            fontWeight: 500, color: T.textPrimary, cursor: "pointer",
          }}>Edit</button>
          <button className="btn-ghost" style={{
            background: "transparent", border: "none",
            borderRadius: 6, padding: "8px 16px", fontFamily: sans, fontSize: 14,
            fontWeight: 500, color: T.textSecondary, cursor: "pointer",
          }}>Cancel</button>
          <button style={{
            background: T.dangerBg, border: `1px solid rgba(239,68,68,0.3)`,
            borderRadius: 6, padding: "8px 16px", fontFamily: sans, fontSize: 14,
            fontWeight: 500, color: T.danger, cursor: "pointer",
          }}>Stop</button>
        </div>
      </Section>

      <Section title="Inputs">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder="Search markets..."
            style={{
              background: T.bgSurface, border: `1px solid ${T.borderDefault}`,
              borderRadius: 6, padding: "8px 12px", fontFamily: sans, fontSize: 14,
              color: T.textPrimary, outline: "none", width: "100%",
            }}
            onFocus={e => { e.target.style.borderColor = T.cyan500; e.target.style.boxShadow = "0 0 0 2px rgba(6,182,212,0.15)"; }}
            onBlur={e => { e.target.style.borderColor = T.borderDefault; e.target.style.boxShadow = "none"; }}
          />
          <input
            placeholder="0.00"
            style={{
              background: T.bgSurface, border: `1px solid ${T.danger}`,
              borderRadius: 6, padding: "8px 12px", fontFamily: mono, fontSize: 14,
              color: T.textPrimary, outline: "none", width: "100%",
              boxShadow: "0 0 0 2px rgba(239,68,68,0.10)",
            }}
          />
          <div style={{ fontFamily: sans, fontSize: 12, color: T.danger }}>Value must be greater than 0</div>
        </div>
      </Section>

      <Section title="Badges de statut">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Badge label="RUNNING" bg="rgba(6,182,212,0.12)" color={T.cyan500} dot="pulse" />
          <Badge label="PAUSED" bg="rgba(245,158,11,0.12)" color={T.warning} dot="static" />
          <Badge label="IDLE" bg="rgba(122,148,180,0.12)" color={T.textSecondary} dot="static" />
          <Badge label="ERROR" bg={T.dangerBg} color={T.danger} dot="static" />
          <Badge label="PAPER" bg="rgba(168,85,247,0.12)" color="#A855F7" dot="static" />
          <Badge label="ARCHIVED" bg="rgba(42,61,82,0.5)" color={T.textMuted} />
        </div>
      </Section>

      <Section title="Tags & chips">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["momentum", "presidential", "crypto", "high-freq"].map(t => (
            <div key={t} style={{
              background: T.bgOverlay, border: `1px solid ${T.borderDefault}`,
              borderRadius: 4, padding: "2px 10px",
              fontFamily: sans, fontSize: 12, color: T.textSecondary,
            }}>#{t}</div>
          ))}
        </div>
      </Section>

      <Section title="Toasts / Notifications">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { type: "success", icon: "✓", title: "Order filled", body: "+$47.20 realized", border: "rgba(16,185,129,0.35)" },
            { type: "error", icon: "✕", title: "Strategy error", body: "Block evaluation failed", border: "rgba(239,68,68,0.35)" },
            { type: "warning", icon: "⚠", title: "Stale data", body: "Price cache is 8s old", border: "rgba(245,158,11,0.35)" },
          ].map(({ icon, title, body, border }) => (
            <div key={title} style={{
              background: T.bgElevated, border: `1px solid ${border}`,
              borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{ fontSize: 14, marginTop: 1 }}>{icon}</div>
              <div>
                <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{title}</div>
                <div style={{ fontFamily: sans, fontSize: 12, color: T.textSecondary }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Progress bar">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Backtest progress", pct: 67, color: T.cyan500 },
            { label: "Daily P&L limit", pct: 34, color: T.success },
            { label: "Orders used today", pct: 89, color: T.warning },
          ].map(({ label, pct, color }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: sans, fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: T.textPrimary }}>{pct}%</span>
              </div>
              <div style={{ background: T.borderSubtle, borderRadius: 9999, height: 4 }}>
                <div style={{ background: color, width: `${pct}%`, height: "100%", borderRadius: 9999 }} />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

const DashboardTab = () => {
  const navItems = [
    { icon: "⊞", label: "Markets" },
    { icon: "◈", label: "Strategies", active: true },
    { icon: "◎", label: "Portfolio" },
    { icon: "≡", label: "Orders" },
    { icon: "◉", label: "Discover" },
    { icon: "◬", label: "Alerts" },
    { icon: "⚙", label: "Settings" },
  ];

  const strategies = [
    { name: "Momentum Blitz", status: "RUNNING", statusColor: T.cyan500, statusBg: "rgba(6,182,212,0.12)", pnl: "+$124.50", pct: "+8.34%", positive: true, market: "US Elections 2026", mode: "TICK" },
    { name: "Cross Down Guard", status: "PAUSED", statusColor: T.warning, statusBg: "rgba(245,158,11,0.12)", pnl: "-$12.40", pct: "-1.12%", positive: false, market: "Crypto Markets", mode: "EVENT" },
    { name: "Safe Scalper", status: "PAPER", statusColor: "#A855F7", statusBg: "rgba(168,85,247,0.12)", pnl: "+$47.20", pct: "+4.72%", positive: true, market: "Sports", mode: "HYBRID" },
  ];

  return (
    <div style={{ display: "flex", height: 520, border: `1px solid ${T.borderSubtle}`, borderRadius: 8, overflow: "hidden" }} className="section-enter">
      {/* Sidebar */}
      <div style={{
        width: 200, background: T.bgSurface,
        borderRight: `1px solid ${T.borderSubtle}`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Logo */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: T.cyan500,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: sans, fontWeight: 700, fontSize: 14, color: T.bgBase,
            }}>P</div>
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 15, color: T.textPrimary }}>Polyforge</span>
          </div>
        </div>
        {/* Nav */}
        <div style={{ flex: 1, padding: "8px 8px" }}>
          {navItems.map(({ icon, label, active }) => (
            <div key={label} className={`nav-item ${active ? "active" : ""}`} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", borderRadius: 6, marginBottom: 2,
              color: active ? T.cyan500 : T.textSecondary,
              background: active ? "rgba(6,182,212,0.08)" : "transparent",
            }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span style={{ fontFamily: sans, fontSize: 13, fontWeight: active ? 500 : 400 }}>{label}</span>
              {active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.cyan500 }} className="running-dot" />}
            </div>
          ))}
        </div>
        {/* User */}
        <div style={{
          padding: "12px 16px",
          borderTop: `1px solid ${T.borderSubtle}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: T.bgOverlay, border: `1px solid ${T.borderDefault}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: mono, fontSize: 11, color: T.textSecondary,
          }}>AL</div>
          <div>
            <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 500, color: T.textPrimary }}>alice</div>
            <div style={{ fontFamily: sans, fontSize: 10, color: T.success }}>● Connected</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, background: T.bgBase, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{
          height: 48, padding: "0 20px",
          borderBottom: `1px solid ${T.borderSubtle}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.bgSurface,
        }}>
          <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: T.textPrimary }}>Strategies</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 12, color: T.textMuted }}>3 active</div>
            <button className="btn-primary" style={{
              background: T.cyan500, border: "none", borderRadius: 6,
              padding: "5px 12px", fontFamily: sans, fontSize: 12, fontWeight: 500,
              color: T.bgBase, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}>+ New Strategy</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total P&L", value: "+$159.30", sub: "All time", positive: true },
              { label: "Today's P&L", value: "+$47.20", sub: "Since midnight", positive: true },
              { label: "Win Rate", value: "67.4%", sub: "Last 30 days", positive: true },
              { label: "Running", value: "1 / 5", sub: "Max strategies", positive: null },
            ].map(({ label, value, sub, positive }) => (
              <div key={label} style={{
                background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
                borderRadius: 8, padding: "12px 14px",
              }}>
                <div style={{ fontFamily: sans, fontSize: 11, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 500, color: positive === true ? T.success : positive === false ? T.danger : T.textPrimary }}>{value}</div>
                <div style={{ fontFamily: sans, fontSize: 11, color: T.textMuted, marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Strategies table */}
          <div style={{
            background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
            borderRadius: 8, overflow: "hidden",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
              padding: "8px 16px", borderBottom: `1px solid ${T.borderSubtle}`,
            }}>
              {["Strategy", "Status", "P&L", "Market", ""].map(h => (
                <div key={h} style={{ fontFamily: sans, fontSize: 11, fontWeight: 500, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
              ))}
            </div>
            {/* Rows */}
            {strategies.map((s) => (
              <div key={s.name} className="card-hover" style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
                padding: "10px 16px", borderBottom: `1px solid ${T.borderSubtle}`,
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: T.textPrimary }}>{s.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: T.textMuted }}>{s.mode} mode</div>
                </div>
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: s.statusBg, borderRadius: 4, padding: "2px 8px",
                  }}>
                    <div className={s.status === "RUNNING" ? "running-dot" : ""} style={{
                      width: 5, height: 5, borderRadius: "50%", background: s.statusColor,
                    }} />
                    <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 500, color: s.statusColor }}>{s.status}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 500, color: s.positive ? T.success : T.danger }}>{s.pnl}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: s.positive ? T.success : T.danger }}>{s.pct}</div>
                </div>
                <div style={{ fontFamily: sans, fontSize: 12, color: T.textSecondary }}>{s.market}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ padding: "3px 8px", background: T.bgOverlay, borderRadius: 4, fontFamily: sans, fontSize: 11, color: T.textSecondary, cursor: "pointer" }}>···</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DesignSystem() {
  const [tab, setTab] = useState(0);

  const content = [<ColorsTab />, <TypographyTab />, <ComponentsTab />, <DashboardTab />];

  return (
    <div style={{ background: T.bgBase, minHeight: "100vh", padding: 32, fontFamily: sans }}>
      <style>{styles}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: T.cyan500,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: sans, fontWeight: 700, fontSize: 18, color: T.bgBase,
          }}>P</div>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22, color: T.textPrimary, letterSpacing: "-0.01em" }}>Polyforge Design System</div>
            <div style={{ fontFamily: sans, fontSize: 12, color: T.textMuted }}>Dark · Cyan · "Precision Instrument"</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.cyan500, background: T.cyanGlow, borderRadius: 4, padding: "3px 10px" }}>#06B6D4</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: T.textSecondary, background: T.bgSurface, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: "3px 10px" }}>#080C14</div>
            <div style={{ fontFamily: sans, fontSize: 11, color: T.textSecondary, background: T.bgSurface, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: "3px 10px" }}>Outfit + JetBrains Mono</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.borderSubtle}`, marginBottom: 28 }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            className={`tab-btn ${tab === i ? "active" : ""}`}
            onClick={() => setTab(i)}
            style={{
              background: "none", border: "none", borderBottom: `2px solid transparent`,
              padding: "10px 20px", fontFamily: sans, fontSize: 14, fontWeight: 500,
              color: tab === i ? T.cyan500 : T.textSecondary,
              borderBottom: tab === i ? `2px solid ${T.cyan500}` : "2px solid transparent",
              cursor: "pointer", marginBottom: -1,
            }}
          >{t}</button>
        ))}
      </div>

      {/* Content */}
      <div key={tab}>{content[tab]}</div>
    </div>
  );
}
