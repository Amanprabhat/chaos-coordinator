import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, Sidebar, CompactSidebar } from '../ui';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  sidebarItems?: Array<{
    id: string;
    label: string;
    href?: string;
    icon?: React.ReactNode;
    badge?: string | number;
    children?: Array<{
      id: string;
      label: string;
      href?: string;
      icon?: React.ReactNode;
    }>;
  }>;
  headerActions?: React.ReactNode;
  collapsibleSidebar?: boolean;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs,
  user,
  sidebarItems = [],
  headerActions,
  collapsibleSidebar = true,
  className = '',
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className={`min-h-screen bg-background flex ${className}`}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          items={sidebarItems}
          collapsed={collapsibleSidebar ? sidebarCollapsed : false}
          onCollapse={collapsibleSidebar ? setSidebarCollapsed : undefined}
          user={user}
        />
      </div>

      {/* Mobile Sidebar */}
      <CompactSidebar
        items={sidebarItems}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          user={user}
          actions={
            <div className="flex items-center space-x-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 text-textSecondary hover:text-textPrimary transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {headerActions}
            </div>
          }
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Simple layout for pages without sidebar
interface SimpleLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  user?: {
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  headerActions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export const SimpleLayout: React.FC<SimpleLayoutProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs,
  user,
  headerActions,
  maxWidth = 'xl',
  className = '',
}) => {
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-2xl';
      case 'md':
        return 'max-w-4xl';
      case 'lg':
        return 'max-w-6xl';
      case 'xl':
        return 'max-w-7xl';
      case 'full':
        return '';
      default:
        return 'max-w-7xl';
    }
  };

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      <Header
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        user={user}
        actions={headerActions}
      />
      
      <main className="flex-1">
        <div className={`mx-auto p-6 ${getMaxWidthClass()}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

// Centered layout for auth pages
interface CenteredLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CenteredLayout: React.FC<CenteredLayoutProps> = ({
  children,
  maxWidth = 'md',
  className = '',
}) => {
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-md';
      case 'md':
        return 'max-w-lg';
      case 'lg':
        return 'max-w-2xl';
      default:
        return 'max-w-lg';
    }
  };

  return (
    <div className={`min-h-screen bg-background flex items-center justify-center p-4 ${className}`}>
      <div className={`w-full ${getMaxWidthClass()}`}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
