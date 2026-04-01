import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/common/Logo';

interface ErrorPageProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ 
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  showBackButton = true 
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md mx-auto px-6"
      >
        <Logo size="lg" className="mb-8" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-textPrimary mb-4">
            {title}
          </h1>
          <p className="text-sm text-textSecondary mb-8">
            {message}
          </p>
          
          {showBackButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Go Back Home
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ErrorPage;
