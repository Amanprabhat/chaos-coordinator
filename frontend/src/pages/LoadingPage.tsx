import React from 'react';
import { motion } from 'framer-motion';
import Logo from '../components/common/Logo';

const LoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <Logo size="lg" className="mb-8" />
        
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-textSecondary text-sm">
            Loading Chaos Coordinator...
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingPage;
