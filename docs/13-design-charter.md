# PolyForge Design Charter
> Inspired by Linear.app — adapted for a professional prediction market terminal

---

## 0. Philosophy

PolyForge is a **tool for sophisticated operators**. The interface should feel like a Bloomberg terminal rebuilt for the modern web: precise, dense, fast, and effortlessly readable. Every pixel that doesn't carry information is a pixel wasted.

Core principles (directly from Linear's method):
- **Reduce visual noise** — remove chrome, decorations, and anything that doesn't serve function
- **Hierarchy over decoration** — contrast and spacing communicate structure, not color or ornament
- **Dark-first** — the primary experience is dark mode; light mode is derived from the same token system
- **Information density** — pack content without clutter; distinguish compact from cramped
- **Timeless over trendy** — no glassmorphism gimmicks, no gradient soup, no shadows for aesthetic reasons

---

## 1. Color System

### Philosophy
Derived from Linear's approach: define **three core variables** per theme (base, accent, contrast) and generate all aliases algorithmically. We use the **LCH color space** for perceptual uniformity — a neutral at L=50 and an accent at L=50 will appear equally light to the human eye.

### Base Palette (Dark Theme — Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-app` | `#0E0F11` | App root background |
| `--bg-surface` | `#141519` | Cards, panels, sidebar |
| `--bg-elevated` | `#1C1E24` | Dropdowns, popovers, modals |
| `--bg-overlay` | `#22252D` | Tooltips, context menus |
| `--bg-subtle` | `#191B21` | Table row hover, subtle fills |
| `--border-subtle` | `#22252D` | Default borders |
| `--border-default` | `#2C2F3A` | Active/focused borders |
| `--border-strong` | `#3D4152` | Emphasized separators |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#F0F1F5` | Body text, labels |
| `--text-secondary` | `#8B8FA8` | Muted text, meta info |
| `--text-tertiary` | `#545770` | Placeholders, disabled |
| `--text-disabled` | `#3A3D50` | Truly disabled states |
| `--text-inverse` | `#0E0F11` | Text on accent backgrounds |

### Accent — PolyForge Electric Blue

PolyForge's identity color. Not purple (that's Linear). Not navy (that's fintech cliché). A sharp, electric periwinkle blue that reads as "precision intelligence."

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-default` | `#4F6EF7` | Primary CTAs, active states, focus rings |
| `--accent-hover` | `#6B85F9` | Hover on accent elements |
| `--accent-subtle` | `rgba(79,110,247,0.12)` | Accent backgrounds, selected rows |
| `--accent-border` | `rgba(79,110,247,0.35)` | Accent-tinted borders |
| `--accent-text` | `#7B96FF` | Accent-colored text on dark bg |

### Semantic Colors (Trading Context)

| Token | Value | Usage |
|-------|-------|-------|
| `--gain` | `#22C55E` | Positive PnL, winning positions |
| `--gain-subtle` | `rgba(34,197,94,0.12)` | Gain row backgrounds |
| `--gain-text` | `#4ADE80` | Gain values in tables |
| `--loss` | `#EF4444` | Negative PnL, losing positions |
| `--loss-subtle` | `rgba(239,68,68,0.12)` | Loss row backgrounds |
| `--loss-text` | `#F87171` | Loss values in tables |
| `--neutral-market` | `#8B8FA8` | Flat / no change |
| `--warning` | `#F59E0B` | Caution states, margin warnings |
| `--warning-subtle` | `rgba(245,158,11,0.12)` | Warning backgrounds |
| `--info` | `#0EA5E9` | Informational states |
| `--info-subtle` | `rgba(14,165,233,0.12)` | Info backgrounds |

### Light Theme (Derived)
Light mode follows the same token structure. Backgrounds invert along the elevation scale:

| Token | Value |
|-------|-------|
| `--bg-app` | `#FAFAFA` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-elevated` | `#F4F5F7` |
| `--text-primary` | `#111216` |
| `--text-secondary` | `#5A5E72` |
| `--border-subtle` | `#E4E5EC` |
| `--border-default` | `#D0D2E0` |

Accent and semantic colors remain the same in light mode (with adjusted `--accent-subtle` opacity).

---

## 2. Typography

Linear uses **Inter Display** for headings and **Inter** for body. PolyForge follows this but uses **Geist** instead — a typeface built by Vercel for developer tooling that has more character at small sizes and in dense numeric contexts.

```
font-family body:    'Geist', 'Geist Fallback', system-ui, sans-serif
font-family mono:    'Geist Mono', 'Fira Code', monospace
```

Numeric values (prices, PnL, percentages) always use `font-variant-numeric: tabular-nums` to ensure column alignment.

### Type Scale

| Role | Size | Weight | Line-height | Usage |
|------|------|--------|-------------|-------|
| `display-lg` | 24px | 600 | 1.25 | Page titles |
| `display-sm` | 18px | 600 | 1.3 | Section headers |
| `heading` | 14px | 600 | 1.4 | Card titles, panel headers |
| `body-md` | 14px | 400 | 1.5 | Default body text |
| `body-sm` | 13px | 400 | 1.5 | Secondary body, table cells |
| `label` | 12px | 500 | 1.4 | Badges, tags, status labels |
| `caption` | 11px | 400 | 1.4 | Meta info, timestamps |
| `mono-md` | 13px | 400 | 1.5 | Code, market IDs, addresses |
| `mono-sm` | 12px | 400 | 1.4 | Compact data, API keys |

**Rule**: Avoid font sizes below 11px. Avoid font weights above 600 (except display contexts). Never use `font-weight: 700` or `800` — it breaks the precision aesthetic.

---

## 3. Spacing & Layout

### Spacing Scale (4px base unit)

```
2px   — xs    (tight gaps, icon padding)
4px   — sm    (inline spacing)
6px   — md-xs (compact row padding)
8px   — md    (default component padding)
12px  — lg    (section gaps)
16px  — xl    (card padding)
24px  — 2xl   (panel padding)
32px  — 3xl   (section spacing)
48px  — 4xl   (major section breaks)
```

### Layout Structure (Linear's Inverted-L)

```
┌─────────────────────────────────────────────┐
│  Topbar (48px)                               │
├──────────┬──────────────────────────────────┤
│          │  View Header (40px)              │
│ Sidebar  ├──────────────────────────────────┤
│ (220px)  │                                  │
│          │  Main Content                    │
│          │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

- **Sidebar**: 220px fixed, collapses to 48px (icon-only mode)
- **Topbar**: 48px, contains workspace switcher, global search, user menu
- **View header**: 40px, contains view title, filters, display options
- **Content area**: fluid, no max-width cap (unlike marketing pages)

### Sidebar Structure

```
[Logo / Workspace]
─────────────────
[Dashboard]
[Markets]
[Positions]
[Strategies]
[Automations]
─────────────────
[Activity]
[Analytics]
─────────────────
[Settings]
[Docs]
```

Sidebar items: 32px height, 8px vertical padding, 12px horizontal padding, 4px border-radius. Active state: `--accent-subtle` background + `--accent-text` color.

---

## 4. Elevation System

Linear uses elevation to communicate layer depth without heavy shadows. PolyForge does the same:

| Level | Background Token | Usage | Border |
|-------|-----------------|-------|--------|
| 0 | `--bg-app` | Root app background | none |
| 1 | `--bg-surface` | Cards, sidebar, panels | `--border-subtle` |
| 2 | `--bg-elevated` | Dropdowns, sheet panels | `--border-default` |
| 3 | `--bg-overlay` | Modals, command menu | `--border-strong` |

**Shadow**: Use `box-shadow` only at elevation 2+, and only as a subtle depth signal:
```css
/* Elevation 2 */
box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);

