# PolyForge Design Charter v2 — Angular/PrimeNG (Archived)

> This document contains design specifications for the **legacy Angular/PrimeNG stack** (pre-v3.0).
> The current stack is React 19 + shadcn/ui + Tailwind CSS v4. For current conventions, see `docs/13-design-charter.md`.

---

## 5. Composants PrimeNG — configuration

> **⚠️ DEPRECATED (v3.0+):** This section applies to the legacy Angular/PrimeNG stack which has been fully replaced. The current stack uses React 19 + shadcn/ui + Tailwind CSS v4. See §32 (v3.0 React Migration) for current component conventions. Do **not** use `providePrimeNG`, `p-*` components, or `polyforge.theme.ts`.

### Theme preset (PrimeNG 17+)

Polyforge utilise le preset **Aura** de PrimeNG comme base, surcharger avec un theme custom.

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { PolyforgeTheme } from './theme/polyforge.theme';

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({
      theme: {
        preset: PolyforgeTheme,
        options: {
          darkModeSelector: false,  // toujours dark — pas de toggle
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities'
          }
        }
      }
    })
  ]
};
```

### `polyforge.theme.ts` — variables PrimeNG

```typescript
// src/app/theme/polyforge.theme.ts
import { definePreset } from 'primeng/themes';
import Aura from 'primeng/themes/aura';

