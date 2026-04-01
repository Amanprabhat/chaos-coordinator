import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  hover = false,
  clickable = false,
  onClick,
}) => {
  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return 'p-0';
      case 'sm':
        return 'p-4';
      case 'md':
        return 'p-6';
      case 'lg':
        return 'p-8';
      default:
        return 'p-6';
    }
  };

  const getShadowStyles = () => {
    switch (shadow) {
      case 'none':
        return 'shadow-none';
      case 'sm':
        return 'shadow-sm';
      case 'md':
        return 'shadow-md';
      case 'lg':
        return 'shadow-lg';
      case 'xl':
        return 'shadow-xl';
      default:
        return 'shadow-md';
    }
  };

  const baseStyles = `
    bg-surface
    border border-border
    rounded-xl
    ${getPaddingStyles()}
    ${getShadowStyles()}
    ${hover || clickable ? 'transition-all duration-200' : ''}
    ${clickable ? 'cursor-pointer' : ''}
    ${className}
  `;

  const MotionComponent = clickable || hover ? motion.div : 'div';
  const motionProps = clickable || hover ? {
    whileHover: { 
      y: -2, 
      shadow: hover ? tokens.shadows.lg : tokens.shadows.md 
    },
    whileTap: clickable ? { scale: 0.98 } : {},
    onClick: clickable ? onClick : undefined,
  } : {};

  return (
    <MotionComponent
      className={baseStyles}
      {...motionProps}
    >
      {children}
    </MotionComponent>
  );
};

// Card sub-components for better structure
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ 
  children, 
  className = '' 
}) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
);

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ 
  children, 
  className = '' 
}) => (
  <div className={className}>
    {children}
  </div>
);

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ 
  children, 
  className = '' 
}) => (
  <div className={`mt-4 pt-4 border-t border-border ${className}`}>
    {children}
  </div>
);

export default Card;
