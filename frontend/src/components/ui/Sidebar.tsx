import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokens } from '../../theme/tokens';
import Button from './Button';
import StatusBadge from './StatusBadge';

interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: NavItem[];
  isActive?: boolean;
  disabled?: boolean;
}

interface SidebarProps {
  items: NavItem[];
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  logo?: React.ReactNode;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  collapsed = false,
  onCollapse,
  user,
  logo,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href);
  };

  const handleNavigation = (href?: string) => {
    if (href && !href.startsWith('#')) {
      navigate(href);
    }
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    const active = item.href ? isActive(item.href) : item.isActive;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: level * 0.05 }}
        >
          <button
            onClick={() => handleNavigation(item.href)}
            disabled={item.disabled}
            className={`
              w-full flex items-center justify-between
              px-3 py-2 rounded-lg text-left
              transition-all duration-200
              ${active
                ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent'
                : 'text-textSecondary hover:bg-gray-50 hover:text-textPrimary'
              }
              ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:translate-x-1'}
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <div className="flex items-center space-x-3">
              {item.icon && (
                <span className={`flex-shrink-0 ${active ? 'text-accent' : 'text-textTertiary'}`}>
                  {item.icon}
                </span>
              )}
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </div>
            
            {!collapsed && (
              <div className="flex items-center space-x-2">
                {item.badge && (
                  <StatusBadge variant="info" size="sm">
                    {item.badge}
                  </StatusBadge>
                )}
                {hasChildren && (
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${active ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            )}
          </button>
        </motion.div>

        {/* Sub-items */}
        {hasChildren && active && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            className="ml-6 mt-1 space-y-1"
          >
            {item.children?.map(child => renderNavItem(child, level + 1))}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <aside className={`
      bg-surface border-r border-border
      flex flex-col h-full
      transition-all duration-300
      ${collapsed ? 'w-16' : 'w-64'}
      ${className}
    `}>
      {/* Logo/Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && logo}
          {onCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollapse(!collapsed)}
              className={collapsed ? 'mx-auto' : ''}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map(item => renderNavItem(item))}
      </nav>

      {/* User Section */}
      {user && !collapsed && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.name.split(' ').map(n => n[0]).join('').toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-textPrimary truncate">{user.name}</p>
              <p className="text-xs text-textTertiary truncate">{user.role || user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

// Compact sidebar for mobile
interface CompactSidebarProps {
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const CompactSidebar: React.FC<CompactSidebarProps> = ({
  items,
  isOpen,
  onClose,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href || location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className={`
          fixed top-0 left-0 z-50
          w-64 h-full bg-surface border-r border-border
          lg:hidden
          ${className}
        `}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-textPrimary">Menu</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {items.map(item => {
            const active = item.href ? isActive(item.href) : item.isActive;
            
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => {
                  if (item.href) {
                    navigate(item.href);
                    onClose();
                  }
                }}
                className={`
                  w-full flex items-center justify-between
                  px-3 py-2 rounded-lg text-left
                  transition-all duration-200
                  ${active
                    ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent'
                    : 'text-textSecondary hover:bg-gray-50 hover:text-textPrimary'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  {item.icon && (
                    <span className={`flex-shrink-0 ${active ? 'text-accent' : 'text-textTertiary'}`}>
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </div>
                
                {item.badge && (
                  <StatusBadge variant="info" size="sm">
                    {item.badge}
                  </StatusBadge>
                )}
              </motion.button>
            );
          })}
        </nav>
      </motion.aside>
    </>
  );
};

export default Sidebar;