export const PolyforgeTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '{cyan.50}',
      100: '{cyan.100}',
      200: '{cyan.200}',
      300: '{cyan.300}',
      400: '{cyan.400}',
      500: '{cyan.500}',
      600: '{cyan.600}',
      700: '{cyan.700}',
      800: '{cyan.800}',
      900: '{cyan.900}',
      950: '{cyan.950}',
    },
    colorScheme: {
      dark: {
        surface: {
          0:   '#ffffff',
          50:  '#E8EDF5',
          100: '#B0C0D4',
          200: '#7A94B4',
          300: '#445E7A',
          400: '#2A3D52',
          500: '#1E3350',
          600: '#1A2840',
          700: '#162030',
          800: '#111D2E',
          900: '#0D1421',
          950: '#080C14',
        },
        primary: {
          color:          '#06B6D4',
          contrastColor:  '#080C14',
          hoverColor:     '#0891B2',
          activeColor:    '#0E7490',
        },
        highlight: {
          background:    'rgba(6,182,212,0.15)',
          focusBackground: 'rgba(6,182,212,0.2)',
          color:         '#06B6D4',
          focusColor:    '#22D3EE',
        },
      }
    }
  },

  components: {
    button: {
      colorScheme: {
        dark: {
          root: {
            borderRadius:     '6px',
            paddingX:         '16px',
            paddingY:         '8px',
            fontSize:         '14px',
            fontWeight:       '500',
            fontFamily:       "'Inter', sans-serif",
          },
          primary: {
            background:       '#06B6D4',
            borderColor:      '#06B6D4',
            color:            '#080C14',
            hoverBackground:  '#0891B2',
            hoverBorderColor: '#0891B2',
            hoverColor:       '#080C14',
            activeBackground: '#0E7490',
          },
          secondary: {
            background:       'transparent',
            borderColor:      '#1E3350',
            color:            '#E8EDF5',
            hoverBackground:  '#111D2E',
            hoverBorderColor: '#264060',
          },
          danger: {
            background:       'rgba(239,68,68,0.12)',
            borderColor:      'rgba(239,68,68,0.3)',
            color:            '#EF4444',
            hoverBackground:  'rgba(239,68,68,0.2)',
          },
        }
      }
    },

    inputtext: {
      colorScheme: {
        dark: {
          root: {
            background:       '#0D1421',
            borderColor:      '#1E3350',
            color:            '#E8EDF5',
            placeholderColor: '#445E7A',
            borderRadius:     '6px',
            paddingX:         '12px',
            paddingY:         '8px',
            fontSize:         '14px',
            hoverBorderColor: '#264060',
            focusBorderColor: '#06B6D4',
            focusShadow:      '0 0 0 2px rgba(6,182,212,0.15)',
          }
        }
      }
    },

    card: {
      colorScheme: {
        dark: {
          root: {
            background:   '#0D1421',
            borderColor:  '#1A2840',
            borderRadius: '8px',
            color:        '#E8EDF5',
            shadow:       '0 4px 12px rgba(0,0,0,0.5)',
          },
          title: {
            fontSize:   '15px',
            fontWeight: '600',
          }
        }
      }
    },

    datatable: {
      colorScheme: {
        dark: {
          root: {
            borderColor:          '#1A2840',
          },
          header: {
            background:           '#0D1421',
            color:                '#445E7A',
            borderColor:          '#1A2840',
            fontSize:             '11px',
            fontWeight:           '500',
          },
          row: {
            background:           '#080C14',
            hoverBackground:      '#0D1421',
            color:                '#E8EDF5',
            borderColor:          '#1A2840',
            fontSize:             '14px',
          },
          sortIcon: {
            color:                '#445E7A',
            hoverColor:           '#06B6D4',
          },
        }
      }
    },

    badge: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '4px',
            fontSize:     '11px',
            fontWeight:   '500',
            padding:      '2px 8px',
          }
        }
      }
    },

    tag: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '4px',
            fontSize:     '11px',
            fontWeight:   '500',
            padding:      '2px 8px',
          }
        }
      }
    },

    sidebar: {
      colorScheme: {
        dark: {
          root: {
            background:   '#0D1421',
            borderColor:  '#1A2840',
            color:        '#E8EDF5',
          }
        }
      }
    },

    dialog: {
      colorScheme: {
        dark: {
          root: {
            background:   '#111D2E',
            borderColor:  '#1E3350',
            borderRadius: '12px',
            color:        '#E8EDF5',
            shadow:       '0 24px 64px rgba(0,0,0,0.7)',
          },
          title: {
            fontSize:   '18px',
            fontWeight: '600',
          }
        }
      }
    },

    toast: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '8px',
            shadow:       '0 8px 24px rgba(0,0,0,0.6)',
          },
          success: {
            background:  '#111D2E',
            borderColor: 'rgba(16,185,129,0.3)',
            color:       '#E8EDF5',
            detailColor: '#7A94B4',
          },
          error: {
            background:  '#111D2E',
            borderColor: 'rgba(239,68,68,0.3)',
            color:       '#E8EDF5',
            detailColor: '#7A94B4',
          },
          warn: {
            background:  '#111D2E',
            borderColor: 'rgba(245,158,11,0.3)',
            color:       '#E8EDF5',
            detailColor: '#7A94B4',
          },
          info: {
            background:  '#111D2E',
            borderColor: 'rgba(59,130,246,0.3)',
            color:       '#E8EDF5',
            detailColor: '#7A94B4',
          },
        }
      }
    },

    progressbar: {
      colorScheme: {
        dark: {
          root: {
            background:   '#1A2840',
            borderRadius: '9999px',
            height:       '4px',
          },
          value: {
            background: '#06B6D4',
          }
        }
      }
    },

    chip: {
      colorScheme: {
        dark: {
          root: {
            background:   '#162030',
            borderColor:  '#1E3350',
            color:        '#7A94B4',
            borderRadius: '4px',
            fontSize:     '12px',
            padding:      '2px 10px',
          }
        }
      }
    },

    menu: {
      colorScheme: {
        dark: {
          root: {
            background:   '#111D2E',
            borderColor:  '#1E3350',
            borderRadius: '8px',
            shadow:       '0 8px 24px rgba(0,0,0,0.6)',
          },
          item: {
            color:            '#E8EDF5',
            hoverBackground:  '#162030',
            hoverColor:       '#06B6D4',
            activeBackground: '#1A2840',
            activeColor:      '#06B6D4',
            fontSize:         '14px',
            padding:          '8px 16px',
          }
        }
      }
    },

    tabs: {
      colorScheme: {
        dark: {
          root: {
            borderColor:      '#1A2840',
          },
          tab: {
            background:       'transparent',
            borderColor:      'transparent',
            color:            '#7A94B4',
            hoverColor:       '#E8EDF5',
            hoverBorderColor: '#264060',
            activeBackground: 'transparent',
            activeBorderColor:'#06B6D4',
            activeColor:      '#06B6D4',
            fontSize:         '14px',
            fontWeight:       '500',
          },
          tabpanel: {
            background:       'transparent',
            color:            '#E8EDF5',
            padding:          '16px 0',
          }
        }
      }
    },
  }
});
```

---



---

## 6. Iconographie

> **⚠️ DEPRECATED (v3.0+):** PrimeIcons and `pi pi-*` classes have been replaced by **Lucide React** (`lucide-react`). Import icons as named React components: `import { Loader2, ChevronDown } from 'lucide-react'`. Do not use `pi pi-*` classes.

### Bibliothèque principale : PrimeIcons

PrimeNG vient avec PrimeIcons. Utiliser en priorité.

```html
<!-- Exemples d'icônes clés -->
<i class="pi pi-play-circle"></i>    <!-- Start strategy -->
<i class="pi pi-stop-circle"></i>    <!-- Stop strategy -->
<i class="pi pi-pause-circle"></i>   <!-- Pause strategy -->
<i class="pi pi-chart-line"></i>     <!-- P&L chart -->
<i class="pi pi-wallet"></i>         <!-- Portfolio -->
<i class="pi pi-bolt"></i>           <!-- Live / Running -->
<i class="pi pi-code"></i>           <!-- Strategy builder -->
<i class="pi pi-copy"></i>           <!-- Fork -->
<i class="pi pi-bell"></i>           <!-- Notifications -->
<i class="pi pi-shield"></i>         <!-- Safety blocks -->
<i class="pi pi-arrow-up"></i>       <!-- P&L positif -->
<i class="pi pi-arrow-down"></i>     <!-- P&L négatif -->
```

### Tailles d'icônes

```css
--pf-icon-xs   : 12px   /* inline dans du texte */
--pf-icon-sm   : 14px   /* labels, tableaux */
--pf-icon-md   : 16px   /* boutons, navigation */
--pf-icon-lg   : 20px   /* titres de section */
--pf-icon-xl   : 24px   /* hero, actions primaires */
```

### Règles d'utilisation

- Les icônes **sans texte** doivent toujours avoir un `pTooltip` (accessibilité)
- Couleur par défaut : `var(--pf-text-secondary)`
- Couleur sur éléments actifs : `var(--pf-cyan-500)`
- Ne jamais utiliser une icône rouge ou verte seule pour indiquer un état — toujours accompagner d'un label texte

---



---

## 7. Data visualization

> **⚠️ DEPRECATED (v3.0+):** Chart.js and `PrimeNG Charts` have been replaced by **Recharts**. Use `resolveChartTheme()` from `packages/ui/src/lib/chart-colors.ts` for token-aware color resolution. See §32 and existing chart components in `apps/admin-app/src/pages/` for current patterns.

### Bibliothèque : PrimeNG Charts (Chart.js)

#### Configuration globale des charts

```typescript
// src/app/theme/chart.config.ts
export const POLYFORGE_CHART_DEFAULTS = {
  color: ['#06B6D4', '#10B981', '#EF4444', '#F59E0B', '#3B82F6'],
  plugins: {
    legend: {
      labels: {
        color:    '#7A94B4',
        font:     { family: "'Inter', sans-serif", size: 12 },
        padding:  16,
      }
    },
    tooltip: {
      backgroundColor: '#111D2E',
      titleColor:      '#E8EDF5',
      bodyColor:       '#7A94B4',
      borderColor:     '#1E3350',
      borderWidth:     1,
      padding:         12,
      cornerRadius:    6,
      titleFont:       { family: "'Inter', sans-serif", size: 13, weight: '600' },
      bodyFont:        { family: "'JetBrains Mono', monospace", size: 12 },
    }
  },
  scales: {
    x: {
      grid:  { color: '#1A2840' },
      ticks: { color: '#445E7A', font: { family: "'JetBrains Mono', monospace", size: 11 } },
    },
    y: {
      grid:  { color: '#1A2840' },
      ticks: { color: '#445E7A', font: { family: "'JetBrains Mono', monospace", size: 11 } },
    }
  }
};
```

#### Chart P&L (line chart)

```typescript
// Couleur conditionnelle selon la valeur finale
const isProfitable = finalPnl >= 0;
const lineColor    = isProfitable ? '#10B981' : '#EF4444';
const fillColor    = isProfitable ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';