/* Elevation 3 (modals) */
box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3);
```

Never use colored shadows or glow effects on UI chrome.

---

## 5. Component Patterns

### Tables (Primary UI Element for Trading)

Tables are the core component of PolyForge. They must be:
- **Dense**: 36px default row height, 28px compact mode
- **Scannable**: alternating subtle row backgrounds every other row (optional, prefer hover-only)
- **Numeric-aligned**: all numeric columns right-aligned with tabular-nums
- **Sortable**: column headers show sort indicator on hover, active sort always visible
- **Color-coded PnL**: gain/loss coloring on the value cell only, not the full row (unless specifically a position row)

```tsx
// Row height variants
data-density="default"   // 36px rows
data-density="compact"   // 28px rows  
data-density="comfortable" // 44px rows
```

### Badges / Status Labels

```
Variant: default   bg: --bg-elevated    text: --text-secondary
Variant: accent    bg: --accent-subtle  text: --accent-text
Variant: gain      bg: --gain-subtle    text: --gain-text
Variant: loss      bg: --loss-subtle    text: --loss-text
Variant: warning   bg: --warning-subtle text: --warning (amber)
```

Size: 12px text, 4px vertical padding, 8px horizontal padding, 4px radius. No icons inside badges unless strictly necessary.

### Buttons

```
Primary:   bg --accent-default, text white, hover --accent-hover
Secondary: bg --bg-elevated, text --text-primary, border --border-default
Ghost:     bg transparent, text --text-secondary, hover bg --bg-subtle
Danger:    bg --loss-subtle, text --loss-text, hover bg rgba(239,68,68,0.2)
```

Height: 32px default, 28px small, 36px large. Border-radius: 6px. No rounded pills for action buttons (only for tags/badges).

### Cards / Panels

```css
background: var(--bg-surface);
border: 1px solid var(--border-subtle);
border-radius: 8px;
padding: 16px;
```

No box-shadow at elevation 1. Cards are differentiated from the background purely by the subtle border.

### Input / Form Fields

```css
background: var(--bg-app);
border: 1px solid var(--border-default);
border-radius: 6px;
padding: 6px 10px;
font-size: 14px;
color: var(--text-primary);

