import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../common/Logo';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      path: '/sales-dashboard'
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: '📁',
      path: '/projects'
    },
    {
      id: 'intake',
      label: 'Intake',
      icon: '📝',
      path: '/sales/intake'
    },
    {
      id: 'handover',
      label: 'Handover',
      icon: '🤝',
      path: '/handover'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📈',
      path: '/analytics'
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-60 bg-surface border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Logo size="md" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50 text-accent border-l-4 border-accent font-semibold'
                      : 'text-textSecondary hover:bg-gray-50 hover:text-textPrimary'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
            <span className="text-sm font-medium text-textPrimary">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-textPrimary truncate">
              {user?.name}
            </p>
            <p className="text-xs text-textTertiary truncate">
              {user?.role}
            </p>
          </div>
        </div>
        <motion.button
          onClick={handleLogout}
          className="w-full px-4 py-2 text-sm text-textSecondary border border-border rounded-lg hover:bg-background transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Logout
        </motion.button>
      </div>
    </div>
  );
};

export default Sidebar;