datasets: [{
  data:            pnlData,
  borderColor:     lineColor,
  backgroundColor: fillColor,
  fill:            true,
  tension:         0.3,
  borderWidth:     1.5,
  pointRadius:     0,
  pointHoverRadius: 4,
}]
```

#### Chart prix OHLCV (candlestick)

Utiliser `chartjs-chart-financial` (plugin Chart.js) :

```typescript
datasets: [{
  data: candleData,
  color: {
    up:       '#10B981',   // bougie haussière
    down:     '#EF4444',   // bougie baissière
    unchanged:'#7A94B4',   // bougie neutre
  },
}]
```

### Indicateurs temps réel

Les prix live utilisent une animation de "pulse" sur le chiffre quand il change :

```css
@keyframes pf-tick {
  0%   { color: var(--pf-cyan-300); }
  100% { color: var(--pf-cyan-500); }
}

.price-updated {
  animation: pf-tick 0.4s ease-out;
}
```

---



---

## 8. États & feedback

> **⚠️ DEPRECATED (v3.0+):** PrimeNG-specific state implementations (p-toast, p-badge) in this section are replaced by Sonner (toasts) and the shared `Badge` component from `packages/ui`. Token names have changed from `--pf-*` to `--color-pf-*`. See §32 and §24 for current patterns.

### Badges de statut de stratégie

| Statut | Background | Texte | Dot |
|---|---|---|---|
| RUNNING | `rgba(6,182,212,0.12)` | `#06B6D4` | Pulsant cyan |
| PAUSED | `rgba(245,158,11,0.12)` | `#F59E0B` | Statique amber |
| IDLE | `rgba(122,148,180,0.12)` | `#7A94B4` | Statique gris |
| ERROR | `rgba(239,68,68,0.12)` | `#EF4444` | Statique rouge |
| PAPER | `rgba(168,85,247,0.12)` | `#A855F7` | Statique violet |
| ARCHIVED | `rgba(42,61,82,0.5)` | `#2A3D52` | Aucun |

