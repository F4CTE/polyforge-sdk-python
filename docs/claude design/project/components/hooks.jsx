// Hooks — live data feel
const { useState, useEffect, useRef, useCallback } = React;

function useTicker(initial, { volatility = 0.008, interval = 1400 } = {}) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const id = setInterval(() => {
      setData(prev => prev.map((row, i) => {
        if (Math.random() > 0.35) return row;
        const drift = (Math.random() - 0.5) * volatility;
        const next = Math.max(0.01, Math.min(0.99, row.px + drift));
        const chg = +(row.chg + drift * 10).toFixed(1);
        return { ...row, px: +next.toFixed(2), chg, _pulse: drift > 0 ? 'up' : 'down', _pulseAt: Date.now() + i };
      }));
    }, interval);
    return () => clearInterval(id);
  }, []);
  return data;
}

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useTweak(key) {
  const [val, setVal] = useState(() => window.__TWEAKS__[key]);
  const update = useCallback((next) => {
    window.__TWEAKS__[key] = next;
    setVal(next);
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: next } }, '*');
    } catch (e) {}
    // Apply side effects
    if (key === 'theme') document.documentElement.setAttribute('data-theme', next);
    if (key === 'accent') document.documentElement.setAttribute('data-accent', next === 'electric-blue' ? '' : next);
    if (key === 'density') document.documentElement.setAttribute('data-density', next);
  }, [key]);
  return [val, update];
}

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

Object.assign(window, { useTicker, useClock, useTweak, useInView });
