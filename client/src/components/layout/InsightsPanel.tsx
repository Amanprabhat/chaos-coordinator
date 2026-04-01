import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Alert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
}

interface Blocker {
  id: number;
  title: string;
  description: string;
  priority: 'critical' | 'warning' | 'info';
}

interface NextAction {
  id: number;
  title: string;
  description: string;
  dueDate: string;
}

const InsightsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'blockers' | 'actions'>('alerts');

  // Mock data with new color coding
  const alerts: Alert[] = [
    {
      id: 1,
      type: 'critical',
      message: 'Project deadline approaching',
      time: '2 hours ago'
    },
    {
      id: 2,
      type: 'warning',
      message: 'Task overdue by 3 days',
      time: '5 hours ago'
    },
    {
      id: 3,
      type: 'info',
      message: 'New handover request received',
      time: '1 day ago'
    }
  ];

  const blockers: Blocker[] = [
    {
      id: 1,
      title: 'API Integration Blocked',
      description: 'Waiting for third-party API access',
      priority: 'critical'
    },
    {
      id: 2,
      title: 'Client Approval Pending',
      description: 'Design mockups awaiting review',
      priority: 'warning'
    }
  ];

  const nextActions: NextAction[] = [
    {
      id: 1,
      title: 'Review SOW Document',
      description: 'Approve Statement of Work for new project',
      dueDate: 'Today'
    },
    {
      id: 2,
      title: 'Update Project Timeline',
      description: 'Adjust milestones based on recent changes',
      dueDate: 'Tomorrow'
    }
  ];

  const getIndicatorColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-danger';
      case 'warning':
        return 'bg-warning';
      case 'info':
        return 'bg-info';
      default:
        return 'bg-textTertiary';
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-4 border-l-danger';
      case 'warning':
        return 'border-l-4 border-l-warning';
      case 'info':
        return 'border-l-4 border-l-info';
      default:
        return 'border-l-4 border-l-textTertiary';
    }
  };

  return (
    <div className="w-80 bg-surface border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-textPrimary">
          Insights
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['alerts', 'blockers', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full ${getIndicatorColor(alert.type)} mt-2`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-textPrimary">
                        {alert.message}
                      </p>
                      <p className="text-xs text-textTertiary mt-1">
                        {alert.time}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'blockers' && (
            <motion.div
              key="blockers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {blockers.map((blocker) => (
                <motion.div
                  key={blocker.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-surface border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 ${getPriorityStyles(blocker.priority)}`}
                >
                  <h4 className="text-sm font-semibold text-textPrimary">
                    {blocker.title}
                  </h4>
                  <p className="text-xs text-textSecondary mt-1">
                    {blocker.description}
                  </p>
                  <div className="flex items-center mt-2">
                    <div className={`w-2 h-2 rounded-full ${getIndicatorColor(blocker.priority)}`} />
                    <span className="text-xs text-textTertiary ml-2 capitalize">
                      {blocker.priority}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'actions' && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {nextActions.map((action) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface border border-border rounded-lg p-3 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200 cursor-pointer"
                >
                  <h4 className="text-sm font-semibold text-textPrimary">
                    {action.title}
                  </h4>
                  <p className="text-xs text-textSecondary mt-1">
                    {action.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-accent font-medium">
                      {action.dueDate}
                    </span>
                    <button className="text-xs text-accent hover:text-accent/80 transition-colors duration-200">
                      View →
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InsightsPanel;