Le dot "pulsant" pour RUNNING :

```css
.status-dot-running {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #06B6D4;
  box-shadow: 0 0 6px rgba(6,182,212,0.8);
  animation: pf-pulse 2s ease-in-out infinite;
}

@keyframes pf-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}
```

### États des formulaires

```
Default  : border #1E3350
Hover    : border #264060
Focus    : border #06B6D4 + box-shadow 0 0 0 2px rgba(6,182,212,0.15)
Error    : border #EF4444 + box-shadow 0 0 0 2px rgba(239,68,68,0.10)
Disabled : opacity 0.4, cursor not-allowed
```

### Toasts / notifications

Toujours positionnés `top-right`. Les toasts ne bloquent pas l'interface.

| Type | Icône | Couleur bordure |
|---|---|---|
| Success | `pi pi-check-circle` | `rgba(16,185,129,0.4)` |
| Error | `pi pi-times-circle` | `rgba(239,68,68,0.4)` |
| Warning | `pi pi-exclamation-triangle` | `rgba(245,158,11,0.4)` |
| Info | `pi pi-info-circle` | `rgba(59,130,246,0.4)` |

### Empty states

Chaque liste ou tableau vide doit afficher un empty state. Jamais un composant vide sans explication.

```html
<div class="pf-empty-state">
  <i class="pi pi-chart-line pf-empty-icon"></i>
  <p class="pf-empty-title">Aucune stratégie active</p>
  <p class="pf-empty-desc">Créez votre première stratégie pour commencer à trader.</p>
  <p-button label="Créer une stratégie" icon="pi pi-plus" routerLink="/builder" />
</div>
```

---



---

## 9. Animations & transitions

> **⚠️ DEPRECATED (v3.0+):** Angular animation syntax in this section is not applicable. Use Tailwind CSS transition/animation utilities and the duration tokens `--duration-pf-fast` (100ms), `--duration-pf-normal` (200ms), `--duration-pf-slow` (300ms) defined in `globals.css`. See §32.

### Principe : subtil et fonctionnel

Aucune animation décorative. Chaque animation a une raison fonctionnelle : indiquer un état, guider l'attention, confirmer une action.