/* Focus */
border-color: var(--accent-default);
box-shadow: 0 0 0 3px var(--accent-subtle);
```

### Charts (Recharts / D3)

- Background: transparent (inherits `--bg-surface`)
- Grid lines: `--border-subtle`, 1px, dashed
- Axis text: `--text-tertiary`, 11px
- Tooltip: elevation 3, dark background `--bg-overlay`
- Gain line/area: `--gain` (`#22C55E`)
- Loss line/area: `--loss` (`#EF4444`)
- Neutral line: `--accent-default` (`#4F6EF7`)
- No chart legends inside the chart area — use a header instead

### Command Menu (⌘K)

Full-width centered modal at elevation 3. Input at top, filtered results list below. Keyboard navigation required. Inspired by Linear's command menu: instant, no loading states visible.

---

## 6. Iconography

Use **Lucide Icons** exclusively (already in shadcn/ui ecosystem).

- **Size**: 16px default in UI, 14px inline with text, 20px for empty states
- **Stroke width**: 1.5px (Lucide default — never change this)
- **Color**: always inherit from parent text color token, never hardcode icon colors
- **No filled icons** in the UI chrome — outline only

---

## 7. Motion & Animation

Linear's philosophy: **purposeful, fast, invisible**. Animation should serve comprehension, not delight.

```css
/* Micro-interactions (hover, active states) */
transition: 120ms ease;

/* Panel/sidebar transitions */
transition: 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);

/* Modal open/close */
transition: 180ms cubic-bezier(0.16, 1, 0.3, 1);

/* Never exceed 300ms for any UI transition */
```

**Allowed animations:**
- Sidebar collapse/expand
- Dropdown/popover fade + slight translateY (4px)
- Modal scale-in (from 0.97 to 1.0) + fade
- Row selection highlight
- Number value changes (count-up animation for PnL updates)

**Forbidden animations:**
- Page transitions / route changes (instant navigation only)
- Loading skeletons with shimmer on every element
- Scroll-triggered animations in the app (landing page only)
- Bounce, elastic, or spring easing on UI chrome

**Reduced motion**: always respect `prefers-reduced-motion: reduce`.

---

## 8. Data States

Every data surface must handle all five states:

| State | Pattern |
|-------|---------|
| **Loading** | Single skeleton at container level, not per-row |
| **Empty** | Centered icon (20px) + short message + optional CTA |
| **Error** | `--loss-subtle` background, error message, retry action |
| **Partial** | Show available data, surface error inline for failed parts |
| **Stale** | Subtle indicator (timestamp + refresh icon), no blocking overlay |

Empty state copy: short, functional, no humor, no "Wow, so empty!" — this is a professional tool.

---

## 9. Responsive Behavior

PolyForge is a **desktop-first** application. Mobile is not a priority for the trading terminal, but the landing page / marketing site is responsive.

| Breakpoint | Behavior |
|-----------|---------|
| `< 768px` | Sidebar hidden, hamburger menu |
| `768px–1024px` | Sidebar collapsed (icon-only, 48px) |
| `1024px–1280px` | Sidebar normal (220px) |
| `> 1280px` | Sidebar normal + optional right panel |

---

## 10. Do / Don't

### Do
- Use `--border-subtle` to separate surfaces of the same elevation
- Right-align all numeric values in tables
- Keep all labels lowercase (sidebar items, filter chips, badge text)
- Use `font-variant-numeric: tabular-nums` on all price/pnl displays
- Prefer `opacity` and `color` transitions over layout changes
- Use Radix UI primitives via shadcn/ui for all interactive components

### Don't
- Use `font-weight: 700+` anywhere in the app UI
- Use colored backgrounds for cards (only neutral elevation tokens)
- Mix border-radius values (pick 4px, 6px, or 8px — stick to it per component type)
- Add decorative gradients to UI chrome (landing page only)
- Show modals for confirmations that could be undone inline
- Use loading spinners that block the whole view
- Hardcode colors — always use CSS custom properties
- Use `!important` anywhere

---

## 11. Tailwind / shadcn Configuration Reference

