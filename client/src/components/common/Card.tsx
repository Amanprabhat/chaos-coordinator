import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  padding = 'md', 
  hover = false,
  onClick 
}) => {
  const theme = useTheme();

  const getPadding = () => {
    switch (padding) {
      case 'sm': return 'p-3';
      case 'md': return 'p-4';
      case 'lg': return 'p-6';
      default: return 'p-4';
    }
  };

  const cardStyles = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.sm,
    cursor: onClick ? 'pointer' : 'default',
    transition: theme.transitions.normal,
  };

  return (
    <motion.div
      className={`${getPadding()} rounded-lg border ${className}`}
      style={{
        ...cardStyles,
        borderColor: theme.colors.border.light,
      }}
      onClick={onClick}
      whileHover={hover ? { 
        scale: 1.02, 
        boxShadow: theme.shadows.lg,
        y: -2
      } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }}
    >
      {children}
    </motion.div>
  );
};

export default Card;