### Durées

```css
--pf-duration-fast   : 100ms   /* hover states, focus */
--pf-duration-normal : 200ms   /* transitions de composants */
--pf-duration-slow   : 300ms   /* apparition de modals, sidebars */
```

### Transitions standards

```css
/* Hover sur éléments interactifs */
transition: background var(--pf-duration-fast) ease,
            border-color var(--pf-duration-fast) ease,
            color var(--pf-duration-fast) ease;

/* Apparition de cartes / panneaux */
transition: opacity var(--pf-duration-slow) ease,
            transform var(--pf-duration-slow) ease;

/* Entrée de route Angular (ngOnInit) */
@keyframes pf-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pf-page-enter {
  animation: pf-enter var(--pf-duration-slow) ease forwards;
}
```

### Règle des animations

- Jamais d'animation `infinite` autre que `pf-pulse` sur les dots de statut
- Durée maximale d'une transition : 350ms
- Seules les trois durées standard sont autorisées dans Tailwind : `duration-100`, `duration-200`, `duration-300`

> **Enforcement (v6.35.16):** Toutes les durées arbitraires (150ms, 250ms, 400ms, 500ms, 700ms) ont été remplacées par les tokens standard.
- Pas d'animations sur les tableaux de données — la densité prime sur l'effet

---



---

## 11. Application aux deux frontends

> **⚠️ DEPRECATED (v3.0+):** Angular/PrimeNG configuration in this section (`angular.json`, `app.config.ts`, `providePrimeNG`) does not apply. The current stack is React + Vite. See `apps/user-app/src/main.tsx` and `apps/admin-app/src/main.tsx` for current bootstrap configuration.

### User App (`apps/user-app`)

Même thème, toutes les fonctionnalités visuelles décrites ci-dessus.

**Layout :**
```
┌─ Sidebar (240px) ─┬──────────────── Content ─────────────────┐
│ Logo              │  Topbar (56px)                            │
│ Navigation        │                                           │
│ Strategy status   │  Page content                             │
│ Quick stats       │  (max-width 1440px, padding 24px)         │
│                   │                                           │
│ User profile      │                                           │
└───────────────────┴───────────────────────────────────────────┘
```

**Navigation sidebar :**

| Icône | Label | Route |
|---|---|---|
| `pi pi-th-large` | Marchés | `/markets` |
| `pi pi-code` | Stratégies | `/strategies` |
| `pi pi-chart-line` | Portfolio | `/portfolio` |
| `pi pi-list` | Ordres | `/orders` |
| `pi pi-compass` | Discover | `/discover` |
| `pi pi-trophy` | Leaderboard | `/leaderboard` |
| `pi pi-bell` | Alertes | `/alerts` |
| `pi pi-cog` | Paramètres | `/settings` |

### Admin App (`apps/admin-app`)

Même design system, mais avec une variation subtile pour distinguer visuellement les deux applications.

**Différenciateur :** la sidebar admin utilise `#0A0E18` (légèrement plus sombre) et une barre colorée `#EF4444` (rouge) en haut pour rappeler visuellement qu'on est en contexte admin.

```css
/* admin-app/src/styles/admin-overrides.css */
.admin-sidebar-header {
  border-top: 3px solid #EF4444;
}
.admin-sidebar-badge {
  /* badge "ADMIN" en rouge discret */
  background: rgba(239,68,68,0.12);
  color: #EF4444;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
}
```

---



---

## 12. Fichiers de configuration

> **⚠️ DEPRECATED (v3.0+):** The `tokens.css` file and variable naming convention (`--pf-bg-*`, `--pf-text-*`, `--pf-border-*`) described here are obsolete. Current tokens use `--color-pf-*` naming (e.g. `--color-pf-base`, `--color-pf-text`, `--color-pf-border`) and live in `packages/ui/src/globals.css` under the `@theme` block. The `polyforge.theme.ts` and `chart.config.ts` files no longer exist.

### Structure des fichiers de style

```
apps/user-app/src/
├── styles.css                    ← global styles + CSS variables
├── theme/
│   ├── polyforge.theme.ts        ← PrimeNG preset (voir section 5)
│   ├── chart.config.ts           ← Chart.js defaults (voir section 7)
│   └── tokens.css                ← CSS custom properties (voir ci-dessous)
└── app/
    └── app.config.ts             ← providePrimeNG config
```

