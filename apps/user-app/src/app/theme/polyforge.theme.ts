import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

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
          color:         '#06B6D4',
          contrastColor: '#080C14',
          hoverColor:    '#0891B2',
          activeColor:   '#0E7490',
        },
        highlight: {
          background:      'rgba(6,182,212,0.15)',
          focusBackground: 'rgba(6,182,212,0.2)',
          color:           '#06B6D4',
          focusColor:      '#22D3EE',
        },
      },
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: ({
    button: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '6px',
            paddingX:     '16px',
            paddingY:     '8px',
            fontSize:     '14px',
            fontWeight:   '500',
            fontFamily:   "'Outfit', sans-serif",
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
            background:      'rgba(239,68,68,0.12)',
            borderColor:     'rgba(239,68,68,0.3)',
            color:           '#EF4444',
            hoverBackground: 'rgba(239,68,68,0.2)',
          },
        },
      },
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
          },
        },
      },
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
          },
        },
      },
    },

    datatable: {
      colorScheme: {
        dark: {
          root: {
            borderColor: '#1A2840',
          },
          header: {
            background:  '#0D1421',
            color:       '#445E7A',
            borderColor: '#1A2840',
            fontSize:    '11px',
            fontWeight:  '500',
          },
          row: {
            background:      '#080C14',
            hoverBackground: '#0D1421',
            color:           '#E8EDF5',
            borderColor:     '#1A2840',
            fontSize:        '14px',
          },
          sortIcon: {
            color:      '#445E7A',
            hoverColor: '#06B6D4',
          },
        },
      },
    },

    badge: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '4px',
            fontSize:     '11px',
            fontWeight:   '500',
            padding:      '2px 8px',
          },
        },
      },
    },

    tag: {
      colorScheme: {
        dark: {
          root: {
            borderRadius: '4px',
            fontSize:     '11px',
            fontWeight:   '500',
            padding:      '2px 8px',
          },
        },
      },
    },

    sidebar: {
      colorScheme: {
        dark: {
          root: {
            background:  '#0D1421',
            borderColor: '#1A2840',
            color:       '#E8EDF5',
          },
        },
      },
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
          },
        },
      },
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
        },
      },
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
          },
        },
      },
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
          },
        },
      },
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
          },
        },
      },
    },

    tabs: {
      colorScheme: {
        dark: {
          root: {
            borderColor: '#1A2840',
          },
          tab: {
            background:        'transparent',
            borderColor:       'transparent',
            color:             '#7A94B4',
            hoverColor:        '#E8EDF5',
            hoverBorderColor:  '#264060',
            activeBackground:  'transparent',
            activeBorderColor: '#06B6D4',
            activeColor:       '#06B6D4',
            fontSize:          '14px',
            fontWeight:        '500',
          },
          tabpanel: {
            background: 'transparent',
            color:      '#E8EDF5',
            padding:    '16px 0',
          },
        },
      },
    },
  } as any),
});
