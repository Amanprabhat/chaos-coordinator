import React from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import InsightsPanel from './InsightsPanel';

interface AppLayoutProps {
  children: React.ReactNode;
  showInsightsPanel?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  showInsightsPanel = true 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-screen bg-background"
    >
      {/* Left Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${showInsightsPanel ? 'border-r border-border' : ''}`}>
        {children}
      </main>
      
      {/* Right Insights Panel */}
      {showInsightsPanel && <InsightsPanel />}
    </motion.div>
  );
};

export default AppLayout;
