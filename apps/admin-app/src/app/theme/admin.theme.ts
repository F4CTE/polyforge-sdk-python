import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// Same dark blue-night palette as user app — admin identity is the red danger accent
export const AdminTheme = definePreset(Aura, {
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
          800: '#111820',
          900: '#0D1218',
          950: '#080C14',
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
            background: '{primary.500}',
            hoverBackground: '{primary.400}',
            borderColor: '{primary.500}',
            hoverBorderColor: '{primary.400}',
            color: '#080C14',
          },
        },
      },
    },
    inputtext: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.800}',
            borderColor: '{surface.600}',
            hoverBorderColor: '{surface.500}',
            focusBorderColor: '{primary.500}',
            color: '{surface.100}',
            placeholderColor: '{surface.400}',
          },
        },
      },
    },
    card: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.800}',
            borderColor: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    datatable: {
      colorScheme: {
        dark: {
          root: {
            borderColor: '{surface.700}',
          },
          header: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.200}',
          },
          headerCell: {
            background: '{surface.900}',
            hoverBackground: '{surface.800}',
            borderColor: '{surface.700}',
            color: '{surface.300}',
          },
          row: {
            background: '{surface.800}',
            hoverBackground: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    sidebar: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    dialog: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.800}',
            borderColor: '{surface.700}',
            color: '{surface.100}',
          },
          header: {
            background: '{surface.800}',
            borderColor: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    toast: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.800}',
            borderColor: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    select: {
      colorScheme: {
        dark: {
          root: {
            background: '{surface.800}',
            borderColor: '{surface.600}',
            hoverBorderColor: '{surface.500}',
            focusBorderColor: '{primary.500}',
            color: '{surface.100}',
          },
          overlay: {
            background: '{surface.800}',
            borderColor: '{surface.700}',
          },
          option: {
            focusBackground: '{surface.700}',
            selectedBackground: '{surface.700}',
            color: '{surface.100}',
          },
        },
      },
    },
    tabs: {
      colorScheme: {
        dark: {
          tabpanel: {
            background: 'transparent',
          },
          tab: {
            color: '{surface.300}',
            hoverColor: '{surface.100}',
            activeColor: '{primary.400}',
            activeBorderColor: '{primary.500}',
          },
        },
      },
    },
  } as any),
});
