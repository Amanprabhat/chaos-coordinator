import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-accent text-white border-transparent hover:bg-indigo-700 focus:ring-2 focus:ring-accent/20';
      case 'secondary':
        return 'bg-surface text-textPrimary border border-border hover:bg-gray-50 focus:ring-2 focus:ring-accent/20';
      case 'danger':
        return 'bg-danger text-white border-transparent hover:bg-red-600 focus:ring-2 focus:ring-danger/20';
      case 'ghost':
        return 'bg-transparent text-textSecondary border border-transparent hover:bg-gray-100 hover:text-textPrimary focus:ring-2 focus:ring-accent/20';
      default:
        return 'bg-accent text-white border-transparent hover:bg-indigo-700';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-8 px-4 text-sm';
      case 'md':
        return 'h-10 px-6 text-base';
      case 'lg':
        return 'h-12 px-8 text-lg';
      default:
        return 'h-10 px-6 text-base';
    }
  };

  const baseStyles = `
    inline-flex items-center justify-center
    font-medium
    rounded-lg
    transition-all duration-200
    focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    ${getVariantStyles()}
    ${getSizeStyles()}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  return (
    <motion.button
      className={baseStyles}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ duration: 0.15 }}
      {...(props as any)}
    >
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
      
      {!loading && leftIcon && (
        <span className="mr-2">{leftIcon}</span>
      )}
      
      <span>{children}</span>
      
      {!loading && rightIcon && (
        <span className="ml-2">{rightIcon}</span>
      )}
    </motion.button>
  );
};

export default Button;
