export const theme = {
  // Color System - Slate Intelligence
  colors: {
    primary: '#1E293B',      // Deep slate
    accent: '#6366F1',       // Indigo
    background: '#F8FAFC',   // Light neutral
    surface: '#FFFFFF',      // White
    border: '#E2E8F0',       // Very light gray
    textPrimary: '#0F172A',  // Primary text
    textSecondary: '#64748B', // Secondary text
    textTertiary: '#94A3B8', // Tertiary text
    
    // State colors
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },

  // Typography
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: '1.2',
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: '1.3',
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: '1.4',
    },
    body: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: '1.5',
    },
    small: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: '1.4',
    },
    label: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: '1.4',
    },
  },

  // Spacing
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    xxl: '3rem',      // 48px
  },

  // Border radius
  borderRadius: {
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },

  // Micro-interactions
  interactions: {
    buttonPress: 'scale(0.98)',
    cardHover: 'translateY(-2px)',
    sidebarHover: 'translateX(2px)',
  },
};

export type Theme = typeof theme;
