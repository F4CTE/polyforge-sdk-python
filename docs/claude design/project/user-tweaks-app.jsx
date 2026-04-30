/* Polyforge user app · Tweaks panel
   Mirrors admin's tweaks but adds: layout density, paper/live mode,
   sidebar mode, motion, accent. Persisted via __edit_mode_set_keys. */

const USR_ACCENTS = [
  { value: 'electric-blue', label: 'Electric blue' },
  { value: 'violet',        label: 'Violet'        },
  { value: 'mint',          label: 'Mint'          },
  { value: 'amber',         label: 'Amber'         },
];

function applyUsrTweaks(t) {
  const html = document.documentElement;
  html.dataset.theme = t.theme || 'dark';

  if (t.accent && t.accent !== 'electric-blue') {
    html.dataset.accent = t.accent;
  } else {
    delete html.dataset.accent;
  }

  const root = document.querySelector('.adm-root');
  if (root) {
    root.dataset.density = t.density || 'cozy';
    root.dataset.sidebar = t.sidebar || 'expanded';
  }

  // Live motion on/off — toggles a class that disables ticker/pulse
  if (t.motion === false) {
    document.body.classList.add('usr-motion-off');
  } else {
    document.body.classList.remove('usr-motion-off');
  }
}

applyUsrTweaks(window.__TWEAKS__ || {});

function UserTweaksApp() {
  const initial = window.__TWEAKS__ || { theme: 'dark', accent: 'electric-blue', density: 'cozy', sidebar: 'expanded', tradeMode: 'paper', motion: true };
  const [values, setTweak] = useTweaks(initial);

  React.useEffect(() => { applyUsrTweaks(values); }, [values]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme">
        <TweakRadio label="Mode" value={values.theme} options={[
          { value: 'dark',  label: 'Dark'  },
          { value: 'light', label: 'Light' },
        ]} onChange={v => setTweak('theme', v)} />
        <TweakSelect label="Accent" value={values.accent}
          options={USR_ACCENTS}
          onChange={v => setTweak('accent', v)} />
      </TweakSection>

      <TweakSection label="Layout">
        <TweakRadio label="Density" value={values.density} options={[
          { value: 'compact',  label: 'Compact'  },
          { value: 'cozy',     label: 'Cozy'     },
          { value: 'spacious', label: 'Spacious' },
        ]} onChange={v => setTweak('density', v)} />
        <TweakRadio label="Sidebar" value={values.sidebar} options={[
          { value: 'collapsed', label: 'Rail' },
          { value: 'expanded',  label: 'Wide' },
        ]} onChange={v => setTweak('sidebar', v)} />
      </TweakSection>

      <TweakSection label="Trading">
        <TweakRadio label="Default mode" value={values.tradeMode} options={[
          { value: 'paper', label: 'Paper' },
          { value: 'live',  label: 'Live'  },
        ]} onChange={v => setTweak('tradeMode', v)} />
        <TweakToggle label="Live motion (ticker, pulses)" value={values.motion !== false}
          onChange={v => setTweak('motion', v)} />
      </TweakSection>

      <TweakSection label="Quick views">
        <TweakButton label="Dashboard"     onClick={() => window.location.href = 'App.html'} />
        <TweakButton label="Strategy detail" onClick={() => window.location.href = 'App-Strategy-Detail.html'} secondary />
        <TweakButton label="Market detail" onClick={() => window.location.href = 'App-Market-Detail.html'} secondary />
        <TweakButton label="Onboarding"    onClick={() => window.location.href = 'App-Onboarding.html'} secondary />
      </TweakSection>
    </TweaksPanel>
  );
}

(function mountUsrTweaks() {
  const el = document.createElement('div');
  el.id = 'usr-tweaks-root';
  document.body.appendChild(el);
  ReactDOM.createRoot(el).render(<UserTweaksApp />);
})();
