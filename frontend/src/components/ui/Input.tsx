import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helperText,
    variant = 'default',
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth = false,
    className = '',
    ...props
  }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case 'filled':
          return 'bg-gray-50 border-transparent focus:bg-white focus:border-accent';
        default:
          return 'bg-surface border-border focus:border-accent';
      }
    };

    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return 'h-10 text-sm px-3';
        case 'md':
          return 'h-12 text-base px-4';
        case 'lg':
          return 'h-14 text-lg px-5';
        default:
          return 'h-12 text-base px-4';
      }
    };

    const getBorderColor = () => {
      if (error) return 'border-danger focus:ring-danger/20';
      return 'border-border focus:border-accent focus:ring-accent/20';
    };

    const baseInputStyles = `
      flex-1
      border rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2
      placeholder:text-textTertiary
      ${getVariantStyles()}
      ${getSizeStyles()}
      ${getBorderColor()}
      ${fullWidth ? 'w-full' : ''}
      ${leftIcon ? 'pl-10' : ''}
      ${rightIcon ? 'pr-10' : ''}
      ${className}
    `;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className={`block text-sm font-medium text-textPrimary mb-2`}>
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textTertiary">
              {leftIcon}
            </div>
          )}
          
          <motion.input
            ref={ref}
            className={baseInputStyles}
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
            {...(props as any)}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-textTertiary">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
        
        {helperText && !error && (
          <p className="mt-2 text-sm text-textTertiary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
