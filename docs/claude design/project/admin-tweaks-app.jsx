/* Polyforge admin · Tweaks panel
   Lets the user tune theme, density, accent, sidebar, severity emphasis.
   Accent values map 1:1 to the landing/docs palette in styles.css —
   we just toggle data-accent on <html> and let the base stylesheet do the work. */

const ACCENT_OPTIONS = [
  { value: 'electric-blue', label: 'Electric blue', swatch: '#4F6EF7' },
  { value: 'violet',        label: 'Violet',        swatch: '#8B5CF6' },
  { value: 'mint',          label: 'Mint',          swatch: '#2DD4BF' },
  { value: 'amber',         label: 'Amber',         swatch: '#F59E0B' },
];

function applyTweaks(t) {
  const html = document.documentElement;
  html.dataset.theme = t.theme || 'dark';

  // electric-blue is the default in styles.css → no data-accent attribute.
  if (t.accent && t.accent !== 'electric-blue') {
    html.dataset.accent = t.accent;
  } else {
    delete html.dataset.accent;
  }

  // Shell reads density/sidebar off .adm-root.
  const root = document.querySelector('.adm-root');
  if (root) {
    root.dataset.density = t.density || 'cozy';
    root.dataset.sidebar = t.sidebar || 'expanded';
  }

  // Density → CSS vars on :root.
  const dens = t.density === 'compact' ? { row: '8px 12px', card: '14px', gap: '14px', font: '12px' }
            : t.density === 'spacious' ? { row: '14px 16px', card: '22px', gap: '24px', font: '13.5px' }
                                       : { row: '11px 14px', card: '18px', gap: '20px', font: '13px' };
  html.style.setProperty('--adm-row-pad', dens.row);
  html.style.setProperty('--adm-card-pad', dens.card);
  html.style.setProperty('--adm-grid-gap', dens.gap);
  html.style.setProperty('--adm-font', dens.font);

  // Sidebar widths (collapsed shows just icons, expanded normal, wide more breathing room).
  const sw = t.sidebar === 'collapsed' ? '64px' : t.sidebar === 'wide' ? '280px' : '240px';
  html.style.setProperty('--adm-sidebar-w', sw);

  // Severity emphasis is consumed by admin.css via [data-severity].
  html.dataset.severity = t.severity || 'normal';
}

// Apply once *immediately* so first paint is right (no violet flash, no
// missing --accent-subtle/--accent-border).
applyTweaks(window.__TWEAKS__ || {});

function AdminTweaksApp() {
  const initial = window.__TWEAKS__ || { theme: 'dark', accent: 'electric-blue', density: 'cozy', sidebar: 'expanded', severity: 'normal' };
  const [values, setTweak] = useTweaks(initial);

  React.useEffect(() => { applyTweaks(values); }, [values]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme">
        <TweakRadio label="Mode" value={values.theme} options={[
          { value: 'dark',  label: 'Dark'  },
          { value: 'light', label: 'Light' },
        ]} onChange={v => setTweak('theme', v)} />
        <TweakSelect label="Accent" value={values.accent}
          options={ACCENT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={v => setTweak('accent', v)} />
      </TweakSection>

      <TweakSection label="Layout">
        <TweakRadio label="Density" value={values.density} options={[
          { value: 'compact',  label: 'Compact'  },
          { value: 'cozy',     label: 'Cozy'     },
          { value: 'spacious', label: 'Spacious' },
        ]} onChange={v => setTweak('density', v)} />
        <TweakRadio label="Sidebar" value={values.sidebar} options={[
          { value: 'collapsed', label: 'Icons' },
          { value: 'expanded',  label: 'Normal' },
          { value: 'wide',      label: 'Wide' },
        ]} onChange={v => setTweak('sidebar', v)} />
      </TweakSection>

      <TweakSection label="Signals">
        <TweakRadio label="Severity emphasis" value={values.severity} options={[
          { value: 'subtle', label: 'Subtle' },
          { value: 'normal', label: 'Normal' },
          { value: 'loud',   label: 'Loud'   },
        ]} onChange={v => setTweak('severity', v)} />
      </TweakSection>

      <TweakSection label="Quick views">
        <TweakButton label="Open dashboard"   onClick={() => window.location.href = 'Admin.html'} />
        <TweakButton label="Open user detail" onClick={() => window.location.href = 'Admin-User-Detail.html'} secondary />
        <TweakButton label="Open ticket #4214" onClick={() => window.location.href = 'Admin-Ticket-Detail.html'} secondary />
      </TweakSection>
    </TweaksPanel>
  );
}

(function mountTweaksLater() {
  // Mount after React app has rendered; share document body.
  const el = document.createElement('div');
  el.id = 'adm-tweaks-root';
  document.body.appendChild(el);
  ReactDOM.createRoot(el).render(<AdminTweaksApp />);
})();
