function Tweaks() {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useTweak('heroVariant');
  const [accent, setAccent] = useTweak('accent');
  const [density, setDensity] = useTweak('density');
  const [theme, setTheme] = useTweak('theme');
  const [reg, setReg] = useTweak('showBlockRegistry');
  const [tst, setTst] = useTweak('showTestimonials');

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, window.location.origin); } catch(e){}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!open) return null;

  const Row = ({ label, children }) => (
    <div className="tweaks-row"><label>{label}</label><div className="tweaks-pills">{children}</div></div>
  );
  const Pill = ({ active, onClick, children }) => (
    <button className={`tweaks-pill ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
  );

  return (
    <div className="tweaks-panel">
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        tweaks
        <button className="btn btn-ghost btn-sm" style={{ height: 22, width: 22, padding: 0 }} onClick={() => setOpen(false)}><Icon name="x" size={12}/></button>
      </h4>
      <Row label="hero">
        <Pill active={variant==='terminal'} onClick={()=>setVariant('terminal')}>terminal</Pill>
        <Pill active={variant==='builder'} onClick={()=>setVariant('builder')}>builder</Pill>
        <Pill active={variant==='typography'} onClick={()=>setVariant('typography')}>typo</Pill>
      </Row>
      <Row label="accent">
        {[
          ['electric-blue', '#4F6EF7'],
          ['violet', '#8B5CF6'],
          ['mint', '#2DD4BF'],
          ['amber', '#F59E0B'],
        ].map(([k,c]) => (
          <button key={k} className={`tweaks-pill ${accent===k?'active':''}`} onClick={()=>setAccent(k)} style={{ padding: '3px 6px' }}>
            <span className="swatch" style={{ background: c, display: 'inline-block', verticalAlign: 'middle' }}/>
          </button>
        ))}
      </Row>
      <Row label="density">
        <Pill active={density==='compact'} onClick={()=>setDensity('compact')}>tight</Pill>
        <Pill active={density==='comfortable'} onClick={()=>setDensity('comfortable')}>std</Pill>
        <Pill active={density==='roomy'} onClick={()=>setDensity('roomy')}>roomy</Pill>
      </Row>
      <Row label="theme">
        <Pill active={theme==='dark'} onClick={()=>setTheme('dark')}>dark</Pill>
        <Pill active={theme==='light'} onClick={()=>setTheme('light')}>light</Pill>
      </Row>
      <Row label="block registry">
        <Pill active={reg} onClick={()=>setReg(!reg)}>{reg?'on':'off'}</Pill>
      </Row>
      <Row label="testimonials">
        <Pill active={tst} onClick={()=>setTst(!tst)}>{tst?'on':'off'}</Pill>
      </Row>
    </div>
  );
}
window.Tweaks = Tweaks;