```js
// tailwind.config.ts — extend with CSS var tokens
theme: {
  extend: {
    colors: {
      bg: {
        app:      'var(--bg-app)',
        surface:  'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay:  'var(--bg-overlay)',
        subtle:   'var(--bg-subtle)',
      },
      text: {
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary:  'var(--text-tertiary)',
        disabled:  'var(--text-disabled)',
      },
      border: {
        subtle:  'var(--border-subtle)',
        default: 'var(--border-default)',
        strong:  'var(--border-strong)',
      },
      accent: {
        DEFAULT: 'var(--accent-default)',
        hover:   'var(--accent-hover)',
        subtle:  'var(--accent-subtle)',
        text:    'var(--accent-text)',
      },
      gain: {
        DEFAULT: 'var(--gain)',
        subtle:  'var(--gain-subtle)',
        text:    'var(--gain-text)',
      },
      loss: {
        DEFAULT: 'var(--loss)',
        subtle:  'var(--loss-subtle)',
        text:    'var(--loss-text)',
      },
    },
    fontFamily: {
      sans: ['Geist', 'Geist Fallback', 'system-ui', 'sans-serif'],
      mono: ['Geist Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
      'display-lg': ['24px', { lineHeight: '1.25', fontWeight: '600' }],
      'display-sm': ['18px', { lineHeight: '1.3',  fontWeight: '600' }],
      'heading':    ['14px', { lineHeight: '1.4',  fontWeight: '600' }],
      'body-md':    ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
      'body-sm':    ['13px', { lineHeight: '1.5',  fontWeight: '400' }],
      'label':      ['12px', { lineHeight: '1.4',  fontWeight: '500' }],
      'caption':    ['11px', { lineHeight: '1.4',  fontWeight: '400' }],
    },
    borderRadius: {
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
    },
    transitionDuration: {
      micro:  '120ms',
      panel:  '200ms',
      modal:  '180ms',
    },
  },
}
```

---

## 12. CSS Variables Bootstrap

```css
:root[data-theme="dark"] {
  /* Backgrounds */
  --bg-app:      #0E0F11;
  --bg-surface:  #141519;
  --bg-elevated: #1C1E24;
  --bg-overlay:  #22252D;
  --bg-subtle:   #191B21;

  /* Borders */
  --border-subtle:  #22252D;
  --border-default: #2C2F3A;
  --border-strong:  #3D4152;

  /* Text */
  --text-primary:   #F0F1F5;
  --text-secondary: #8B8FA8;
  --text-tertiary:  #545770;
  --text-disabled:  #3A3D50;
  --text-inverse:   #0E0F11;

  /* Accent */
  --accent-default: #4F6EF7;
  --accent-hover:   #6B85F9;
  --accent-subtle:  rgba(79, 110, 247, 0.12);
  --accent-border:  rgba(79, 110, 247, 0.35);
  --accent-text:    #7B96FF;

  /* Semantic */
  --gain:         #22C55E;
  --gain-subtle:  rgba(34, 197, 94, 0.12);
  --gain-text:    #4ADE80;
  --loss:         #EF4444;
  --loss-subtle:  rgba(239, 68, 68, 0.12);
  --loss-text:    #F87171;
  --warning:      #F59E0B;
  --warning-subtle: rgba(245, 158, 11, 0.12);
  --info:         #0EA5E9;
  --info-subtle:  rgba(14, 165, 233, 0.12);
}

:root[data-theme="light"] {
  --bg-app:      #FAFAFA;
  --bg-surface:  #FFFFFF;
  --bg-elevated: #F4F5F7;
  --bg-overlay:  #ECEDF2;
  --bg-subtle:   #F7F7FA;

  --border-subtle:  #E4E5EC;
  --border-default: #D0D2E0;
  --border-strong:  #B8BAC8;

  --text-primary:   #111216;
  --text-secondary: #5A5E72;
  --text-tertiary:  #9094AA;
  --text-disabled:  #BBBDCC;
  --text-inverse:   #FFFFFF;

  /* Accent same as dark */
  --accent-default: #4F6EF7;
  --accent-hover:   #3B5BDB;
  --accent-subtle:  rgba(79, 110, 247, 0.10);
  --accent-border:  rgba(79, 110, 247, 0.30);
  --accent-text:    #3B5BDB;

  /* Semantic — adjusted for light */
  --gain:        #16A34A;
  --gain-subtle: rgba(22, 163, 74, 0.10);
  --gain-text:   #16A34A;
  --loss:        #DC2626;
  --loss-subtle: rgba(220, 38, 38, 0.10);
  --loss-text:   #DC2626;
  --warning:     #D97706;
  --warning-subtle: rgba(217, 119, 6, 0.10);
}
```
