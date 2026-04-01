import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-success/10 text-success border-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'danger':
        return 'bg-danger/10 text-danger border-danger/20';
      case 'info':
        return 'bg-info/10 text-info border-info/20';
      case 'purple':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'neutral':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'md':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
    }
  };

  const baseStyles = `
    inline-flex items-center justify-center
    font-medium
    border rounded-full
    ${getVariantStyles()}
    ${getSizeStyles()}
    ${className}
  `;

  return (
    <motion.span
      className={baseStyles}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.span>
  );
};

// Preset badge components for common use cases
export const SuccessBadge: React.FC<Omit<StatusBadgeProps, 'variant'>> = (props) => (
  <StatusBadge variant="success" {...props} />
);

export const WarningBadge: React.FC<Omit<StatusBadgeProps, 'variant'>> = (props) => (
  <StatusBadge variant="warning" {...props} />
);

export const DangerBadge: React.FC<Omit<StatusBadgeProps, 'variant'>> = (props) => (
  <StatusBadge variant="danger" {...props} />
);

export const InfoBadge: React.FC<Omit<StatusBadgeProps, 'variant'>> = (props) => (
  <StatusBadge variant="info" {...props} />
);

export default StatusBadge;
