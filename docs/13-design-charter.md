# Polyforge — Charte Graphique

> Direction artistique, design system, et implémentation PrimeNG.  
> Ce document fait autorité sur toutes les décisions visuelles du projet.

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

```
─────────────────────────────────────────────────────────────
BACKGROUNDS
─────────────────────────────────────────────────────────────
--pf-bg-base       #080C14    Fond principal — bleu-nuit très profond
--pf-bg-surface    #0D1421    Cartes, panneaux, sidebar
--pf-bg-elevated   #111D2E    Modals, dropdowns, tooltips
--pf-bg-overlay    #162030    Hover state sur les surfaces

─────────────────────────────────────────────────────────────
BORDERS
─────────────────────────────────────────────────────────────
--pf-border-subtle  #1A2840   Séparateurs discrets (tables, sections)
--pf-border-default #1E3350   Bordures standard (inputs, cartes)
--pf-border-strong  #264060   Bordures actives ou focus

─────────────────────────────────────────────────────────────
TEXTE
─────────────────────────────────────────────────────────────
--pf-text-primary   #E8EDF5   Titres, labels principaux
--pf-text-secondary #7A94B4   Labels secondaires, descriptions
--pf-text-muted     #445E7A   Placeholders, métadonnées
--pf-text-disabled  #2A3D52   Contenu désactivé

─────────────────────────────────────────────────────────────
ACCENT — CYAN (couleur signature Polyforge)
─────────────────────────────────────────────────────────────
--pf-cyan-50        #ECFEFF
--pf-cyan-100       #CFFAFE
--pf-cyan-200       #A5F3FC
--pf-cyan-300       #67E8F9
--pf-cyan-400       #22D3EE
--pf-cyan-500       #06B6D4   ← Accent principal
--pf-cyan-600       #0891B2   ← Hover / pressed
--pf-cyan-700       #0E7490   ← Active states
--pf-cyan-glow      rgba(6,182,212,0.15)  ← Halos, glows subtils

─────────────────────────────────────────────────────────────
ACCENT — GOLD (financial data, trust, premium)
─────────────────────────────────────────────────────────────
--pf-gold-300       #FCD34D
--pf-gold-400       #FBBF24
--pf-gold-500       #F59E0B   ← Accent financier
--pf-gold-600       #D97706
--pf-gold-glow      rgba(245,158,11,0.15)

─────────────────────────────────────────────────────────────
ACCENT — PURPLE (premium features, tech, AI)
─────────────────────────────────────────────────────────────
--pf-purple-300     #C4B5FD
--pf-purple-400     #A78BFA
--pf-purple-500     #8B5CF6   ← Premium / AI accent
--pf-purple-600     #7C3AED
--pf-purple-glow    rgba(139,92,246,0.15)

─────────────────────────────────────────────────────────────
SÉMANTIQUE
─────────────────────────────────────────────────────────────
--pf-success        #10B981   Profit, confirmer, connecté
--pf-success-bg     rgba(16,185,129,0.08)
--pf-danger         #EF4444   Perte, erreur, déconnecter
--pf-danger-bg      rgba(239,68,68,0.08)
--pf-warning        #F59E0B   Alerte, attention, en attente
--pf-warning-bg     rgba(245,158,11,0.08)
--pf-info           #3B82F6   Information neutre
--pf-info-bg        rgba(59,130,246,0.08)

─────────────────────────────────────────────────────────────
DONNÉES FINANCIÈRES
─────────────────────────────────────────────────────────────
--pf-pnl-positive   #10B981   P&L positif (vert)
--pf-pnl-negative   #EF4444   P&L négatif (rouge)
--pf-pnl-neutral    #7A94B4   P&L à zéro / non calculé
--pf-price-yes      #06B6D4   Prix token YES
--pf-price-no       #7A94B4   Prix token NO
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
--pf-shadow-xs    0 1px 2px rgba(0,0,0,0.2)                                        Éléments plats (topbar, cartes au repos)
--pf-shadow-sm    0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)            Sidebar, cartes légèrement élevées
--pf-shadow-md    0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)          Cartes en hover, panneaux flottants
--pf-shadow-lg    0 8px 24px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2)            Dialogs, modals
--pf-shadow-glow  0 0 20px rgba(6,182,212,0.15)                                     Glow accent cyan
```

En light theme, les ombres utilisent des opacités réduites (0.05 à 0.12).

### Button hierarchy

```
Primary     — fond cyan-500, texte sombre (#080C14), font-weight 600, shadow-xs → shadow-sm au hover
Secondary   — transparent, bordure border-default, texte secondaire
Ghost/Text  — transparent, pas de bordure, texte secondaire
Danger      — fond danger (#EF4444), texte blanc, glow rouge au hover
Success     — fond success (#10B981), texte blanc
```

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

Tous les spacings sont des multiples de 4px.

```
--pf-space-1     4px
--pf-space-2     8px
--pf-space-3    12px
--pf-space-4    16px
--pf-space-5    20px
--pf-space-6    24px
--pf-space-8    32px
--pf-space-10   40px
--pf-space-12   48px
--pf-space-16   64px
```

### Border radius

```
--pf-radius-sm    4px    Badges, tags, petits éléments
--pf-radius-md    6px    Boutons, inputs
--pf-radius-lg    8px    Cartes, panneaux
--pf-radius-xl   12px   Modals
--pf-radius-full 9999px Avatars, indicateurs ronds
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

## 6. Iconographie

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

## 7. Data visualization

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

## 8. États & feedback

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

## 9. Animations & transitions

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
- Pas d'animations sur les tableaux de données — la densité prime sur l'effet

---

## 10. Logo & identité

### Concept logotypique

Le nom **Polyforge** évoque la forge (création, précision, chaleur) et les marchés prédictifs (poly = multiple, probabilités). Le logo doit être **lisible à petite taille** (favicon, sidebar réduite).

### Logo actuel (v2.4.0)

Le logomark est un **polygone (hexagone outline) + bolt** rendu en SVG. Il est utilisé dans toutes les applications (user-app, admin-app, landing) ainsi que sur l'ecran de chargement anime.

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

## 12. Fichiers de configuration

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

### Styling — Tailwind CSS v4

All styling uses **Tailwind CSS v4** with the `@theme` directive for design token configuration.

```css
/* packages/ui/src/theme.css */
@theme {
  --color-pf-bg-base:      #080C14;
  --color-pf-bg-surface:   #0D1421;
  --color-pf-bg-elevated:  #111D2E;
  --color-pf-cyan-500:     #06B6D4;
  --color-pf-gold-500:     #EAB308;
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

*Ce document doit être relu a chaque ajout de composant majeur pour s'assurer de la coherence visuelle.*
