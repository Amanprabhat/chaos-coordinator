export const theme = {
  colors: {
    primary: '#FF6A3D',
    secondary: '#1A1F36',
    background: '#F7F9FC',
    surface: '#FFFFFF',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    text: {
      primary: '#1A1F36',
      secondary: '#64748B',
      tertiary: '#94A3B8',
    },
    border: {
      light: '#E2E8F0',
      medium: '#CBD5E1',
      dark: '#94A3B8',
    }
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: '32px',
    },
    h2: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: '24px',
    },
    h3: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: '22px',
    },
    body: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: '20px',
    },
    small: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: '16px',
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  }
};

export type Theme = typeof theme;
