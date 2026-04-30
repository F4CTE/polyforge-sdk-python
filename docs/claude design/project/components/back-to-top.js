/* Universal back-to-top FAB.
   Vanilla JS so it works on any page regardless of framework.
   Appears after 360px scroll. Progress ring tracks scroll %.
   Hidden on @print. Respects prefers-reduced-motion. */
(function () {
  if (window.__btt_installed) return;
  window.__btt_installed = true;

  function install() {
    // Inject the styles once.
    const css = `
.btt-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-default, rgba(255,255,255,0.12));
  background: color-mix(in srgb, var(--bg-elevated, #1a1b1e) 92%, transparent);
  color: var(--text-primary, #f0f1f5);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  z-index: 90;
  opacity: 0;
  transform: translateY(12px) scale(0.92);
  pointer-events: none;
  transition: opacity 180ms ease, transform 220ms cubic-bezier(.4,1.3,.5,1),
              background-color 120ms, border-color 120ms, color 120ms;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 0;
  font: inherit;
}
.btt-fab.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
.btt-fab:hover {
  background: var(--bg-surface, #202124);
  border-color: var(--accent-border, rgba(99,102,241,0.4));
  color: var(--accent-text, #a5b4fc);
}
.btt-fab:active { transform: translateY(0) scale(0.95); }
.btt-fab svg { width: 16px; height: 16px; display: block; }
.btt-fab-ring {
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  pointer-events: none;
  padding: 2px;
  background:
    conic-gradient(from -90deg,
      var(--accent-default, #6366f1) calc(var(--btt-pct, 0) * 1%),
      transparent calc(var(--btt-pct, 0) * 1%) 100%);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
          mask-composite: exclude;
  opacity: 0.9;
}
.btt-fab:hover .btt-fab-ring { opacity: 1; }
@media (max-width: 520px) {
  .btt-fab { right: 16px; bottom: 16px; width: 40px; height: 40px; }
}
@media print { .btt-fab { display: none !important; } }
`;
    const style = document.createElement('style');
    style.setAttribute('data-btt', '1');
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.className = 'btt-fab';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.title = 'Back to top';
    btn.innerHTML = `<span class="btt-fab-ring" aria-hidden="true"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
    document.body.appendChild(btn);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function smoothScrollTo(target, duration) {
      if (reduce) { window.scrollTo(0, target); return; }
      const start = window.pageYOffset;
      const change = target - start;
      const startTime = performance.now();
      function ease(t) { return 1 - Math.pow(1 - t, 3); }
      function tick(now) {
        const t = Math.min(1, (now - startTime) / duration);
        window.scrollTo(0, start + change * ease(t));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    btn.addEventListener('click', () => smoothScrollTo(0, 560));

    function onScroll() {
      const doc = document.documentElement;
      const y = doc.scrollTop;
      const h = doc.scrollHeight - doc.clientHeight;
      const visible = y > 360;
      btn.classList.toggle('visible', visible);
      const pct = h > 0 ? Math.min(100, (y / h) * 100) : 0;
      btn.style.setProperty('--btt-pct', pct.toFixed(1));
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
