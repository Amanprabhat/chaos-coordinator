// Design Tokens for Slate Intelligence Theme
export const tokens = {
  // Colors
  colors: {
    // Brand
    primary: '#1E293B',
    accent: '#6366F1',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    
    // Text
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      tertiary: '#94A3B8',
      inverse: '#FFFFFF',
    },
    
    // Borders
    border: {
      light: '#E2E8F0',
      medium: '#CBD5E1',
      dark: '#94A3B8',
    },
    
    // States
    state: {
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
    },
    
    // Grays
    gray: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  // Spacing (8px grid system)
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },

  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },

  // Z-index
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
};

// Component-specific tokens
export const componentTokens = {
  button: {
    height: {
      sm: '2rem',   // 32px
      md: '2.5rem', // 40px
      lg: '3rem',   // 48px
    },
    padding: {
      sm: '0.5rem 1rem',
      md: '0.75rem 1.5rem',
      lg: '1rem 2rem',
    },
    borderRadius: tokens.borderRadius.base,
    fontSize: {
      sm: tokens.typography.fontSize.sm,
      md: tokens.typography.fontSize.base,
      lg: tokens.typography.fontSize.lg,
    },
    fontWeight: tokens.typography.fontWeight.medium,
  },

  input: {
    height: {
      sm: '2.5rem', // 40px
      md: '3rem',   // 48px
      lg: '3.5rem', // 56px
    },
    padding: '0.75rem 1rem',
    borderRadius: tokens.borderRadius.base,
    fontSize: tokens.typography.fontSize.base,
    borderWidth: '1px',
  },

  card: {
    padding: tokens.spacing[6],
    borderRadius: tokens.borderRadius.lg,
    shadow: tokens.shadows.md,
    border: `1px solid ${tokens.colors.border.light}`,
  },

  sidebar: {
    width: '16rem', // 256px
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.none,
  },

  modal: {
    borderRadius: tokens.borderRadius.xl,
    shadow: tokens.shadows['2xl'],
    padding: tokens.spacing[8],
  },
};

export default tokens;
