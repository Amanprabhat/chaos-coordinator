import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';
import Button from './Button';
import StatusBadge from './StatusBadge';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  user,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <header className={`bg-surface border-b border-border ${className}`}>
      <div className="px-6 py-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          {/* Left Side - Breadcrumbs */}
          <div className="flex items-center space-x-2">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <svg className="w-4 h-4 text-textTertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    {crumb.href ? (
                      <a href={crumb.href} className="text-textSecondary hover:text-textPrimary transition-colors duration-200">
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-textPrimary font-medium">{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}
          </div>

          {/* Right Side - User & Actions */}
          <div className="flex items-center space-x-4">
            {actions}
            {user && (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-textPrimary">{user.name}</p>
                  <p className="text-xs text-textSecondary">{user.role || user.email}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-medium">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.name.split(' ').map(n => n[0]).join('').toUpperCase()
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Title Area */}
        <div className="flex items-center justify-between">
          <div>
            {title && (
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-textPrimary"
              >
                {title}
              </motion.h1>
            )}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm text-textSecondary mt-1"
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Compact header variant
interface CompactHeaderProps {
  title: string;
  onMenuToggle?: () => void;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  actions?: React.ReactNode;
  className?: string;
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({
  title,
  onMenuToggle,
  user,
  actions,
  className = '',
}) => {
  return (
    <header className={`bg-surface border-b border-border ${className}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Side */}
          <div className="flex items-center space-x-4">
            {onMenuToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuToggle}
                className="p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            )}
            <h1 className="text-lg font-semibold text-textPrimary">{title}</h1>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            {actions}
            {user && (
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-medium">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.name.split(' ').map(n => n[0]).join('').toUpperCase()
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