### `tokens.css` — toutes les CSS custom properties

```css
/* apps/user-app/src/theme/tokens.css */
:root {
  /* Backgrounds */
  --pf-bg-base:       #080C14;
  --pf-bg-surface:    #0D1421;
  --pf-bg-elevated:   #111D2E;
  --pf-bg-overlay:    #162030;

  /* Borders */
  --pf-border-subtle:  #1A2840;
  --pf-border-default: #1E3350;
  --pf-border-strong:  #264060;

  /* Text */
  --pf-text-primary:   #E8EDF5;
  --pf-text-secondary: #7A94B4;
  --pf-text-muted:     #445E7A;
  --pf-text-disabled:  #2A3D52;

  /* Cyan accent */
  --pf-cyan-300:  #67E8F9;
  --pf-cyan-400:  #22D3EE;
  --pf-cyan-500:  #06B6D4;
  --pf-cyan-600:  #0891B2;
  --pf-cyan-700:  #0E7490;
  --pf-cyan-glow: rgba(6,182,212,0.15);

  /* Semantic */
  --pf-success:     #10B981;
  --pf-success-bg:  rgba(16,185,129,0.08);
  --pf-danger:      #EF4444;
  --pf-danger-bg:   rgba(239,68,68,0.08);
  --pf-warning:     #F59E0B;
  --pf-warning-bg:  rgba(245,158,11,0.08);
  --pf-info:        #3B82F6;
  --pf-info-bg:     rgba(59,130,246,0.08);

  /* P&L */
  --pf-pnl-positive: #10B981;
  --pf-pnl-negative: #EF4444;
  --pf-pnl-neutral:  #7A94B4;

  /* Spacing */
  --pf-space-1:  4px;
  --pf-space-2:  8px;
  --pf-space-3:  12px;
  --pf-space-4:  16px;
  --pf-space-5:  20px;
  --pf-space-6:  24px;
  --pf-space-8:  32px;
  --pf-space-10: 40px;
  --pf-space-12: 48px;

  /* Border radius */
  --pf-radius-sm:   4px;
  --pf-radius-md:   6px;
  --pf-radius-lg:   8px;
  --pf-radius-xl:   12px;
  --pf-radius-full: 9999px;

  /* Shadows */
  --pf-shadow-sm:   0 1px 3px rgba(0,0,0,0.4);
  --pf-shadow-md:   0 4px 12px rgba(0,0,0,0.5);
  --pf-shadow-lg:   0 8px 24px rgba(0,0,0,0.6);
  --pf-shadow-cyan: 0 0 16px rgba(6,182,212,0.2);

  /* Animation */
  --pf-duration-fast:   100ms;
  --pf-duration-normal: 200ms;
  --pf-duration-slow:   300ms;
}
```

### `styles.css` — global

```css
/* apps/user-app/src/styles.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
@import 'theme/tokens.css';
@import 'primeng/resources/primeng.css';
@import 'primeicons/primeicons.css';

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  background: var(--pf-bg-base);
  color: var(--pf-text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Toutes les valeurs numériques financières */
.pf-mono,
.price,
.pnl,
.percentage,
.order-size,
.timestamp {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* P&L coloré */
.pf-positive { color: var(--pf-pnl-positive); }
.pf-negative { color: var(--pf-pnl-negative); }
.pf-neutral  { color: var(--pf-pnl-neutral); }

/* Labels de colonnes */
.pf-col-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pf-text-muted);
}

/* Page enter animation */
@keyframes pf-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pf-page { animation: pf-enter 300ms ease forwards; }

/* Scrollbar */
::-webkit-scrollbar       { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--pf-bg-base); }
::-webkit-scrollbar-thumb { background: var(--pf-border-default); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--pf-border-strong); }

/* Sélection de texte */
::selection { background: var(--pf-cyan-glow); color: var(--pf-cyan-300); }
```

### `angular.json` — ajout des fonts dans le build

```json
"styles": [
  "src/styles.css"
],
"assets": [
  "src/favicon.ico",
  "src/assets"
]
```

---

---

