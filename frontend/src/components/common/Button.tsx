import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeProvider';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button'
}) => {
  const theme = useTheme();

  const getStyles = () => {
    const baseStyles = {
      fontFamily: theme.typography.fontFamily,
      fontWeight: '500',
      borderRadius: theme.borderRadius.md,
      transition: theme.transitions.normal,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.6 : 1,
      border: 'none',
      outline: 'none',
      position: 'relative' as const,
      overflow: 'hidden'
    };

    const sizeStyles = {
      sm: {
        padding: '6px 12px',
        fontSize: theme.typography.small.fontSize,
        lineHeight: theme.typography.small.lineHeight,
      },
      md: {
        padding: '8px 16px',
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
      },
      lg: {
        padding: '12px 24px',
        fontSize: '16px',
        lineHeight: '22px',
      }
    };

    const variantStyles = {
      primary: {
        backgroundColor: theme.colors.primary,
        color: theme.colors.surface,
        boxShadow: theme.shadows.sm,
      },
      secondary: {
        backgroundColor: theme.colors.text.secondary,
        color: theme.colors.surface,
        boxShadow: theme.shadows.sm,
      },
      outline: {
        backgroundColor: 'transparent',
        color: theme.colors.primary,
        border: `1px solid ${theme.colors.primary}`,
        boxShadow: 'none',
      }
    };

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const styles = getStyles();

  return (
    <motion.button
      type={type}
      className={className}
      style={styles}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {loading ? (
        <span className="flex items-center">
          <motion.svg 
            className="animate-spin -ml-1 mr-2 h-4 w-4" 
            fill="none" 
            viewBox="0 0 24 24"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </motion.svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;
