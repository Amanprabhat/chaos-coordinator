import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  title: string;
  description: string;
  illustration?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  illustration,
  action 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-12 px-6"
    >
      {illustration && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <img
            src={illustration}
            alt={title}
            className="w-32 h-32 object-contain"
          />
        </motion.div>
      )}
      
      {!illustration && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-6xl mb-4"
        >
          📋
        </motion.div>
      )}
      
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-base font-semibold text-textPrimary text-center mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-sm text-textSecondary text-center mb-6 max-w-md"
      >
        {description}
      </motion.p>
      
      {action && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          onClick={action.onClick}
          className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};

export default EmptyState;
