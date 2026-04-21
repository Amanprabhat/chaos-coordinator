import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

interface Project {
  id: number;
  name: string;
  client_name: string;
  description?: string;
  status: string;
  project_type?: string;
  owner_id?: number;
  owner_name?: string;
  csm_id?: number;
  csm_name?: string;
  pm_id?: number;
  pm_name?: string;
  product_manager_id?: number;
  product_manager_name?: string;
  deployment_region?: string;
  deployment_type?: string;
  sso_required?: boolean;
  meeting_done?: boolean;
  meeting_date?: string;
  mom_text?: string;
  expected_timeline?: string;
  integrations_required?: string;
  client_spoc_name?: string;
  client_spoc_email?: string;
  client_spoc_mobile?: string;
  stage_name?: string;
  start_date?: string;
  target_go_live_date?: string;
  created_at: string;
  updated_at: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; bar: string }> = {
  INTAKE_CREATED:    { label: 'Intake Created',    bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400',   bar: 'bg-slate-400'   },
  MEETING_SCHEDULED: { label: 'Meeting Scheduled', bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    bar: 'bg-blue-500'    },
  MEETING_COMPLETED: { label: 'Meeting Completed', bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    bar: 'bg-cyan-500'    },
  HANDOVER_PENDING:  { label: 'Handover Pending',  bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   bar: 'bg-amber-400'   },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500',  bar: 'bg-violet-400'  },
  APPROVED:          { label: 'Approved',           bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-400' },
  ACTIVE:            { label: 'Active',             bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500',   bar: 'bg-green-400'   },
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

const FILTER_TABS = [
  { key: 'ALL',              label: 'All' },
  { key: 'INTAKE_CREATED',   label: 'Intake Created' },
  { key: 'AWAITING_APPROVAL',label: 'Awaiting Approval' },
  { key: 'APPROVED',         label: 'Approved' },
  { key: 'ACTIVE',           label: 'Active' },
];

// ── Detail Drawer ──────────────────────────────────────────────────────────────

interface DrawerProps {
  project: Project;
  onClose: () => void;
}

const ProjectDetailDrawer: React.FC<DrawerProps> = ({ project, onClose }) => {
  const fmt = (v?: string | null) => v || '—';
  const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={project.status} />
              {project.project_type && (
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                  {project.project_type}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-2">{project.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{project.client_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* Client & SPOC */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Client Information</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Client Name',        value: fmt(project.client_name) },
                { label: 'Client SPOC',        value: fmt(project.client_spoc_name) },
                { label: 'SPOC Email',         value: fmt(project.client_spoc_email) },
                { label: 'SPOC Mobile',        value: fmt(project.client_spoc_mobile) },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800 text-right ml-4 max-w-xs break-all">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Team</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Sales Owner',        value: fmt(project.owner_name) },
                { label: 'CSM Assigned',       value: fmt(project.csm_name) },
                { label: 'PM Assigned',        value: fmt(project.pm_name) },
                { label: 'Product Manager',    value: fmt(project.product_manager_name) },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Project details */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Project Details</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project Type',       value: fmt(project.project_type) },
                { label: 'Deployment Region',  value: fmt(project.deployment_region) },
                { label: 'Deployment Type',    value: fmt(project.deployment_type) },
                { label: 'SSO Required',       value: project.sso_required ? 'Yes' : 'No' },
                { label: 'Expected Timeline',  value: fmt(project.expected_timeline) },
                { label: 'Stage',              value: fmt(project.stage_name) },
                { label: 'Start Date',         value: fmtDate(project.start_date) },
                { label: 'Target Go-Live',     value: fmtDate(project.target_go_live_date) },
                { label: 'Date Submitted',     value: fmtDate(project.created_at) },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Meeting */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Kickoff Meeting</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Meeting Done',   value: project.meeting_done ? 'Yes ✓' : 'No' },
                { label: 'Meeting Date',   value: fmtDate(project.meeting_date) },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{r.label}</span>
                  <span className={`font-medium ${r.label === 'Meeting Done' && project.meeting_done ? 'text-emerald-600' : 'text-gray-800'}`}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Integrations */}
          {project.integrations_required && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Integrations Required</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700">{project.integrations_required}</p>
              </div>
            </section>
          )}

          {/* MOM */}
          {project.mom_text && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meeting Minutes (MoM)</p>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.mom_text}</p>
              </div>
            </section>
          )}

          {/* SOW placeholder */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Statement of Work (SOW)</p>
            <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3">
              <svg className="w-8 h-8 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-500">SOW document attached</p>
                <p className="text-xs text-gray-400 mt-0.5">File storage integration coming soon</p>
              </div>
            </div>
          </section>

          {/* Description / notes */}
          {project.description && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
            </section>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const AllProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  useEffect(() => {
    fetch('http://localhost:3001/api/projects')
      .then(r => r.json())
      .then(data => setProjects(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isSalesOrAdmin = user?.role === 'Sales' || user?.role === 'Admin';

  // Non-Sales/Admin roles only see projects that have been handed over (post-approval pipeline)
  const visibleProjects = isSalesOrAdmin
    ? projects
    : projects.filter(p => !['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING'].includes(p.status));

  const FILTER_TABS_FOR_ROLE = isSalesOrAdmin
    ? FILTER_TABS
    : FILTER_TABS.filter(t => !['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING'].includes(t.key));

  const filtered = visibleProjects
    .filter(p => activeFilter === 'ALL' || p.status === activeFilter)
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.owner_name ?? '').toLowerCase().includes(q)
      );
    });

  const dashboardPath =
    user?.role === 'CSM'   ? '/csm-dashboard'   :
    user?.role === 'PM'    ? '/pm-dashboard'     :
    user?.role === 'Admin' ? '/admin-dashboard'  :
    '/sales-dashboard';

  const NAV_ITEMS = [
    {
      label: 'Dashboard',
      path: dashboardPath,
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

  return (
    <>
<div className="flex h-screen bg-[#F8F9FC] overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 text-white">
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">Chaos</p>
              <p className="text-sm font-bold text-indigo-400 leading-tight">Coordinator</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
            {NAV_ITEMS.map(item => {
              const active = item.path === '/projects';
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-indigo-600 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

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

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">All Projects</h1>
              <p className="text-sm text-gray-500 mt-0.5">{visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} total</p>
            </div>
            <div className="flex items-center gap-3">
              {user && <div className="bg-slate-800 rounded-lg"><NotificationBell userId={user.id} theme="light" /></div>}
              {isSalesOrAdmin && (
                <div className="relative">
                  <span className="absolute inset-0 rounded-xl bg-indigo-400/30 animate-ping" />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/sales/intake')}
                    className="relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-300/40 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    New Intake
                  </motion.button>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-6">

            {/* Search + filter row */}
            <div className="flex items-center gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, client, owner…"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {FILTER_TABS_FOR_ROLE.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      activeFilter === f.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {f.label}
                    <span className="ml-1.5 text-[10px] opacity-70">
                      {f.key === 'ALL' ? visibleProjects.length : visibleProjects.filter(p => p.status === f.key).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Project grid */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading projects…</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
                <p className="text-sm text-gray-400">No projects found{search ? ` for "${search}"` : ''}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map((project, i) => {
                  const statusCfg = STATUS_CONFIG[project.status] ?? { bar: 'bg-gray-300', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: project.status };
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer overflow-hidden"
                    >
                      {/* Status color bar */}
                      <div className={`h-1 ${statusCfg.bar}`} />

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{project.client_name}</p>
                          </div>
                          <StatusBadge status={project.status} />
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                          {project.project_type && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {project.project_type}
                            </span>
                          )}
                          {project.stage_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {project.stage_name}
                            </span>
                          )}
                        </div>

                        {/* Owner + dates */}
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-[9px] font-bold">
                              {(project.owner_name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span>{project.owner_name ?? 'Unknown'}</span>
                          </div>
                          <span>
                            {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Team pills */}
                        {(project.csm_name || project.pm_name) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                            {project.csm_name && (
                              <span className="text-[11px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
                                CSM: {project.csm_name.split(' ')[0]}
                              </span>
                            )}
                            {project.pm_name && (
                              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                PM: {project.pm_name.split(' ')[0]}
                              </span>
                            )}
                            {project.product_manager_name && (
                              <span className="text-[11px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                Prod: {project.product_manager_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )}

                        {/* View details cue */}
                        <div className="mt-3 flex justify-end">
                          <span className="text-xs text-indigo-500 font-semibold">View details →</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default AllProjectsPage;
