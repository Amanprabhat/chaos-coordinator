import React, { createContext, useContext, ReactNode } from 'react';

interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    border: {
      light: string;
      medium: string;
      dark: string;
    };
    gradient: {
      primary: string;
      background: string;
    };
  };
  typography: {
    fontFamily: string;
    h1: {
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
    };
    h2: {
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
    };
    h3: {
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
    };
    body: {
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
    };
    small: {
      fontSize: string;
      fontWeight: string;
      lineHeight: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
}

const theme: Theme = {
  colors: {
    primary: '#FF6A3D',
    secondary: '#1A1F36',
    background: '#F5F7FB',
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
    },
    gradient: {
      primary: 'linear-gradient(135deg, #FF6A3D 0%, #FF8A5C 100%)',
      background: 'linear-gradient(135deg, #F5F7FB 0%, #E8EDF5 100%)',
    }
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '24px',
      fontWeight: '600',
      lineHeight: '32px',
    },
    h2: {
      fontSize: '18px',
      fontWeight: '600',
      lineHeight: '24px',
    },
    h3: {
      fontSize: '16px',
      fontWeight: '600',
      lineHeight: '22px',
    },
    body: {
      fontSize: '14px',
      fontWeight: '400',
      lineHeight: '20px',
    },
    small: {
      fontSize: '12px',
      fontWeight: '400',
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
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  }
};

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({ theme });

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.theme;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default theme;
