import React from 'react';
import { motion } from 'framer-motion';

export interface SidebarSubItem {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

export interface SidebarNavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  children?: SidebarSubItem[];
}

interface AppSidebarProps {
  sidebarRef?: React.RefObject<HTMLElement | null>;
  sidebarOpen: boolean;
  onClose: () => void;
  navItems: SidebarNavItem[];
  userName: string;
  userRole: string;
  userInitials: string;
  onLogout: () => void;
  onTourReplay?: () => void;
  extraContent?: React.ReactNode;
  extraActions?: React.ReactNode;
}

const navContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const navItem = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
};

const AppSidebar: React.FC<AppSidebarProps> = ({
  sidebarRef,
  sidebarOpen,
  onClose,
  navItems,
  userName,
  userRole,
  userInitials,
  onLogout,
  onTourReplay,
  extraContent,
  extraActions,
}) => {
  return (
    <aside
      ref={sidebarRef as React.RefObject<HTMLDivElement>}
      className={`sidebar-drawer fixed inset-y-0 left-0 z-30 w-72 flex flex-col
        lg:relative lg:translate-x-0 lg:w-64 lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        border-r`}
      style={{ background: 'var(--color-sidebar)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-center justify-between px-5 pt-6 pb-5 flex-shrink-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 shadow-warm-sm">
            <img
              src="/logo192.png"
              alt="Chaos Coordinator"
              className="w-7 h-7 rounded-lg object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--color-text-1)' }}>
              Chaos Coordinator
            </p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-3)' }}>Project OS</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="lg:hidden flex-shrink-0 p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--color-text-3)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </motion.div>

      {/* Navigation */}
      <motion.nav
        className="flex-1 px-3 pb-4 overflow-y-auto space-y-0.5"
        variants={navContainer}
        initial="hidden"
        animate="show"
      >
        {navItems.map((item, idx) => (
          <motion.div key={idx} variants={navItem}>
            <button
              onClick={item.onClick}
              aria-current={item.active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                item.active
                  ? 'bg-indigo-50 text-indigo-700 shadow-warm-sm'
                  : 'hover:bg-white/70'
              }`}
              style={!item.active ? { color: 'var(--color-text-2)' } : undefined}
            >
              <span className={`flex-shrink-0 transition-colors ${item.active ? 'text-indigo-600' : 'text-stone-400 group-hover:text-stone-600'}`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex-shrink-0 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                >
                  {item.badge}
                </motion.span>
              )}
              {item.children && item.children.length > 0 && (
                <motion.svg
                  animate={{ rotate: item.active ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={`w-3 h-3 flex-shrink-0 ${item.active ? 'text-indigo-500' : 'text-stone-300'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              )}
            </button>

            {/* Inline sub-items */}
            {item.active && item.children && item.children.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="ml-4 pl-3 mt-0.5 mb-1 space-y-0.5 overflow-hidden"
                style={{ borderLeft: '2px solid var(--color-border)' }}
              >
                {item.children.map((child, ci) => (
                  <motion.button
                    key={child.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: ci * 0.05, duration: 0.18 }}
                    onClick={child.onClick}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      child.active
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'hover:bg-white/60'
                    }`}
                    style={!child.active ? { color: 'var(--color-text-3)' } : undefined}
                  >
                    {child.label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        ))}

        {extraContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4"
          >
            {extraContent}
          </motion.div>
        )}

        {onTourReplay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-4"
          >
            <button
              onClick={onTourReplay}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/60"
              style={{ color: 'var(--color-text-3)' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Replay tour
            </button>
          </motion.div>
        )}
      </motion.nav>

      {/* User section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="flex-shrink-0 px-3 py-4"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
      >
        <div
          className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors cursor-default hover:bg-white/50"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-warm-sm">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--color-text-1)' }}>{userName}</p>
            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-3)' }}>{userRole}</p>
          </div>
          {extraActions}
          <button
            onClick={onLogout}
            aria-label="Sign out"
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:text-rose-500"
            title="Sign out"
            style={{ color: 'var(--color-text-3)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </motion.div>
    </aside>
  );
};

export default AppSidebar;
