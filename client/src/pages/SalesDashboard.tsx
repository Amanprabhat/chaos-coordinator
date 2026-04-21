import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

interface Project {
  id: number;
  name: string;
  client_name: string;
  status: 'INTAKE_CREATED' | 'MEETING_SCHEDULED' | 'MEETING_COMPLETED' | 'HANDOVER_PENDING' | 'AWAITING_APPROVAL' | 'APPROVED' | 'ACTIVE';
  stage_name?: string;
  owner_name?: string;
  owner_id?: number;
  csm_id?: number;
  pm_id?: number;
  created_at: string;
  updated_at: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  INTAKE_CREATED:    { label: 'Intake Created',    bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400'   },
  MEETING_SCHEDULED: { label: 'Meeting Scheduled', bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  MEETING_COMPLETED: { label: 'Meeting Completed', bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
  HANDOVER_PENDING:  { label: 'Handover Pending',  bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  APPROVED:          { label: 'Approved',           bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  ACTIVE:            { label: 'Active',             bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500'   },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Tour steps ─────────────────────────────────────────────────────────────────

const TOUR_STEPS: Array<{
  id: string;
  title: string;
  description: string;
  position: 'right' | 'left' | 'bottom';
  anchor: string;
}> = [
  {
    id: 'sidebar',
    title: 'Your Navigation Hub',
    description: 'Access all key areas from the sidebar. The pipeline section always shows live counts of what needs your attention.',
    position: 'right',
    anchor: 'sidebar',
  },
  {
    id: 'cta',
    title: 'Start Here Every Time',
    description: 'Every new deal starts with a Sales Intake. Click this button to capture client details, project scope, and requirements.',
    position: 'bottom',
    anchor: 'cta',
  },
  {
    id: 'stats',
    title: 'Pipeline at a Glance',
    description: 'These numbers tell you exactly where your pipeline stands — total projects, active ones, and those awaiting Admin approval.',
    position: 'bottom',
    anchor: 'stats',
  },
  {
    id: 'insights',
    title: 'Action Required',
    description: 'This panel surfaces only what needs your immediate attention — projects where you are the owner that need the next step.',
    position: 'left',
    anchor: 'insights',
  },
];

// ── Sidebar nav ────────────────────────────────────────────────────────────────

const NAV = [
  {
    label: 'Dashboard',
    path: '/sales-dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'All Projects',
    path: '/projects',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

// ── Welcome modal ──────────────────────────────────────────────────────────────

interface WelcomeModalProps {
  name: string;
  onDismiss: () => void;
  onStartTour: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ name, onDismiss, onStartTour }) => {
  const firstName = name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
        <div className="px-8 py-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-indigo-600 mb-1">{greeting},</p>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">{firstName} 👋</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Welcome back to <span className="font-semibold text-gray-700">Chaos Coordinator</span>.
            This is your Sales execution hub — track your pipeline, drive handovers,
            and move projects to approval from one place.
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2.5">
            {[
              { icon: '📋', label: 'Create & track sales intakes' },
              { icon: '📅', label: 'Manage meetings and handovers' },
              { icon: '⚡', label: 'See what needs action right now' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onStartTour}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Show me around
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Let's go
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Tour tooltip ───────────────────────────────────────────────────────────────

interface TourTooltipProps {
  step: typeof TOUR_STEPS[number];
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  step, stepIndex, totalSteps, targetRect, onNext, onPrev, onSkip,
}) => {
  if (!targetRect) return null;

  const TOOLTIP_W = 280;
  const TOOLTIP_H = 160;
  const GAP = 16;

  let top = 0;
  let left = 0;

  switch (step.position) {
    case 'right':
      top  = targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2;
      left = targetRect.right + GAP;
      break;
    case 'left':
      top  = targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2;
      left = targetRect.left - TOOLTIP_W - GAP;
      break;
    case 'bottom':
      top  = targetRect.bottom + GAP;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
      break;
    default:
      top  = targetRect.top - TOOLTIP_H - GAP;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
      break;
  }

  top  = Math.max(12, Math.min(top,  window.innerHeight - TOOLTIP_H - 12));
  left = Math.max(12, Math.min(left, window.innerWidth  - TOOLTIP_W - 12));

  return (
    <>
      <div className="fixed inset-0 z-40 pointer-events-none bg-slate-900/40" />
      {targetRect && (
        <div
          className="fixed z-40 pointer-events-none rounded-2xl ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent"
          style={{
            top:    targetRect.top    - 4,
            left:   targetRect.left   - 4,
            width:  targetRect.width  + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.45)',
          }}
        />
      )}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 bg-white rounded-2xl shadow-2xl p-5"
        style={{ top, left, width: TOOLTIP_W }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === stepIndex ? 'w-5 bg-indigo-500' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Skip tour
          </button>
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1.5">{step.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.description}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={stepIndex === 0}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-0 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {stepIndex === totalSteps - 1 ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </motion.div>
    </>
  );
};

// ── InsightCard ────────────────────────────────────────────────────────────────

interface InsightCardProps {
  type: 'warning' | 'info' | 'danger' | 'neutral';
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

const InsightCard: React.FC<InsightCardProps> = ({ type, title, description, actionLabel, onAction }) => {
  const colors = {
    warning: { border: 'border-l-amber-400',  bg: 'bg-amber-50',  btn: 'text-amber-700 bg-amber-100 hover:bg-amber-200' },
    info:    { border: 'border-l-blue-400',   bg: 'bg-blue-50',   btn: 'text-blue-700 bg-blue-100 hover:bg-blue-200'   },
    danger:  { border: 'border-l-red-400',    bg: 'bg-red-50',    btn: 'text-red-700 bg-red-100 hover:bg-red-200'      },
    neutral: { border: 'border-l-gray-300',   bg: 'bg-gray-50',   btn: 'text-gray-700 bg-gray-100 hover:bg-gray-200'   },
  };
  const c = colors[type];
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`${c.bg} ${c.border} border border-gray-100 border-l-4 rounded-xl p-4`}
    >
      <p className="text-xs font-bold text-gray-800 mb-1">{title}</p>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <button
        onClick={onAction}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${c.btn}`}
      >
        {actionLabel}
      </button>
    </motion.div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const SalesDashboard: React.FC = () => {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const { projects, fetchProjects } = useProjectStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('/sales-dashboard');

  // Welcome + tour state
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive,  setTourActive]  = useState(false);
  const [tourStep,    setTourStep]    = useState(0);
  const [targetRect,  setTargetRect]  = useState<DOMRect | null>(null);

  // Refs for tour targets
  const sidebarRef  = useRef<HTMLElement>(null);
  const ctaRef      = useRef<HTMLDivElement>(null);
  const statsRef    = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLElement>(null);

  const anchorRefs: Record<string, React.RefObject<HTMLElement | HTMLDivElement | null>> = {
    sidebar:  sidebarRef,
    cta:      ctaRef,
    stats:    statsRef,
    insights: insightsRef,
  };

  useEffect(() => {
    const seen = sessionStorage.getItem('cc_welcome_shown');
    if (!seen) setShowWelcome(true);
  }, []);

  useEffect(() => {
    fetchProjects()
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [fetchProjects]);

  useEffect(() => {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourStep];
    const ref  = anchorRefs[step.anchor];
    if (ref?.current) {
      setTargetRect(ref.current.getBoundingClientRect());
    }
  }, [tourStep, tourActive]); // eslint-disable-line

  const handleDismissWelcome = () => {
    sessionStorage.setItem('cc_welcome_shown', '1');
    setShowWelcome(false);
  };

  const handleStartTour = () => {
    sessionStorage.setItem('cc_welcome_shown', '1');
    setShowWelcome(false);
    setTourStep(0);
    setTourActive(true);
  };

  const handleTourNext = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(s => s + 1);
    } else {
      setTourActive(false);
    }
  };

  const handleTourPrev = () => { if (tourStep > 0) setTourStep(s => s - 1); };
  const handleSkipTour = () => setTourActive(false);

  // Stats — only relevant ones for Sales
  const stats = {
    total:            (projects as Project[]).length,
    inProgress:       (projects as Project[]).filter(p => ['INTAKE_CREATED','MEETING_SCHEDULED','MEETING_COMPLETED','HANDOVER_PENDING'].includes(p.status)).length,
    awaitingApproval: (projects as Project[]).filter(p => p.status === 'AWAITING_APPROVAL').length,
  };

  // User-specific action items (only projects where this user is owner)
  const myProjects     = (projects as Project[]).filter(p => p.owner_id === user?.id);
  const needsAction    = myProjects.filter(p =>
    ['INTAKE_CREATED','MEETING_COMPLETED','HANDOVER_PENDING'].includes(p.status)
  );
  const myAwaitingApproval = myProjects.filter(p => p.status === 'AWAITING_APPROVAL');

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  const WORKFLOW_STEPS = [
    { step: '1', label: 'Create Intake',       sublabel: 'Capture requirements',  color: 'from-indigo-500 to-indigo-600',  ring: 'ring-indigo-200'  },
    { step: '2', label: 'Schedule Meeting',    sublabel: 'Internal kickoff',       color: 'from-blue-500 to-blue-600',     ring: 'ring-blue-200'    },
    { step: '3', label: 'Submit Handover',     sublabel: 'MoM + SOW docs',         color: 'from-amber-500 to-amber-600',   ring: 'ring-amber-200'   },
    { step: '4', label: 'Awaiting Approval',   sublabel: 'Admin reviews & decides',  color: 'from-violet-500 to-violet-600', ring: 'ring-violet-200'  },
  ];

  return (
    <>
      {/* ── WELCOME MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeModal
            name={user?.name ?? 'there'}
            onDismiss={handleDismissWelcome}
            onStartTour={handleStartTour}
          />
        )}
      </AnimatePresence>

      {/* ── TOUR TOOLTIP ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {tourActive && (
          <TourTooltip
            step={TOUR_STEPS[tourStep]}
            stepIndex={tourStep}
            totalSteps={TOUR_STEPS.length}
            targetRect={targetRect}
            onNext={handleTourNext}
            onPrev={handleTourPrev}
            onSkip={handleSkipTour}
          />
        )}
      </AnimatePresence>

      <div className="flex h-screen bg-[#F8F9FC] overflow-hidden">

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside ref={sidebarRef} className="w-64 flex-shrink-0 flex flex-col bg-slate-900 text-white relative z-30">

          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">Chaos</p>
              <p className="text-sm font-bold text-indigo-400 leading-tight">Coordinator</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
            {NAV.map(item => {
              const active = activeNav === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { setActiveNav(item.path); navigate(item.path); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/40'
                      : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}

            {/* Replay tour */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => { setTourStep(0); setTourActive(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-white/30 hover:text-white/70 hover:bg-white/10 rounded-lg text-xs font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Replay tour
              </button>
            </div>
          </nav>

          {/* User profile */}
          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'User'}</p>
                <p className="text-xs text-white/50">{user?.role ?? 'Sales'}</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Sign out"
                className="p-1.5 text-white/30 hover:text-red-400 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sales Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Highlighted CTA button with pulsing ring */}
            <div ref={ctaRef} className="relative">
              <span className="absolute inset-0 rounded-xl bg-indigo-400/30 animate-ping" />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/sales/intake')}
                className="relative flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-300/40 transition-all z-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Start New Intake
              </motion.button>
            </div>
            {user?.id && (
              <div className="bg-slate-800 rounded-lg ml-2">
                <NotificationBell userId={user.id} />
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-6">

            {/* Stats row — 3 cards, no Handover Pending */}
            <div ref={statsRef} className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total Projects',    value: stats.total,            color: 'text-gray-900',   sub: 'all time',            icon: '📁' },
                { label: 'In Progress',       value: stats.inProgress,       color: 'text-blue-600',   sub: 'active pipeline',     icon: '⚡' },
                { label: 'Awaiting Approval', value: stats.awaitingApproval, color: 'text-violet-600', sub: 'pending Admin decision', icon: '⏳' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm relative z-20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                    <span className="text-lg">{s.icon}</span>
                  </div>
                  <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Workflow Guide — centered in main area */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Sales Workflow</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Every project follows these four stages</p>
                </div>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">4-Step Process</span>
              </div>

              {/* Horizontal stepper */}
              <div className="flex items-start gap-0">
                {WORKFLOW_STEPS.map((item, i) => (
                  <React.Fragment key={item.step}>
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} ring-4 ${item.ring} flex items-center justify-center text-white text-sm font-extrabold shadow-sm mb-3`}>
                        {item.step}
                      </div>
                      <p className="text-xs font-bold text-gray-800 text-center leading-tight">{item.label}</p>
                      <p className="text-[11px] text-gray-400 text-center mt-1 leading-tight">{item.sublabel}</p>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div className="flex items-center mt-5 mx-1 flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Bottom CTA */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">Ready to start? Create your first intake and kick off the workflow.</p>
                <button
                  onClick={() => navigate('/sales/intake')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap ml-4"
                >
                  Start Intake →
                </button>
              </div>
            </motion.div>

            {/* Loading skeleton */}
            {isLoading && (
              <div className="mt-6 flex items-center justify-center py-8 text-gray-400 text-sm">
                Loading your pipeline…
              </div>
            )}

          </div>
        </main>

        {/* ── RIGHT ACTION PANEL ────────────────────────────────────────────── */}
        <aside ref={insightsRef} className="w-72 flex-shrink-0 flex flex-col bg-white border-l border-gray-100 overflow-hidden relative z-30">

          {/* Header with two sections */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Action Required</h2>
            <p className="text-xs text-gray-400 mt-0.5">Your projects needing attention</p>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── Section 1: My actions ───────────────────────────── */}
            <div className="px-4 pt-4 pb-2 space-y-2.5">
              {needsAction.map(p => {
                const action = getActionForStatus(p.status);
                if (!action) return null;
                return (
                  <InsightCard
                    key={p.id}
                    type={action.type}
                    title={action.title}
                    description={`${p.name} · ${p.client_name}`}
                    actionLabel={action.label}
                    onAction={() => navigate(`/project/${p.id}`)}
                  />
                );
              })}

              {myAwaitingApproval.length > 0 && (
                <InsightCard
                  type="info"
                  title={`${myAwaitingApproval.length} project${myAwaitingApproval.length > 1 ? 's' : ''} pending Admin approval`}
                  description="Submitted for approval — no action needed from you"
                  actionLabel="View"
                  onAction={() => navigate('/projects')}
                />
              )}

              {needsAction.length === 0 && myAwaitingApproval.length === 0 && !isLoading && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 rounded-xl">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-emerald-700 font-medium">All caught up — no actions needed</p>
                </div>
              )}
            </div>

            {/* ── Section 2: Pipeline pending (all projects, who's blocking) ── */}
            <div className="px-4 pt-3 pb-4 border-t border-gray-100 mt-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Pipeline — Pending on
              </p>

              {!isLoading && (projects as Project[]).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No projects in pipeline yet</p>
              )}

              <div className="space-y-2">
                {(projects as Project[])
                  .filter(p => !['APPROVED', 'ACTIVE', 'cancelled'].includes(p.status))
                  .map(p => {
                    const pending = getPendingOn(p.status, p.owner_name, p);
                    if (!pending) return null;
                    const isMe = p.owner_id === user?.id;
                    return (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => navigate(`/project/${p.id}`)}
                        className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                      >
                        {/* Dot */}
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${pending.dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{p.name}</p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{p.client_name}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pending.badgeClass}`}>
                              {pending.waitingOn}
                            </span>
                            {isMe && (
                              <span className="text-[10px] text-indigo-500 font-medium">· yours</span>
                            )}
                          </div>
                        </div>
                        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.button>
                    );
                  })}
              </div>
            </div>

          </div>
        </aside>

      </div>
    </>
  );
};

// ── helpers ────────────────────────────────────────────────────────────────────

interface PendingInfo {
  waitingOn: string;
  dotColor: string;
  badgeClass: string;
}

function getPendingOn(status: string, ownerName?: string, project?: Project): PendingInfo | null {
  const owner = ownerName ?? 'Sales';
  const csm   = (project as any)?.csm_name  ?? 'CSM';
  const pm    = (project as any)?.pm_name   ?? 'PM';

  switch (status) {
    case 'INTAKE_CREATED':
      return { waitingOn: `Sales · ${owner}`, dotColor: 'bg-slate-400', badgeClass: 'bg-slate-50 text-slate-600 border-slate-200' };
    case 'MEETING_SCHEDULED':
      return { waitingOn: `Sales · ${owner}`, dotColor: 'bg-blue-400', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'MEETING_COMPLETED':
      return { waitingOn: `Sales · ${owner}`, dotColor: 'bg-cyan-400', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'HANDOVER_PENDING':
      return { waitingOn: `Sales · ${owner}`, dotColor: 'bg-amber-400', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'AWAITING_APPROVAL':
      return { waitingOn: 'Admin', dotColor: 'bg-violet-400', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' };
    case 'APPROVED':
      return { waitingOn: `CSM · ${csm}`, dotColor: 'bg-emerald-400', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    default:
      return null;
  }
}

function getActionForStatus(status: string): { type: 'warning' | 'info' | 'danger' | 'neutral'; title: string; label: string } | null {
  switch (status) {
    case 'INTAKE_CREATED':
      return { type: 'neutral',  title: 'Schedule kickoff meeting',   label: 'View Project'      };
    case 'MEETING_COMPLETED':
      return { type: 'warning',  title: 'Ready to submit handover',   label: 'Submit Handover'   };
    case 'HANDOVER_PENDING':
      return { type: 'danger',   title: 'Handover pending — action!', label: 'Complete Handover' };
    default:
      return null;
  }
}

export default SalesDashboard;
