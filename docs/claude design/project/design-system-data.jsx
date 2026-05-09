/* Design System — token + component data tables.
   Pulls from styles.css (marketing/landing) and admin.css (admin shell).
   Each entry includes the CSS var, a hex/value, and the surface(s) it applies to. */

const DS_NAV = [
  {
    label: 'Foundations',
    items: [
      { id: 'overview',   num: '00', label: 'Overview' },
      { id: 'brand',      num: '01', label: 'Brand' },
      { id: 'colors',     num: '02', label: 'Color' },
      { id: 'typography', num: '03', label: 'Typography' },
      { id: 'spacing',    num: '04', label: 'Spacing' },
      { id: 'radii',      num: '05', label: 'Radii' },
      { id: 'shadows',    num: '06', label: 'Shadows' },
      { id: 'motion',     num: '07', label: 'Motion' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { id: 'iconography', num: '08', label: 'Iconography' },
      { id: 'data-viz',    num: '09', label: 'Data viz' },
    ],
  },
  {
    label: 'Components',
    items: [
      { id: 'buttons',    num: '10', label: 'Buttons' },
      { id: 'inputs',     num: '11', label: 'Forms & inputs' },
      { id: 'badges',     num: '12', label: 'Badges & chips' },
      { id: 'pills',      num: '13', label: 'Status pills' },
      { id: 'cards',      num: '14', label: 'Cards' },
      { id: 'tables',     num: '15', label: 'Tables' },
      { id: 'navigation', num: '16', label: 'Navigation' },
      { id: 'overlays',   num: '17', label: 'Modals & toasts' },
      { id: 'feedback',   num: '18', label: 'Empty & loading' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { id: 'voice',  num: '19', label: 'Voice & writing' },
      { id: 'code',   num: '20', label: 'Implementation' },
    ],
  },
  {
    label: 'Extended',
    items: [
      { id: 'avatars',       num: '21', label: 'Avatars' },
      { id: 'dropdowns',     num: '22', label: 'Dropdowns' },
      { id: 'modal',         num: '23', label: 'Modal' },
      { id: 'cmdk',          num: '24', label: 'Command palette' },
      { id: 'breadcrumbs',   num: '25', label: 'Breadcrumbs' },
      { id: 'pagination',    num: '26', label: 'Pagination' },
      { id: 'progress',      num: '27', label: 'Progress' },
    ],
  },
  {
    label: 'Guidance',
    items: [
      { id: 'layout',        num: '28', label: 'Layout & grid' },
      { id: 'font-features', num: '29', label: 'Font features' },
      { id: 'a11y',          num: '30', label: 'Accessibility' },
    ],
  },
];

/* ---- Color groups (dark theme primary; light values noted inline) ---- */
const DS_COLORS = {
  surface: {
    title: 'Surface',
    desc: 'Layered backgrounds — app < surface < elevated < overlay. Subtle is a tinted variant for table rows and feed strips.',
    swatches: [
      { token: '--bg-app',      name: 'App',      darkHex: '#0E0F11', lightHex: '#FAFAFA' },
      { token: '--bg-surface',  name: 'Surface',  darkHex: '#141519', lightHex: '#FFFFFF' },
      { token: '--bg-elevated', name: 'Elevated', darkHex: '#1C1E24', lightHex: '#F4F5F7' },
      { token: '--bg-overlay',  name: 'Overlay',  darkHex: '#22252D', lightHex: '#ECEDF2' },
      { token: '--bg-subtle',   name: 'Subtle',   darkHex: '#191B21', lightHex: '#F7F7FA' },
    ],
  },
  border: {
    title: 'Border',
    desc: '3-step border ramp. Subtle for hairlines and quiet dividers, default for buttons/inputs, strong for hover and emphasis.',
    swatches: [
      { token: '--border-subtle',  name: 'Subtle',  darkHex: '#22252D', lightHex: '#E4E5EC' },
      { token: '--border-default', name: 'Default', darkHex: '#2C2F3A', lightHex: '#D0D2E0' },
      { token: '--border-strong',  name: 'Strong',  darkHex: '#3D4152', lightHex: '#B8BAC8' },
    ],
  },
  text: {
    title: 'Text',
    desc: '4-step content ramp. Use primary for body and titles; tertiary for inert metadata; disabled only for disabled controls.',
    swatches: [
      { token: '--text-primary',   name: 'Primary',   darkHex: '#F0F1F5', lightHex: '#111216' },
      { token: '--text-secondary', name: 'Secondary', darkHex: '#8B8FA8', lightHex: '#5A5E72' },
      { token: '--text-tertiary',  name: 'Tertiary',  darkHex: '#545770', lightHex: '#9094AA' },
      { token: '--text-disabled',  name: 'Disabled',  darkHex: '#3A3D50', lightHex: '#BBBDCC' },
      { token: '--text-inverse',   name: 'Inverse',   darkHex: '#0E0F11', lightHex: '#FFFFFF' },
    ],
  },
  accent: {
    title: 'Accent — Electric Blue (default)',
    desc: 'Primary brand accent. The marketing site, auth, docs, and admin all default to this. Three additional accents — violet, mint, amber — are available via Tweaks.',
    swatches: [
      { token: '--accent-default', name: 'Default', darkHex: '#4F6EF7', lightHex: '#4F6EF7' },
      { token: '--accent-hover',   name: 'Hover',   darkHex: '#6B85F9', lightHex: '#3B5BDB' },
      { token: '--accent-text',    name: 'Text',    darkHex: '#7B96FF', lightHex: '#3B5BDB' },
      { token: '--accent-subtle',  name: 'Subtle',  darkHex: 'rgba(79,110,247,0.12)', lightHex: 'rgba(79,110,247,0.10)' },
      { token: '--accent-border',  name: 'Border',  darkHex: 'rgba(79,110,247,0.35)', lightHex: 'rgba(79,110,247,0.30)' },
    ],
  },
  semantic: {
    title: 'Semantic',
    desc: 'Status colors used for gain/loss, warnings, and info. Each has subtle (background) and text variants — never use raw default for body text on dark backgrounds.',
    swatches: [
      { token: '--gain',         name: 'Gain',         darkHex: '#22C55E', lightHex: '#16A34A' },
      { token: '--gain-text',    name: 'Gain text',    darkHex: '#4ADE80', lightHex: '#16A34A' },
      { token: '--gain-subtle',  name: 'Gain subtle',  darkHex: 'rgba(34,197,94,0.12)', lightHex: 'rgba(22,163,74,0.10)' },
      { token: '--loss',         name: 'Loss',         darkHex: '#EF4444', lightHex: '#DC2626' },
      { token: '--loss-text',    name: 'Loss text',    darkHex: '#F87171', lightHex: '#DC2626' },
      { token: '--loss-subtle',  name: 'Loss subtle',  darkHex: 'rgba(239,68,68,0.12)', lightHex: 'rgba(220,38,38,0.10)' },
      { token: '--warning',      name: 'Warning',      darkHex: '#F59E0B', lightHex: '#D97706' },
      { token: '--warning-subtle', name: 'Warn subtle', darkHex: 'rgba(245,158,11,0.12)', lightHex: 'rgba(217,119,6,0.10)' },
      { token: '--info',         name: 'Info',         darkHex: '#0EA5E9', lightHex: '#0284C7' },
    ],
  },
  alt: {
    title: 'Alternate accents (Tweaks)',
    desc: 'Three alternate brand accents. Swap with `data-accent="violet|mint|amber"` on <html>. Each replaces --accent-default plus its hover/subtle/border/text variants.',
    swatches: [
      { token: '[data-accent="violet"]', name: 'Violet', darkHex: '#8B5CF6', lightHex: '#8B5CF6' },
      { token: '[data-accent="mint"]',   name: 'Mint',   darkHex: '#2DD4BF', lightHex: '#2DD4BF' },
      { token: '[data-accent="amber"]',  name: 'Amber',  darkHex: '#F59E0B', lightHex: '#F59E0B' },
      { token: '--color-purple-400',     name: 'Purple 400', darkHex: '#A78BFA', lightHex: '#7C3AED' },
      { token: '--color-cyan-300',       name: 'Cyan 300',   darkHex: '#7FE3FF', lightHex: '#0891B2' },
      { token: '--color-gold-400',       name: 'Gold 400',   darkHex: '#FBBF24', lightHex: '#B45309' },
    ],
  },
};

/* ---- Type roles ---- */
const DS_TYPE = [
  { token: '.t-hero',       role: 'Hero',       size: 'clamp(36–60)px', weight: 600, lh: '1.05', tracking: '-0.03em', sample: 'Trade with intent.' },
  { token: '.t-display-lg', role: 'Display LG', size: '24px',           weight: 600, lh: '1.25', tracking: '-0.01em',  sample: 'Polyforge powers' },
  { token: '.h2',           role: 'Heading 2',  size: 'clamp(26–38)px', weight: 600, lh: '1.15', tracking: '-0.02em',  sample: 'Built for prediction.' },
  { token: '.t-display-sm', role: 'Display SM', size: '18px',           weight: 600, lh: '1.30', tracking: '-0.005em', sample: 'Strategy registry' },
  { token: '.t-heading',    role: 'Heading',    size: '14px',           weight: 600, lh: '1.40', tracking: '0',        sample: 'Recent activity' },
  { token: '.t-body',       role: 'Body',       size: '14px',           weight: 400, lh: '1.50', tracking: '0',        sample: 'Resolutions settle within 24 hours of source data being available.' },
  { token: '.t-body-sm',    role: 'Body SM',    size: '13px',           weight: 400, lh: '1.50', tracking: '0',        sample: 'Used for table cells, secondary copy, dense lists.' },
  { token: '.t-label',      role: 'Label',      size: '12px',           weight: 500, lh: '1.40', tracking: '0',        sample: 'Form labels, caption text, badges' },
  { token: '.t-caption',    role: 'Caption',    size: '11px',           weight: 400, lh: '1.40', tracking: '0',        sample: 'Tightest level — use sparingly' },
  { token: '.mono',         role: 'Mono',       size: 'inherit',        weight: 400, lh: 'inherit', tracking: '0',     sample: '0xA1F4·8B22·9E0F · 1,247.83 USDC', mono: true },
];

/* ---- Spacing scale ---- */
const DS_SPACING = [
  { name: '4xs', px: 2 },
  { name: '3xs', px: 4 },
  { name: '2xs', px: 6 },
  { name: 'xs',  px: 8 },
  { name: 'sm',  px: 10 },
  { name: 'md',  px: 12 },
  { name: 'lg',  px: 16 },
  { name: 'xl',  px: 20 },
  { name: '2xl', px: 24 },
  { name: '3xl', px: 32 },
  { name: '4xl', px: 48 },
  { name: '5xl', px: 64 },
  { name: '6xl', px: 96 },
  { name: '7xl', px: 112 },
];

/* ---- Radii ---- */
const DS_RADII = [
  { name: 'XS',   px: 3, use: 'Inner pills, mini-bars' },
  { name: 'SM',   px: 4, use: 'Chips, badges, kbd' },
  { name: 'Base', px: 6, use: 'Inputs, sidebar links, filters' },
  { name: 'MD',   px: 8, use: 'Buttons, swatches, toasts' },
  { name: 'LG',   px: 10, use: 'Cards, tables, code frames' },
  { name: 'XL',   px: 12, use: 'Marketing cards, modals' },
  { name: '2XL',  px: 14, use: 'Browser chrome, panels' },
  { name: 'Full', px: 999, use: 'Dots, status pills, avatars' },
];

/* ---- Shadows ---- */
const DS_SHADOWS = [
  { name: 'None',     token: 'none',         use: 'Default for inline UI on the app surface.', value: 'none' },
  { name: 'Shadow 2', token: '--shadow-2',   use: 'Browser chrome, showcase visuals, drawers.', value: '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)' },
  { name: 'Shadow 3', token: '--shadow-3',   use: 'Tweaks panel, command palette, key popovers.', value: '0 4px 24px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.30)' },
  { name: 'Drawer',   token: 'inline',       use: 'Side drawer push shadow.',                value: '-20px 0 40px rgba(0,0,0,0.3)' },
];

/* ---- Motion ---- */
const DS_MOTION = [
  { name: 'Instant',  token: '80ms',  ease: 'ease',                use: 'cmdk item hover.' },
  { name: 'Fast',     token: '120ms', ease: 'ease',                use: 'Buttons, chips, link colors.' },
  { name: 'Default',  token: '160ms', ease: 'ease',                use: 'Card hover, drawer open.' },
  { name: 'Smooth',   token: '220ms', ease: 'ease',                use: 'Drawer slide, modal scrim.' },
  { name: 'Reveal',   token: '700ms', ease: 'ease-out',            use: 'Fade-up on scroll reveal.' },
  { name: 'Draw',     token: '1.6s',  ease: 'ease-out',            use: 'Line drawing on equity curves.' },
  { name: 'Pulse',    token: '2s',    ease: 'ease-in-out infinite', use: 'Live status dots, recording pulses.' },
];

/* ---- Icon roster ---- */
const DS_MARKETING_ICONS = [
  'arrow-right','arrow-up-right','arrow-up','sun','moon','check','terminal','search',
  'bolt','trend','layers','shield','zap','dot','plus','minus','x','copy','github',
  'menu','lock','key','users','split','store','sparkles','bell','chart-bar','layout-grid',
  'rocket','coins','cpu','chevron-up','chevron-down','chevron-right','alert','info',
  'cookie','clock','book','file-text','message','code','briefcase','logo'
];
const DS_ADMIN_ICONS = [
  'dashboard','dollar','user-check','users','pie','blocks','shopping-bag','cart',
  'bar-chart','flask','database','flag','shield-alert','shield-check','scroll',
  'activity','globe','trending','settings','hammer','mail','ticket','megaphone',
  'chevron-left','chevron-right','chevron-down','panel-left','help','keyboard',
  'log-out','sun','moon','search','bell','plus','x','check','arrow-up','arrow-down',
  'arrow-up-right','more','filter','download','refresh','copy','edit','trash','eye',
  'lock','server','alert','circle-check','circle-x','clock','newspaper','layers','logo'
];

window.DS = {
  DS_NAV, DS_COLORS, DS_TYPE, DS_SPACING, DS_RADII, DS_SHADOWS, DS_MOTION,
  DS_MARKETING_ICONS, DS_ADMIN_ICONS,
};
