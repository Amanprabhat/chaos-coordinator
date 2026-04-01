import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';
import StatusBadge from './StatusBadge';

interface AlertCardProps {
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const AlertCard: React.FC<AlertCardProps> = ({
  title,
  description,
  variant = 'info',
  size = 'md',
  dismissible = false,
  onDismiss,
  className = '',
  children,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'bg-success/5',
          border: 'border-success/20',
          icon: 'text-success',
          title: 'text-success',
        };
      case 'warning':
        return {
          bg: 'bg-warning/5',
          border: 'border-warning/20',
          icon: 'text-warning',
          title: 'text-warning',
        };
      case 'danger':
        return {
          bg: 'bg-danger/5',
          border: 'border-danger/20',
          icon: 'text-danger',
          title: 'text-danger',
        };
      case 'info':
      default:
        return {
          bg: 'bg-info/5',
          border: 'border-info/20',
          icon: 'text-info',
          title: 'text-info',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'p-3 text-sm';
      case 'md':
        return 'p-4 text-base';
      case 'lg':
        return 'p-6 text-lg';
      default:
        return 'p-4 text-base';
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'danger':
        return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <motion.div
      className={`
        relative
        bg-surface
        border rounded-lg
        ${variantStyles.bg}
        ${variantStyles.border}
        ${sizeStyles}
        ${className}
      `}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className={`flex-shrink-0 w-5 h-5 rounded-full ${variantStyles.bg} flex items-center justify-center ${variantStyles.icon} text-sm font-bold mr-3`}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${variantStyles.title}`}>
            {title}
          </h4>
          {description && (
            <p className="text-textSecondary mt-1">
              {description}
            </p>
          )}
          {children}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ml-3 text-textTertiary hover:text-textPrimary transition-colors duration-200`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
};

// Insight Card for dashboard insights
interface InsightCardProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  value,
  trend,
  trendValue,
  icon,
  variant = 'default',
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-success/5';
      case 'warning':
        return 'border-warning/20 bg-warning/5';
      case 'danger':
        return 'border-danger/20 bg-danger/5';
      default:
        return 'border-border bg-surface';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <span className="text-success">↑</span>;
      case 'down':
        return <span className="text-danger">↓</span>;
      case 'neutral':
        return <span className="text-textTertiary">→</span>;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className={`
        p-4 rounded-lg border
        ${getVariantStyles()}
        ${className}
      `}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-textSecondary">{title}</p>
          <p className="text-2xl font-bold text-textPrimary mt-1">{value}</p>
          {trend && trendValue && (
            <div className="flex items-center mt-2 text-sm">
              {getTrendIcon()}
              <span className="ml-1 text-textSecondary">{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-textTertiary">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AlertCard;
