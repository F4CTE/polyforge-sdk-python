# Polyforge — Charte Graphique

> Direction artistique et design system pour le stack React 19 + shadcn/ui + Tailwind CSS v4.  
> Ce document fait autorité sur toutes les décisions visuelles du projet. Sections Angular/PrimeNG archivées dans [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md).

---

## Table des matières

1. [Direction artistique](#1-direction-artistique)
2. [Couleurs](#2-couleurs)
3. [Typographie](#3-typographie)
4. [Espacements & grille](#4-espacements--grille)
5. [Composants PrimeNG — configuration](#5-composants-primeng--configuration)
6. [Iconographie](#6-iconographie)
7. [Data visualization](#7-data-visualization)
8. [États & feedback](#8-états--feedback)
9. [Animations & transitions](#9-animations--transitions)
10. [Logo & identité](#10-logo--identité)
11. [Application aux deux frontends](#11-application-aux-deux-frontends)
12. [Fichiers de configuration](#12-fichiers-de-configuration)
22. [Accessibility](#22-accessibility)
23. [Typography Scale](#23-typography-scale)
24. [Status / Semantic Colors](#24-status--semantic-colors)
25. [Responsive Design](#25-responsive-design)
26. [API Keys UI](#26-api-keys-ui)
27. [Dark/Light Theme Toggle](#27-darklight-theme-toggle)
28. [Admin Dialog Styling](#28-admin-dialog-styling)
29. [Password Confirmation Pattern](#29-password-confirmation-pattern)
30. [Strategy Builder — Connection Ports & Wires](#30-strategy-builder--connection-ports--wires)
31. [Strategy Builder — Variable Blocks](#31-strategy-builder--variable-blocks)
32. [v3.0 — React + shadcn/ui Migration](#32-v30--react--shadcnui-migration)
33. [Custom Scrollbars](#33-custom-scrollbars)
34. [Market Card Redesign — Polymarket-Style](#34-market-card-redesign--polymarket-style)
35. [Inline Editable Titles](#35-inline-editable-titles)
36. [Advanced Strategy Builder — Visual Design (v3.2)](#36-advanced-strategy-builder--visual-design-v32)

---

## 1. Direction artistique

### Concept : "Precision Instrument"

Polyforge est un outil professionnel pour traders sérieux. L'interface doit inspirer **confiance, précision et contrôle** — comme un cockpit ou un terminal Bloomberg, pas comme une application grand public.

**Principes directeurs :**

- **Dense mais lisible** — l'information financière est complexe. L'interface l'organise sans la cacher.
- **Sombre et profond** — pas de noir pur. Des bleus-nuits profonds qui donnent de la profondeur sans fatiguer les yeux.
- **Cyan comme signal** — l'accent cyan n'est pas décoratif. Il indique une action, une donnée live, un élément interactif.
- **Mono pour les chiffres** — tous les prix, P&L, pourcentages, timestamps utilisent une police monospace. Les chiffres s'alignent, toujours.
- **Zéro décoration gratuite** — chaque pixel a une fonction. Pas d'illustrations, pas de gradients tapageurs, pas d'animations sans raison.

### Ce que l'interface ne doit PAS être

- Un dashboard générique avec des cartes arrondies sur fond blanc
- Un clone de Binance ou Coinbase (trop crypto, pas assez pro)
- Un outil qui ressemble à une maquette Figma non finalisée
- Coloré ou festif — Polyforge est un outil de travail

---

## 2. Couleurs

### Palette principale

> **Note (v3.0+):** Le projet utilise Tailwind v4 avec un bloc `@theme` dans `packages/ui/src/globals.css`. Les noms de variables CSS ont changé : préfixe `--color-pf-*` (au lieu de `--pf-bg-*`). La palette de base est désormais **shadcn/slate** (Tailwind slate-950/900/800) — voir section §32.

```
─────────────────────────────────────────────────────────────
BACKGROUNDS  (implémentation réelle — shadcn slate)
─────────────────────────────────────────────────────────────
--color-pf-base       #020817    Fond principal (slate-950)
--color-pf-surface    #0f172a    Cartes, panneaux, sidebar (slate-900)
--color-pf-elevated   #0f172a    Modals, dropdowns (slate-900, distincts par border)
--color-pf-overlay    #1e293b    Hover state sur les surfaces (slate-800)
--color-pf-bg         #020817    Alias de pf-base

─────────────────────────────────────────────────────────────
BORDERS  (shadcn slate)
─────────────────────────────────────────────────────────────
--color-pf-border-subtle  #1e293b   Séparateurs discrets (slate-800)
--color-pf-border         #1e293b   Bordures standard
--color-pf-border-strong  #334155   Bordures actives ou focus (slate-700)

─────────────────────────────────────────────────────────────
TEXTE  (shadcn slate)
─────────────────────────────────────────────────────────────
--color-pf-text           #f8fafc   Titres, labels principaux (slate-50)
--color-pf-text-secondary #94a3b8   Labels secondaires (slate-400)
--color-pf-text-muted     #64748b   Placeholders, métadonnées (slate-500)
--color-pf-text-tertiary  #64748b   Identique à muted
--color-pf-text-disabled  #475569   Contenu désactivé (slate-600)

─────────────────────────────────────────────────────────────
ACCENT — CYAN (couleur signature Polyforge)
─────────────────────────────────────────────────────────────
--color-pf-cyan-50        #ecfeff
--color-pf-cyan-100       #cffafe
--color-pf-cyan-200       #a5f3fc
--color-pf-cyan-300       #67e8f9
--color-pf-cyan-400       #22d3ee
--color-pf-cyan-500       #06b6d4   ← Accent principal (dark mode)
--color-pf-cyan-600       #0891b2   ← Hover / pressed
--color-pf-cyan-700       #0e7490   ← Active states / light mode accent
--color-pf-cyan-glow      rgba(6,182,212,0.15)  ← Halos, glows subtils

Light mode : --color-pf-cyan-400 → #0891b2 (cyan-600, 4.6:1 AA ✓)
             --color-pf-cyan-500 → #0e7490 (cyan-700, 6.4:1 AA ✓)

─────────────────────────────────────────────────────────────
ACCENT — GOLD (financial data, trust, premium)
─────────────────────────────────────────────────────────────
--color-pf-gold-300       #FCD34D
--color-pf-gold-400       #FBBF24
--color-pf-gold-500       #F59E0B   ← Accent financier
--color-pf-gold-600       #D97706
--color-pf-gold-glow      rgba(245,158,11,0.15)

─────────────────────────────────────────────────────────────
ACCENT — PURPLE (premium features, tech, AI)
─────────────────────────────────────────────────────────────
--color-pf-purple-300     #C4B5FD
--color-pf-purple-400     #A78BFA
--color-pf-purple-500     #8B5CF6   ← Premium / AI accent
--color-pf-purple-600     #7C3AED
--color-pf-purple-glow    rgba(139,92,246,0.15)

─────────────────────────────────────────────────────────────
SÉMANTIQUE
─────────────────────────────────────────────────────────────
--color-pf-success        #10b981   Profit, confirmer, connecté
--color-pf-success-bg     rgba(16,185,129,0.1)
--color-pf-danger         #ef4444   Perte, erreur, déconnecter
--color-pf-danger-bg      rgba(239,68,68,0.1)
--color-pf-warning        #f59e0b   Alerte, attention, en attente
--color-pf-warning-bg     rgba(245,158,11,0.1)
--color-pf-info           #3b82f6   Information neutre
--color-pf-info-bg        rgba(59,130,246,0.1)

Light mode : les couleurs sémantiques passent sur des variantes plus sombres
pour respecter WCAG AA (4.5:1) sur fond clair :
  success → #059669 (5.1:1), danger → #dc2626 (5.6:1)
  warning → #d97706 (4.5:1), info   → #2563eb (6.0:1)

─────────────────────────────────────────────────────────────
STATUS
─────────────────────────────────────────────────────────────
--color-pf-status-active    #22c55e
--color-pf-status-active-bg rgba(34,197,94,0.1)

─────────────────────────────────────────────────────────────
DONNÉES FINANCIÈRES (P&L)
─────────────────────────────────────────────────────────────
--color-pf-pnl-positive   #10b981   P&L positif (vert)
--color-pf-pnl-negative   #ef4444   P&L négatif (rouge)
--color-pf-pnl-neutral    #64748b   P&L à zéro / non calculé
```

### Règles d'utilisation des couleurs

- `--pf-cyan-500` **uniquement** pour : boutons primaires, liens actifs, données live, badge "RUNNING", indicateurs de focus
- Ne jamais utiliser le cyan sur du texte courant — réservé aux éléments interactifs et aux signaux
- Les fonds ne sont **jamais** `#000000` pur — toujours une teinte de bleu-nuit
- Le rouge et le vert sont **exclusivement sémantiques** — jamais utilisés pour décorer
- `--pf-gold-500` pour les indicateurs financiers, signaux de confiance, features premium
- `--pf-purple-500` pour les features AI, éléments tech, badges premium

### Elevation (shadow scale)

4 niveaux de profondeur + un glow pour les accents :

```
--shadow-pf-xs              0 1px 2px rgba(0,0,0,0.3)                  Éléments plats
--shadow-pf-sm              0 1px 3px rgba(0,0,0,0.3)                  Sidebar, cartes légèrement élevées
--shadow-pf-md              0 4px 6px rgba(0,0,0,0.3)                  Cartes en hover, panneaux flottants
--shadow-pf-lg              0 10px 15px rgba(0,0,0,0.3)                Dialogs, modals
--shadow-pf-ring-cyan       0 0 0 2px color-mix(…cyan 20%)             Selection ring (compare mode)
--shadow-pf-glow-cyan       0 0 12px color-mix(…cyan 8%)               Subtle highlight glow
--shadow-pf-glow-cyan-strong 0 0 20px color-mix(…cyan 30%)             Button hover glow
```

Light mode : opacités réduites (0.05 à 0.12) — voir `globals.css` `.light` block.

En light theme, les ombres utilisent des opacités réduites (0.05 à 0.12).

### Button hierarchy

```
Primary     — bg-pf-cyan-500 text-black font-semibold, hover:bg-pf-cyan-400 + glow
Secondary   — transparent border border-pf-border-subtle text-pf-text-secondary, hover:bg-pf-elevated
Ghost/Text  — transparent, pas de bordure, text-pf-text-secondary
Danger      — bg-pf-danger/10 text-pf-danger, hover:bg-pf-danger/20
Success     — bg-pf-success/10 text-pf-success, hover:bg-pf-success/20
```

Tous les boutons incluent `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/40` pour l'accessibilité clavier.

Tous les boutons utilisent `font-family: 'Inter'`, `border-radius: 8px`, `transition: all 0.15s ease`.

---

## 3. Typographie

### Familles de polices

```
Display / UI         : Inter (Google Fonts)
                       weights: 300, 400, 500, 600, 700
                       usage: titres, labels, navigation, boutons, corps de texte

Données / Chiffres   : JetBrains Mono (Google Fonts)
                       weights: 400, 500, 600, 700
                       usage: TOUS les prix, P&L, pourcentages,
                              timestamps, order IDs, hashes

Fallback système     : 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif
                       'JetBrains Mono', 'Fira Code', monospace
```

### Utility classes

```css
.font-mono    { font-family: 'JetBrains Mono', monospace; }
.font-heading { font-family: 'Inter', sans-serif; font-weight: 600; }
```

### Échelle typographique

#### Micro sizes (badges, pills, labels) — Tailwind: `text-pf-*`

```
text-pf-micro      9px  (0.5625rem)  — smallest captions
text-pf-caption   10px  (0.625rem)   — badges, pill counts
text-pf-label     11px  (0.6875rem)  — form labels, small UI text
text-pf-body-sm   13px  (0.8125rem)  — compact body text
text-pf-body      15px  (0.9375rem)  — standard reading text
text-pf-subhead   17px  (1.0625rem)  — sub-headings
```

> **Rule:** Never use arbitrary font sizes like `text-[10px]`. Use the tokens above or standard Tailwind sizes (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.).

#### Standard scale (headings, body) — design reference

```
--pf-text-xs      11px / line-height: 1.4  / letter-spacing: 0.04em
--pf-text-sm      12px / line-height: 1.5  / letter-spacing: 0.02em
--pf-text-base    14px / line-height: 1.5  / letter-spacing: 0
--pf-text-md      15px / line-height: 1.5  / letter-spacing: 0
--pf-text-lg      18px / line-height: 1.4  / letter-spacing: -0.01em
--pf-text-xl      22px / line-height: 1.3  / letter-spacing: -0.02em
--pf-text-2xl     28px / line-height: 1.2  / letter-spacing: -0.02em
--pf-text-3xl     36px / line-height: 1.1  / letter-spacing: -0.03em
```

### Règles typographiques

- La taille de base du corps de texte est **14px** — dense mais lisible sur des interfaces data-heavy
- Tous les **prix** utilisent `JetBrains Mono` — sans exception
- Les **labels de catégorie** (statuts, badges, colonnes de tableau) utilisent `letter-spacing: 0.08em` + `text-transform: uppercase` + `font-size: 11px`
- Les **titres de page** utilisent `Inter 600`, pas 700 — éviter le trop gras
- Les **nombres de P&L** utilisent `JetBrains Mono 500` avec coloration sémantique

### Exemples d'usage

```css
/* Titre de page */
.page-title {
  font-family: 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 600;
  color: var(--pf-text-primary);
  letter-spacing: -0.01em;
}

/* Prix d'un token */
.token-price {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  color: var(--pf-cyan-500);
}

/* P&L positif */
.pnl-positive {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  color: var(--pf-pnl-positive);
}

/* Label de colonne */
.column-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pf-text-muted);
}
```

---

## 4. Espacements & grille

### Unité de base : 4px

> **Note (v3.0+):** Les tokens de spacing utilisent désormais le préfixe `--spacing-pf-*` (Tailwind v4). `--spacing-pf-5` vaut **24px** (aligné sur la grille 4px × 6), pas 20px.

Tous les spacings sont des multiples de 4px. Les valeurs `.5` de Tailwind (`0.5`, `1.5`, `2.5`, `3.5`) sont **interdites** — utiliser le multiple de 4px le plus proche (`1`, `2`, `3`, `4`).

> **Enforcement (v6.35.16):** Toutes les 1 691 occurrences de spacing `.5` ont été remplacées par des équivalents 4px-grid.

```
--spacing-pf-1    4px
--spacing-pf-2    8px
--spacing-pf-3   12px
--spacing-pf-4   16px
--spacing-pf-5   24px   ← 6 × 4px (pas 20px)
--spacing-pf-6   32px
--spacing-pf-7   40px
--spacing-pf-8   48px
--spacing-pf-9   56px
--spacing-pf-10  64px
```

### Border radius

```
--radius-pf-sm    6px     Badges, tags, inputs
--radius-pf       8px     Boutons standard
--radius-pf-md   10px     Cartes légères
--radius-pf-lg   12px     Cartes, panneaux, modals
--radius-pf-full 9999px   Avatars, indicateurs ronds
```

### Layout

```
Sidebar largeur      : 240px (collapsée: 64px)
Topbar hauteur       : 56px
Content max-width    : 1440px
Content padding      : 24px
Grille interne       : 12 colonnes, gap 16px
```

### Ombres

```css
--pf-shadow-sm  : 0 1px 3px rgba(0,0,0,0.4);
--pf-shadow-md  : 0 4px 12px rgba(0,0,0,0.5);
--pf-shadow-lg  : 0 8px 24px rgba(0,0,0,0.6);
--pf-shadow-cyan: 0 0 16px rgba(6,182,212,0.2);  /* glow sur éléments actifs */
```

---

## 5. Composants PrimeNG — configuration

> ⚠️ **DEPRECATED (v3.0+):** This section has been archived. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#5-composants-primeng--configuration) for the legacy Angular/PrimeNG specification. The current stack uses React 19 + shadcn/ui + Tailwind CSS v4 — see §32.

---

## 6. Iconographie

> ⚠️ **DEPRECATED (v3.0+):** PrimeIcons (`pi pi-*`) have been replaced by **Lucide React**. Import icons as named React components: `import { Loader2, ChevronDown } from 'lucide-react'`. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#6-iconographie) for archived spec.

---

## 7. Data visualization

> ⚠️ **DEPRECATED (v3.0+):** Chart.js/PrimeNG Charts have been replaced by **Recharts**. Use `resolveChartTheme()` from `packages/ui/src/lib/chart-colors.ts`. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#7-data-visualization) for archived spec.

---

## 8. États & feedback

> ⚠️ **DEPRECATED (v3.0+):** `p-toast`/`p-badge` replaced by Sonner (toasts) and shared `Badge` from `packages/ui`. Token names changed from `--pf-*` to `--color-pf-*`. See §24 for current semantic colors and §32 for migration notes. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#8-états--feedback) for archived spec.

---

## 9. Animations & transitions

> ⚠️ **DEPRECATED (v3.0+):** Angular animation syntax not applicable. Use Tailwind CSS utilities with duration tokens `--duration-pf-fast` (100ms), `--duration-pf-normal` (200ms), `--duration-pf-slow` (300ms) from `globals.css`. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#9-animations--transitions) for archived spec.

### Duration tokens (Tailwind v4)

| Token | Utility class | Value | Use case |
|-------|--------------|-------|----------|
| `--duration-pf-fast` | `duration-pf-fast` | 100ms | Hover states, micro-interactions |
| `--duration-pf-normal` | `duration-pf-normal` | 200ms | Sidebar transitions, opacity fades |
| `--duration-pf-slow` | `duration-pf-slow` | 300ms | Progress bars, layout shifts |

**Infinite animation exceptions:** `pf-pulse` (2s) and `shimmer` (2s) are accepted longer durations for decorative infinite animations.

**SVG animations:** SVG `<animate>` elements used for decorative loops (stroke-dashoffset, opacity pulses) must also use `dur="2s"` to match the `pf-pulse` standard. Do not use arbitrary durations like 1.5s, 2.3s, or 2.5s.

**Ambient background exceptions (>5s):** Decorative background animations (auth-background floats, landing hero particles) use long durations that are imperceptible as interactions. These are exempt from the 100–300ms token range and defined as CSS custom properties:

| Token | Value | Location |
|-------|-------|----------|
| `--duration-pf-ambient-slow` | 15s | Auth-background floats |
| `--duration-pf-ambient-medium` | 18s | Auth-background floats |
| `--duration-pf-ambient-fast` | 21s | Auth-background floats |
| `--duration-pf-ambient-drift` | 25s | Auth-background floats |
| `--particle-dur` (7s–12s) | per-instance | Landing hero particles |

All ambient animations are purely decorative (`aria-hidden="true"`, `pointer-events-none`) and honor `prefers-reduced-motion`.

**Strategy builder duration exceptions:** The builder canvas uses section-specific pulse rhythms to convey different operational states. These are documented as CSS custom properties:

| Token | Value | Section |
|-------|-------|---------|
| `--duration-pf-builder-triggers` | 1.4s | Trigger blocks — fast scanning rhythm |
| `--duration-pf-builder-actions` | 1.8s | Action blocks |
| `--duration-pf-builder-conditions` | 2.4s | Condition blocks |
| `--duration-pf-builder-logic` | 2s | Logic/calc blocks |
| `--duration-pf-builder-calc` | 2s | Calc blocks |
| `--duration-pf-builder-safety` | 3.6s | Safety blocks — slow heartbeat rhythm |
| `--duration-pf-builder-fired` | 0.9s | Block-fired flash |

**Rule:** Never use raw `duration-100`, `duration-200`, `duration-300` — always use `duration-pf-fast`, `duration-pf-normal`, `duration-pf-slow`.

---

## 10. Logo & identité

### Concept logotypique

Le nom **Polyforge** évoque la forge (création, précision, chaleur) et les marchés prédictifs (poly = multiple, probabilités). Le logo doit être **lisible à petite taille** (favicon, sidebar réduite).

### Logo actuel (v2.4.0)

Le logomark est un **polygone (hexagone outline) + bolt** rendu en SVG. Il est disponible en tant que composant partagé `<PolyforgeLogomark>` exporté depuis `@polyforge/ui` (`packages/ui/src/components/polyforge-logomark.tsx`). Ce composant accepte les props `size` (défaut 24) et `className` pour la couleur via `currentColor`. Il est utilisé dans toutes les applications (user-app, admin-app, landing) ainsi que sur l'ecran de chargement anime.

```
Logomark   : hexagone outline + bolt SVG
Logotype   : "Polyforge" en Inter 600
Couleur    : #06B6D4 (cyan) sur fond sombre
Favicon    : logomark seul sur fond #080C14
Loading    : logomark anime (pulse/rotation) sur l'ecran de chargement
```

### Règles d'utilisation

- Le logo n'est **jamais** affiché sur fond blanc (Polyforge est dark-only)
- Espace minimum autour du logo : 1x la hauteur du logomark
- Ne jamais étirer, tourner, ou recolorer le logo
- Version sidebar réduite : logomark seul (pas le texte)
- L'ecran de chargement affiche le logomark avec une animation subtile pendant le chargement initial de l'application

---

## 11. Application aux deux frontends

> ⚠️ **DEPRECATED (v3.0+):** Angular/PrimeNG bootstrap config (`angular.json`, `providePrimeNG`) does not apply. Current bootstrap is in `apps/user-app/src/main.tsx` and `apps/admin-app/src/main.tsx`. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#11-application-aux-deux-frontends) for archived spec.

---

## 12. Fichiers de configuration

> ⚠️ **DEPRECATED (v3.0+):** `tokens.css`, `--pf-bg-*`/`--pf-text-*` variable names, and Angular file structure are obsolete. Current tokens use `--color-pf-*` in `packages/ui/src/globals.css` under `@theme`. See [`docs/legacy/design-charter-v2-angular.md`](legacy/design-charter-v2-angular.md#12-fichiers-de-configuration) for archived spec.

---

## 13. Form Inputs — Dark Theme Tokens

Tous les champs de saisie (inputs, selects, textareas, datepickers) utilisent un fond sombre cohérent avec le thème global. Jamais de fond blanc.

```
─────────────────────────────────────────────────────────────
INPUT TOKENS (tokens.css)
─────────────────────────────────────────────────────────────
--pf-input-bg             #0D1421   Fond des inputs
--pf-input-border         #1E3350   Bordure par défaut
--pf-input-border-hover   #264060   Bordure au survol
--pf-input-border-focus   #06B6D4   Bordure au focus (cyan)
--pf-input-text           #E8EDF5   Couleur du texte
--pf-input-placeholder    #445E7A   Couleur du placeholder
--pf-input-focus-glow     0 0 0 2px rgba(6,182,212,0.15)   Halo cyan au focus
```

### Règles d'application

- **Global override** : tous les composants PrimeNG (`p-inputtext`, `p-select`, `p-textarea`, `p-datepicker`) reçoivent ces tokens via `styles.scss` avec `!important` pour garantir la cohérence.
- **Auth pages** : la card utilise `--pf-bg-elevated` avec un subtle cyan glow shadow. Le titre "Welcome back" utilise un gradient cyan.
- **Select dropdowns** : fond `--pf-bg-elevated`, options avec hover `--pf-bg-overlay`, sélection active avec `--pf-cyan-glow`.
- **DatePicker** : remplace les inputs natifs `type="date"` pour un rendu cohérent cross-browser. Panel sombre.

---

## 14. Interactivity & Micro-Interactions

### Page & Component Animations

```css
/* Page fade-in — all route components */
@keyframes pf-page-fade {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.pf-page { animation: pf-page-fade 300ms ease forwards; }

/* Card hover — lift + cyan glow */
.pf-card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 16px rgba(6,182,212,0.15);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

/* Table row hover */
.p-datatable .p-datatable-tbody > tr:hover {
  background: var(--pf-bg-overlay);
  transition: background var(--pf-duration-fast) ease;
}
```

### Live Status Dot — Pulsing Glow

The RUNNING status dot uses a pulsing glow animation to indicate live activity:

```css
.status-dot-running {
  width: 6px; height: 6px; border-radius: 50%;
  background: #06B6D4;
  box-shadow: 0 0 6px rgba(6,182,212,0.8);
  animation: pf-pulse 2s ease-in-out infinite;
}
```

### Tooltips

All column headers, status badges, portfolio cards, and admin dashboard stat cards use PrimeNG `pTooltip` for contextual help. Icons without text labels must always have a tooltip for accessibility.

### Order Detail Dialog

Clicking any order row in the Orders table opens a `p-dialog` with full order details: market, side, outcome, size, price, fill details, fees, timestamps, and CLOB order ID. Provides an at-a-glance view without navigating away.

### Notification Bell

The user-app topbar includes a notification bell (`pi pi-bell`) with:
- Unread count badge (PrimeNG `p-badge`)
- Dropdown panel listing recent notifications
- Marks notifications as read on open

### Sparkline Mini-Charts

Market list rows include sparkline mini-charts showing the 24h price trend. Rendered as inline `<canvas>` elements using Chart.js with zero-config (no axes, no labels, no tooltips) — line color follows `--pf-cyan-500`.

### Canvas Strategy Builder (v2.4.0)

The strategy builder uses an SVG-based 2D canvas for visual block composition, replacing the previous tab-based list approach.

**Canvas features:**

- **Free-form positioning** — blocks can be dragged anywhere on the canvas
- **Pan & zoom** — scroll to pan, pinch/wheel to zoom the canvas viewport
- **Auto-layout** — blocks auto-arrange in section columns (Safety | Triggers | Conditions | Actions) on initial load or via layout button
- **Bezier connection lines** — SVG bezier curves connect blocks to show evaluation flow
- **Color-coded blocks** — each block category has a distinct color: Safety (red), Triggers (amber), Conditions (blue), Actions (green)
- **FAB add button** — floating action button opens a block picker to add new blocks to the canvas
- **Block config** — clicking a block opens its configuration panel

**Visual rules:**

- Block rectangles use `--pf-bg-surface` with a colored left border indicating category
- Selected block has a `--pf-cyan-500` border highlight
- Connection lines use `stroke: var(--pf-border-default)` with category-colored endpoints
- The canvas background uses `--pf-bg-base` with a subtle dot grid pattern

### Drag & Drop Block Positioning

Blocks on the strategy builder canvas can be freely dragged to any position. The drag interaction uses native pointer events on the SVG canvas (not `@angular/cdk` `DragDrop`). Block positions are persisted as part of the strategy layout metadata.

### Cross-App Live Updates

- **Orders**: Order list auto-refreshes when `ORDER_FILLED`, `ORDER_CANCELLED`, or `ORDER_FAILED` WebSocket events arrive
- **Ticket detail**: Polls for new messages every 15 seconds while the detail view is open
- **Admin sidebar**: Badge on "Tickets" nav item shows the count of open tickets; toast notification on new ticket creation

---

## 15. Support Ticket System — UI Patterns

### User-side (user-app)

- **Ticket list** : utilise les mêmes patterns que les autres pages de liste (table-panel, pagination).
- **Status badges** : `OPEN` (cyan), `AWAITING_USER` (warning/orange), `AWAITING_ADMIN` (cyan clair), `CLOSED` (muted gris).
- **Category badge** : fond `--pf-bg-elevated`, monospace, uppercase, petit.
- **Ticket detail** : messages admin identifiés par un `border-left: 3px solid cyan` et un fond légèrement teinté cyan.
- **Reply form** : textarea dark + bouton "Send Reply".

### Admin-side (admin-app)

- **Dashboard stat cards** : 4 cartes (Users, Strategies, Orders, Tickets) avec icône colorée, label, et valeur numérique. Cliquables vers la page correspondante.
- **Ticket assignment** : avatar circulaire avec initiale colorée (palette déterministe par hash du nom). "Unassigned" en gris italic quand non assigné.

---

## 16. Clickable Elements

All table rows that represent a data entity should be clickable to navigate to that entity's detail view.

**Implementation rules:**

- Add `[routerLink]` on the `<tr>` element — not just on a cell or link inside it
- The `.admin-table-row` class provides `cursor: pointer` and the `.table-row:hover` rule provides background highlight (`var(--pf-bg-overlay)`)
- Strategy cards in Discover/Leaderboard are also clickable, navigating to strategy detail
- Action buttons (Stop, Delete, Replay, etc.) inside clickable rows must use `$event.stopPropagation()` on their `(click)` handler to prevent row navigation
- Links inside clickable rows (e.g., user name links) remain functional; the row-level routerLink serves as a fallback click target

---

## 17. Empty States

Every list, table, or data container must display an empty state when there is no data. Never show a blank component.

**Structure (standardized):**

```html
<div class="empty-state">
  <i class="pi pi-[relevant-icon] empty-state-icon"></i>
  <p class="empty-state-title">No [items] yet</p>
  <p class="empty-state-desc">[What to do next]</p>
  <div class="empty-state-action">                            <!-- optional -->
    <p-button label="[CTA]" icon="pi pi-plus" />
  </div>
</div>
```

**Class specifications:**

- `.empty-state` — flex column, centered, `padding: 48px 24px`, `gap: 12px`
- `.empty-state-icon` — `font-size: 48px`, `opacity: 0.3`, `color: var(--pf-text-muted)`
- `.empty-state-title` — `font-size: 18px` (`var(--pf-font-lg)`), `font-weight: 600`, `color: var(--pf-text-primary)`
- `.empty-state-desc` — `font-size: 13px` (`var(--pf-font-sm)`), `color: var(--pf-text-muted)`, `max-width: 360px`
- `.empty-state-action` — `margin-top: 8px`, wraps the optional CTA button

**Rules:**

- The icon should be contextually relevant: `pi-users` for users, `pi-code` for strategies, `pi-list` for orders, `pi-comments` for tickets, `pi-history` for backtests
- The CTA button is optional — include it when there is a clear next action the user can take
- Legacy `.pf-empty-state` / `.pf-empty-icon` / `.pf-empty-title` / `.pf-empty-desc` classes are deprecated; migrate to the standardized `.empty-state` classes

---

## 18. Sidebar Collapse

The admin sidebar collapses to a 64px icon-only mode via the hamburger toggle button in the topbar.

**Implementation:**

- The `collapsed` state is a plain `signal<boolean>(false)` on the `LayoutComponent` — not a signal factory or computed. Plain boolean ensures reliable change detection with Angular's template binding.
- When collapsed, nav labels and section titles are hidden via `@if (!collapsed())` blocks.
- The sidebar brand shows only the bolt icon when collapsed.
- Nav items show a `[title]` tooltip (native HTML) when collapsed for accessibility.
- Width transitions from 240px to 64px using CSS transition on the `.admin-sidebar` element.

---

## 19. Leaderboard

The Leaderboard page ranks users by performance.

**Visual rules:**

- Top 3 ranks display medal icons instead of plain numbers: gold (`#FFD700`), silver (`#C0C0C0`), bronze (`#CD7F32`)
- All rank numbers use `font-family: 'JetBrains Mono', monospace` (the `.pf-mono` class)
- The leaderboard table follows all standard table conventions (hover, clickable rows, column labels)

---

## 20. Count Badges

All admin page headers display the total item count next to the page title using a `.page-count` pill badge.

**Format:** `<span class="page-count pf-mono">{{ total }} total</span>`

- The `.page-count` class renders a small rounded pill with muted background and monospace text
- Examples: "27 total" next to Users, "3 tickets" next to Tickets
- The badge is hidden while the data is still loading (wrapped in `@if (!loading())`)
- The admin sidebar shows the open ticket count as a `.nav-badge` next to the Tickets nav item, updated via `AdminPollingService` every 30 seconds

---

## 21. Topbar Breadcrumb

The admin topbar displays the current page name dynamically instead of static text.

**Implementation:**

- The `LayoutComponent` listens to `Router.events` for `NavigationEnd` and extracts the first URL segment
- The segment is title-cased and displayed in the `.topbar-title` element (e.g., "Dashboard", "Users", "Tickets")
- This provides immediate visual context for which section the admin is viewing

---

---

## 22. Accessibility

All interactive elements must meet baseline accessibility requirements.

**Rules:**

- All interactive elements must have `focus-visible` outlines: `2px solid cyan`, `2px offset`
- Icon-only buttons require an `aria-label` attribute describing the action
- Color-only indicators must have text alternatives (e.g., status badges show text alongside color)
- Destructive actions (delete, reset, close position) require confirmation dialogs before execution

---

## 23. Typography Scale

The typography scale is defined as CSS custom properties in `tokens.css`. All font sizes must reference these tokens.

| Token             | Size  | Usage                        |
| ----------------- | ----- | ---------------------------- |
| `--pf-font-xs`    | 11px  | Badges, captions, metadata   |
| `--pf-font-sm`    | 13px  | Secondary text, labels       |
| `--pf-font-base`  | 14px  | Body text                    |
| `--pf-font-md`    | 15px  | Emphasis text                |
| `--pf-font-lg`    | 18px  | Section titles               |
| `--pf-font-xl`    | 22px  | Page titles                  |
| `--pf-font-2xl`   | 28px  | Hero text                    |

Utility classes `.text-xs` through `.text-2xl` are available in both apps' global stylesheets.

---

## 24. Status / Semantic Colors

Status tokens are defined in `tokens.css` for consistent status indication across both apps.

| Token                        | Value                        | Usage                          |
| ---------------------------- | ---------------------------- | ------------------------------ |
| `--pf-status-active-color`   | `#22C55E`                    | Active / running / connected   |
| `--pf-status-active-bg`      | `rgba(34, 197, 94, 0.12)`   | Active badge background        |
| `--pf-status-warning-color`  | `#F59E0B`                    | Degraded / pending / caution   |
| `--pf-status-warning-bg`     | `rgba(245, 158, 11, 0.12)`  | Warning badge background       |
| `--pf-status-error-color`    | `#EF4444`                    | Error / failed / danger        |
| `--pf-status-error-bg`       | `rgba(239, 68, 68, 0.12)`   | Error badge background         |
| `--pf-status-info-color`     | `#3B82F6`                    | Informational                  |
| `--pf-status-info-bg`        | `rgba(59, 130, 246, 0.12)`  | Info badge background          |

Additionally, the semantic tokens `--pf-success`, `--pf-danger`, `--pf-warning`, and `--pf-info` (with their `-bg` variants) are used for P&L colors, toast messages, and general feedback.

---

## 25. Responsive Design

The UI adapts to smaller viewports with targeted responsive rules.

**Breakpoints:**

- `768px` — tablet threshold
- `480px` — mobile threshold

**Rules:**

- Tables hide non-essential columns below 768px (e.g., admin users table hides 2FA and Connected columns; tickets table hides Category and Priority)
- Dashboard stat grids collapse from 4-column to 2-column at 768px, then to 1-column at 480px
- Summary cards (portfolio, paper trading) stack vertically on mobile
- Page titles shrink to 18px (`var(--pf-font-lg)`) on mobile viewports

---

## 26. API Keys UI

### Key Display Pattern

- The full API key is displayed **only once** at creation, in a monospace read-only field
- A **"Copy" button** (icon: `pi pi-copy`) copies the key to the clipboard with a brief success toast
- A **warning banner** below the key reads: "This key will not be shown again. Store it securely."
- After dismissal, only the `prefix` (e.g., `pf_abc123`) is shown in the key list

### Scope Badges

| Scope | Color | Token |
|---|---|---|
| READ | Blue (`--pf-info` / `#3B82F6`) | `--pf-info-bg` background |
| WRITE | Amber (`--pf-warning` / `#F59E0B`) | `--pf-warning-bg` background |
| TRADE | Green (`--pf-success` / `#10B981`) | `--pf-success-bg` background |

Badges use `letter-spacing: 0.08em`, `text-transform: uppercase`, `font-size: 11px` — consistent with existing category badges.

### Status Badges

| Status | Color | Token |
|---|---|---|
| ACTIVE | Green (`--pf-success` / `#10B981`) | `--pf-success-bg` background |
| REVOKED | Red (`--pf-danger` / `#EF4444`) | `--pf-danger-bg` background |

---

## 27. Dark/Light Theme Toggle

Both user-app and admin-app support a dark/light theme toggle.

### Implementation

- **Toggle control:** Sun/moon icon button in the topbar. Uses `pi pi-sun` (dark mode active) and `pi pi-moon` (light mode active).
- **Service:** `ThemeService` (injectable, `providedIn: 'root'`). Exposes an `isDark` signal (default: `true`) and a `toggle()` method.
- **Persistence:** Theme preference is stored in `localStorage` under the key `pf-theme` (`'dark'` or `'light'`). On init, the service reads the saved value and applies it.
- **DOM attribute:** The active theme is set via `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`. CSS rules use `[data-theme="light"]` selectors for light overrides.
- **Default:** Dark mode. The app loads dark unless `localStorage` contains `pf-theme: 'light'`.

### CSS Pattern

```css
/* Default (dark) styles use standard design tokens */
.my-component {
  background: var(--pf-bg-surface);
  color: var(--pf-text-primary);
}

/* Light overrides */
[data-theme="light"] .my-component {
  background: #f8f9fa;
  color: #1a1a2e;
}
```

---

## 28. Admin Dialog Styling

All PrimeNG dialogs in admin-app must use dark theme overrides to match the application's dark design language.

### Requirements

- Every `p-dialog` must render with dark background (`--pf-bg-elevated`), light text (`--pf-text-primary`), and dark borders (`--pf-border-default`).
- Form inputs inside dialogs inherit dark input tokens (`--pf-input-bg`, `--pf-input-border`, etc.).
- Dialog backdrop uses `rgba(0, 0, 0, 0.7)`.
- The PrimeNG theme preset (`polyforge.theme.ts`) defines dialog component overrides under `components.dialog.colorScheme.dark` — these apply globally and should not be overridden per-dialog.

---

## 29. Password Confirmation Pattern

When editing an admin account, the password change flow uses a confirmation field.

### Behavior

- The "Confirm Password" field is shown **only when** the "New Password" field has a value (conditional rendering).
- A `passwordsMatch` getter compares `editPassword` and `editConfirmPassword` and returns a boolean.
- The "Save" button is disabled when `editPassword` is non-empty and `passwordsMatch` is `false`.
- The `submitEdit()` method returns early if passwords do not match.
- If the password field is left empty, no password change is sent to the API.

### Implementation Reference

```typescript
// admins.component.ts
editPassword = '';
editConfirmPassword = '';

get passwordsMatch(): boolean {
  return this.editPassword === this.editConfirmPassword;
}
```

This pattern should be reused wherever password changes are offered in admin dialogs.

---

## 30. Strategy Builder — Connection Ports & Wires

### Connection Ports

Each canvas block displays two circular ports for wiring:

- **Output port** (right edge): 6px diameter circle, centered vertically on the block's right side (`x + 280`, `y + 100`).
- **Input port** (left edge): 6px diameter circle, centered vertically on the block's left side (`x`, `y + 100`).
- **Color**: `--pf-cyan-500` (`#06B6D4`) fill with `--pf-cyan-glow` outline on hover.
- **Visibility**: Ports appear on hover over the block (opacity transition `150ms ease`). Always visible when a wire is being drawn.

### Wire Styles

Connections between blocks are rendered as SVG `<path>` elements using cubic Bezier curves.

- **Default wire**: `stroke: var(--pf-text-muted)` (`#445E7A`), `stroke-width: 2`, `stroke-dasharray: 6 4`, `fill: none`.
- **Selected wire**: `stroke: var(--pf-cyan-500)` (`#06B6D4`), `stroke-width: 2.5`, `filter: drop-shadow(0 0 6px var(--pf-cyan-glow))`.
- **Temporary wire** (during drag): `stroke: var(--pf-cyan-400)` (`#22D3EE`), `stroke-width: 2`, `stroke-dasharray: 4 4`, `opacity: 0.7`.
- **Bezier control points**: horizontal midpoint between source and target (`cx = (x1 + x2) / 2`), producing smooth S-curves.

### Interaction

- Drag from output port to input port to create a connection.
- Click a wire to select it (toggles `selectedConnectionId`).
- Press `Delete` or `Backspace` to remove the selected wire.
- No self-connections or duplicate connections are allowed.

---

## 31. Strategy Builder — Variable Blocks

### Section Color

Variable blocks use section color `#A855F7` (purple / `--pf-purple-500`), distinct from the four execution sections:

| Section    | Color     |
|------------|-----------|
| Safety     | `#EF4444` |
| Triggers   | `#F59E0B` |
| Conditions | `#3B82F6` |
| Actions    | `#22C55E` |
| Variables  | `#A855F7` |

### Block Appearance

- Variables section header uses the purple accent with `pi-calculator` icon.
- Each variable block displays the variable name in `JetBrains Mono 500` and the expression in `--pf-text-secondary`.
- Variable blocks are rendered at the top of the canvas, above the safety column.

---

---

## 32. v3.0 — React + shadcn/ui Migration

> Starting with v3.0, Polyforge frontends are migrating from Angular + PrimeNG to React + shadcn/ui + Tailwind CSS. This section documents the new design stack. The Angular sections above remain valid for the legacy apps during the transition period.

### Component Library — shadcn/ui

The v3.0 frontend uses **shadcn/ui** as its component library. shadcn/ui is not a traditional npm dependency — components are copied into the project source (`packages/ui/`) and owned by the team. They are built on **Radix UI** primitives, which provide unstyled, accessible, composable building blocks.

**Key characteristics:**

- **Copy-paste ownership** — components live in `packages/ui/src/components/` and can be freely modified to match Polyforge's design needs. No version lock-in.
- **Radix primitives** — Dialog, Popover, Select, Tabs, Tooltip, and other interactive patterns use `@radix-ui/react-*` for accessibility and keyboard handling.
- **Composable API** — components expose compound patterns (e.g., `<Card>`, `<CardHeader>`, `<CardContent>`) rather than monolithic prop-heavy APIs.

**Shared component inventory (25 components):** Button, Badge, Input, Textarea, Select, Card, Table, Tabs, Dialog, Skeleton, CardSkeleton, SkeletonLine, SkeletonCircle, SkeletonBadge, Spinner, Progress, DropdownMenu, Tooltip, Chip, StatusBadge, Checkbox, Switch, Label, Separator, Toaster.

### Styling — Tailwind CSS v4

All styling uses **Tailwind CSS v4** with the `@theme` directive for design token configuration.

```css
/* packages/ui/src/theme.css */
@theme {
  --color-pf-bg-base:      #080C14;
  --color-pf-bg-surface:   #0D1421;
  --color-pf-bg-elevated:  #111D2E;
  --color-pf-cyan-500:     #06B6D4;
  --color-pf-gold-500:     #F59E0B;
  /* ... full Polyforge palette mapped to Tailwind tokens */
}
```

- **Utility-first** — layout, spacing, typography, and color are applied via Tailwind utility classes directly in JSX.
- **No separate CSS files** — component styles live inline via `className`. Global styles are limited to the theme configuration and base resets.
- **Design tokens** — all Polyforge palette colors, spacing, and typography from sections 2-4 above are mapped to Tailwind custom theme tokens via `@theme`.

### Design Aesthetic

The v3.0 UI combines **shadcn's clean, minimal style** with the existing **Polyforge dark theme identity**:

- shadcn's default neutral palette is replaced with the Polyforge deep blue-night backgrounds and cyan accent system.
- Component borders, hover states, and focus rings use Polyforge's `--pf-border-*` and `--pf-cyan-*` tokens.
- Typography retains the Polyforge convention: Inter for UI text, JetBrains Mono for financial data.
- The overall feel remains "Precision Instrument" — dense, professional, data-focused.

### Icon Library — Lucide React

**Lucide React** replaces PrimeIcons (`pi pi-*`) as the icon library.

- Tree-shakeable SVG icons imported individually: `import { TrendingUp, Settings, Bell } from 'lucide-react'`
- Consistent 24x24 base size with `strokeWidth={1.5}` for the Polyforge visual weight.
- Same icon concepts apply (action icons for buttons, status icons for badges), just different import paths.

### Charts — Recharts

**Recharts** replaces Chart.js for all data visualization.

- Declarative React component API: `<LineChart>`, `<BarChart>`, `<AreaChart>`, etc.
- Responsive container support via `<ResponsiveContainer>`.
- Polyforge chart theming: cyan for primary series, gold for secondary, dark backgrounds matching `--pf-bg-surface`.
- Tooltip and legend styling uses Polyforge text colors and border tokens.
- **Chart color tokens** (`globals.css`): `--color-pf-chart-1` through `--color-pf-chart-6`, `--color-pf-chart-muted`, `--color-pf-chart-grid`, `--color-pf-chart-tooltip-bg`, `--color-pf-chart-tooltip-border`. Both dark and light theme overrides provided.
- **Never hardcode hex colors in Recharts `fill`/`stroke` attributes** — use `var(--color-pf-*)` CSS custom properties or the resolved `chartColors` utility from `@polyforge/ui/lib/chart-colors`.
- **Never hardcode tooltip or axis styles inline** — use `chartTooltipContentStyle`, `chartTooltipLabelStyle`, and `chartAxisTick` from `@polyforge/ui/lib/chart-styles` for consistent tooltip appearance and axis font across all charts.
- Categorical palette order: cyan → purple → gold → success → info → danger.

### Strategy Builder — React Flow

The strategy builder canvas migrates from the custom SVG implementation to **React Flow** (`@xyflow/react`).

- **Node-based graph** — blocks are custom React Flow nodes with category-colored headers (Safety=red, Triggers=amber, Conditions=blue, Actions=green, Variables=purple).
- **Edge connections** — Bezier connection lines rendered by React Flow's built-in edge system, replacing the custom SVG path rendering.
- **Pan/zoom** — React Flow's built-in viewport controls replace the custom pan/zoom implementation.
- **Minimap** — optional minimap component for large strategies.
- **Same interaction model** — drag-to-wire from output to input ports, click-to-select, Delete to remove connections.

### State Management — Zustand

**Zustand** replaces Angular signals and service-based state management.

- Lightweight stores with simple hook-based API: `const user = useAuthStore(s => s.user)`
- No boilerplate — stores are plain functions, not classes or modules.
- Devtools support via `zustand/middleware` for state inspection.
- Stores: `authStore`, `themeStore`, `notificationStore`, `websocketStore`, `builderStore`.

### Dark Mode — Tailwind dark: variant

Dark/light mode theming uses **Tailwind's `dark:` variant** with the `class` strategy.

- The `<html>` element receives a `dark` class based on user preference (stored in localStorage).
- Components use `dark:` prefixed utilities: `bg-white dark:bg-pf-bg-surface`, `text-gray-900 dark:text-pf-text-primary`.
- The theme toggle (sun/moon icon, now from Lucide React) toggles the `dark` class and persists the choice.
- Default mode is dark, consistent with the Polyforge "Precision Instrument" identity.

### shadcn Slate Palette Alignment (v3.1)

As of v3.1, all shadcn/ui CSS variables are aligned with the **shadcn slate palette** for consistency with the broader shadcn ecosystem. The dark theme CSS custom properties (`--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--accent`, `--border`, `--input`, `--ring`, `--primary`, `--secondary`, `--destructive`) now use slate-based values instead of the previous custom values. This ensures that shadcn components render correctly out of the box while still matching the Polyforge deep blue-night aesthetic through the Tailwind `@theme` overrides.

**Light theme accessibility (v3.1):** Comprehensive contrast fixes were applied across all pages for the light theme:
- Muted text (`text-muted-foreground`) upgraded to secondary contrast levels for readability
- Button text on cyan backgrounds changed from white to black for WCAG AA compliance
- Table headers and form labels upgraded to stronger contrast values
- Canvas empty state text made visible in light mode

---

## 33. Custom Scrollbars

All apps use thin, dark-themed custom scrollbars for visual consistency. The scrollbar styling is applied globally and adapts to both dark and light themes.

**Specification:**

- **Width:** 6px (thin profile to minimize visual clutter)
- **Track:** transparent background
- **Thumb (dark mode):** `rgba(255, 255, 255, 0.15)` at rest, `rgba(255, 255, 255, 0.3)` on hover
- **Thumb (light mode):** `rgba(0, 0, 0, 0.15)` at rest, `rgba(0, 0, 0, 0.3)` on hover
- **Border radius:** `3px` (rounded ends)

Applied via `scrollbar-width: thin` for Firefox and `::-webkit-scrollbar` pseudo-elements for Chromium browsers. Consistent across user-app, admin-app, and landing page.

---

## 34. Market Card Redesign — Polymarket-Style

The market page was redesigned in v3.1 to match the Polymarket visual language more closely.

**Card anatomy:**

- **Event image** — full-width image at the top of each card, sourced from market metadata. Fallback placeholder icon displayed when no image is available.
- **Title** — market question text below the image
- **Probability bars** — horizontal bar segments showing outcome probabilities with percentage labels. Color-coded per outcome.
- **Multi-outcome support** — cards expand to show all outcomes for markets with more than two options (not just Yes/No)
- **Social stats** — volume, liquidity, and strategy count displayed as compact metadata

**Layout:**
- Responsive card grid (auto-fill, minimum 300px card width)
- Cards use `--pf-bg-surface` background with `--pf-border-subtle` borders
- Hover state lifts the card with `--pf-shadow-md`

---

## 35. Inline Editable Titles

The strategy builder topbar uses an inline editable title pattern for the strategy name.

**Behavior:**

- Displays as static text by default (styled as a page heading)
- Clicking the title switches to an inline text input
- Input auto-focuses and selects all text on activation
- Pressing Enter or blurring the input saves the new name
- Pressing Escape reverts to the previous value
- Empty submissions are rejected (previous name is restored)

**Styling:**

- Static mode: `Inter 600`, `--pf-text-primary`, no visible border
- Edit mode: `Inter 600`, same font size, subtle `--pf-border-default` border, `--pf-bg-elevated` background
- Transition between modes is instant (no animation) to feel like native OS rename behavior

---

## 36. Advanced Strategy Builder — Visual Design (v3.2)

### Logic Block Visual Design

Logic blocks have a distinct visual treatment to communicate their control-flow nature.

**IF/THEN/ELSE block:**

- Two output ports instead of one:
  - **True port** (top-right): `#10B981` (green / `--pf-success`) filled circle
  - **False port** (bottom-right): `#EF4444` (red / `--pf-danger`) filled circle
- Block header displays `IF` label in `Inter 600`
- Block body shows the condition expression in `JetBrains Mono 400`, `--pf-text-secondary`
- Connection wires from the true port use `stroke: #10B981`; wires from the false port use `stroke: #EF4444`

**AND/OR/NOT gate blocks:**

- Single output port (standard placement)
- Block header displays the gate icon:
  - AND: `&` symbol in `JetBrains Mono 700`
  - OR: `|` symbol in `JetBrains Mono 700`
  - NOT: `!` symbol in `JetBrains Mono 700`
- Gate blocks use a compact square aspect ratio (120x80px) instead of the standard block rectangle

**Delay block:**

- Single input, single output
- Block body displays the delay value in `JetBrains Mono 500` with unit label (e.g., "5s", "10 ticks")
- A subtle clock icon (`Lucide: Timer`) in the block header

### Variable Block Purple Color

Variable blocks use `#A855F7` as their section color, consistent with section 31 of this charter.

- Section header: `#A855F7` background with white text
- Block left border: `3px solid #A855F7`
- `$varName` references in block configs are rendered with `color: #A855F7` and `font-family: 'JetBrains Mono'`
- The Variables panel in the builder sidebar uses a purple accent dot next to each variable name

### Calculation Block Visual Design

Calculation blocks display their mathematical nature prominently.

- Block body shows the expression or operation type in `JetBrains Mono 400`
- Input ports are labeled with their expected type:
  - Number inputs: `--pf-cyan-500` port color
  - Boolean inputs: `--pf-warning` port color (amber)
- Output port color matches the output type (number = cyan, boolean = amber)
- Math block displays the expression (e.g., `$price * $size`) centered in the block body
- Aggregation block shows the function name and window (e.g., `AVG(10)`)
- Comparison block shows the operator (e.g., `> 0.5`)

### Builder Node CSS Utilities

All builder nodes (block, calc, logic, variable) share common CSS utility classes defined in `apps/user-app/src/globals.css`. These replace inline `style={{...}}` objects with class-based styling driven by a `--node-color` CSS custom property:

| Class | Purpose |
|-------|---------|
| `.builder-node-card` | Base card: elevated bg, 1px border using `--node-color` at 38% opacity |
| `.builder-node-card--executing` | 1.5px border during live/backtest execution |
| `.builder-node-card--dashed` | Dashed border for inactive (unwired) blocks |
| `.builder-node-card--setup-needed` | Danger glow when required fields are empty |
| `.builder-node-header` | Header bar with `--node-color` at 9% bg + 2px bottom border |
| `.builder-node-header--solid` | Solid `--node-color` background header (calc, logic, variable) |
| `.builder-handle` | Handle border color from `--node-color` |
| `.builder-handle--top` | Handle positioned at 35% (dual-input top) |
| `.builder-handle--bottom` | Handle positioned at 65% (dual-input bottom) |
| `.builder-badge` | Status badge (Global, Not wired, Setup needed) — uses `--badge-color` |
| `.builder-preview-chip` | Variable preview chip with `--node-color` tint |

**Usage pattern:** Set `--node-color` on the element via a minimal `style` prop, then apply the utility class:

```tsx
<div
  className="builder-node-card w-[200px] rounded-pf-md shadow-pf-md overflow-hidden"
  style={{ '--node-color': VARIABLE_COLOR } as React.CSSProperties}
>
```

Only truly dynamic values (per-instance colors, computed animation strings, field-specific handle `top` offsets) remain as inline styles.

### Import/Export UI Patterns

**Export:**

- Download button in the strategy builder topbar (icon: `Lucide: Download`)
- Button label: "Export"
- Clicking triggers a browser download of the `.polyforge` JSON file
- Filename format: `{strategy-name}.polyforge`

**Import:**

- Import button in the strategy list page header (icon: `Lucide: Upload`)
- Two import methods:
  1. **File upload** — clicking the import button opens a file picker filtered to `.polyforge` files
  2. **Drag-and-drop** — a dashed-border drop zone appears on the strategy builder canvas when a file is dragged over the window
- Drop zone styling:
  - Border: `2px dashed var(--pf-cyan-500)` with `border-radius: 12px`
  - Background: `var(--pf-cyan-glow)` (semi-transparent cyan)
  - Center text: "Drop .polyforge file to import" in `Inter 500`, `--pf-text-secondary`
  - Icon: `Lucide: FileUp` at 48px, `--pf-cyan-400`
- On successful import, a success toast displays the imported strategy name
- On error (invalid file, schema mismatch), an error toast displays the reason

---

## §37 — Social Meta Images

### OG Image (1200×630)
- Background: `--color-pf-base` (`#020817`)
- Subtle radial cyan glow at centre
- PolyForge hexagon + lightning bolt logo centred
- Title: "POLYFORGE" in bold, `--color-pf-text` (`#e2e8f0`)
- Subtitle: "Algorithmic Trading for Prediction Markets" in `--color-pf-text-secondary`
- Feature chips: "Strategy Builder", "Copy Trading", "Whale Tracking", "AI Signals" in cyan
- Cyan accent bar at top (2px)

### Apple Touch Icon (180×180)
- Background: `--color-pf-base`
- Hexagon outline + lightning bolt in `--color-pf-cyan-500`
- "PF" text in cyan below icon

### Chart Color Fallbacks
- All Recharts components that use `getComputedStyle()` to read `--color-pf-*` tokens must provide **theme-aware** fallbacks
- Fallback values must match the exact hex from `globals.css` for both dark and light themes
- Pattern: `get('--color-pf-X') || (isDark ? '#dark' : '#light')`
- Never hardcode a single dark-mode hex as the only fallback

### Hero Particle Animation
- Particle position/size: inline `style` props (data-driven per instance)
- Particle animation: `.hero-particle` CSS class with `--particle-dur` and `--particle-delay` custom properties
- Never construct full `animation` strings inline — use CSS classes with CSS custom properties

---

*Ce document doit être relu a chaque ajout de composant majeur pour s'assurer de la coherence visuelle.*
