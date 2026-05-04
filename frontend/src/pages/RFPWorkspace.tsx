import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppSidebar from '../components/AppSidebar';
import NotificationBell from '../components/NotificationBell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RFP {
  id: number;
  title: string;
  client_name: string;
  client_contact_name?: string;
  client_contact_email?: string;
  estimated_value?: number;
  currency: string;
  submission_deadline?: string;
  status: 'draft' | 'in_progress' | 'under_review' | 'submitted' | 'won' | 'lost';
  owner_name?: string;
  owner_id: number;
  priority: string;
  section_count: number;
  completion_percent: number;
  created_at: string;
}

interface Stats {
  total: number;
  won: number;
  lost: number;
  win_rate: number | null;
  pipeline_value: number;
  deadline_this_week: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft:        { label: 'Draft',        bg: 'bg-stone-100',   text: 'text-stone-600',  dot: 'bg-stone-400' },
  in_progress:  { label: 'In Progress',  bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-500' },
  submitted:    { label: 'Submitted',    bg: 'bg-violet-50',   text: 'text-violet-700', dot: 'bg-violet-500' },
  won:          { label: 'Won',          bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
  lost:         { label: 'Lost',         bg: 'bg-rose-50',     text: 'text-rose-700',   dot: 'bg-rose-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-rose-600 bg-rose-50',
  high:     'text-orange-600 bg-orange-50',
  medium:   'text-amber-600 bg-amber-50',
  low:      'text-stone-500 bg-stone-100',
};

const TABS = ['all', 'draft', 'in_progress', 'under_review', 'submitted', 'won', 'lost'] as const;
const TAB_LABELS: Record<string, string> = {
  all: 'All', draft: 'Draft', in_progress: 'In Progress',
  under_review: 'Under Review', submitted: 'Submitted', won: 'Won', lost: 'Lost',
};

const NAV_ITEMS = (dashPath: string) => [
  { label: 'Dashboard',     path: dashPath,        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { label: 'All Projects',  path: '/projects',     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
  { label: 'RFP Workspace', path: '/rfp',          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { label: 'Analytics',     path: '/analytics',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
];

const ROLE_LABEL: Record<string, string> = {
  Admin: 'Administrator', Sales: 'Sales', CSM: 'Customer Success Manager',
  PM: 'Project Manager', 'Product Manager': 'Product Manager',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value?: number, currency = 'USD') {
  if (!value) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function deadlineColor(days: number | null) {
  if (days === null) return 'text-stone-400';
  if (days < 0)  return 'text-rose-600 font-semibold';
  if (days <= 3) return 'text-rose-600 font-semibold';
  if (days <= 7) return 'text-amber-600 font-semibold';
  return 'text-stone-500';
}

// ─── New RFP Modal ────────────────────────────────────────────────────────────

interface NewRFPModalProps {
  onClose: () => void;
  onCreated: (id: number) => void;
  userId: number;
}

const NewRFPModal: React.FC<NewRFPModalProps> = ({ onClose, onCreated, userId }) => {
  const [form, setForm] = useState({
    title: '', client_name: '', client_contact_name: '', client_contact_email: '',
    estimated_value: '', currency: 'USD', submission_deadline: '',
    decision_expected_date: '', priority: 'medium', description: '', rfp_source: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.client_name.trim()) {
      setError('Title and client name are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null, owner_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create RFP');
      onCreated(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-warm-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">New RFP</h2>
            <p className="text-sm text-stone-400 mt-0.5">Fill in the basics - you can add sections after</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1.5">RFP Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Enterprise CRM Platform for Acme Corp"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Client Name *</label>
              <input value={form.client_name} onChange={e => set('client_name', e.target.value)}
                placeholder="Company name"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Contact Name</label>
              <input value={form.client_contact_name} onChange={e => set('client_contact_name', e.target.value)}
                placeholder="Client SPOC name"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Contact Email</label>
              <input type="email" value={form.client_contact_email} onChange={e => set('client_contact_email', e.target.value)}
                placeholder="spoc@client.com"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Estimated Value</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="w-20 px-2 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-stone-50">
                  <option>USD</option><option>EUR</option><option>GBP</option><option>INR</option>
                </select>
                <input type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Submission Deadline</label>
              <input type="date" value={form.submission_deadline} onChange={e => set('submission_deadline', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Decision Expected</label>
              <input type="date" value={form.decision_expected_date} onChange={e => set('decision_expected_date', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Source / How did this come in?</label>
              <input value={form.rfp_source} onChange={e => set('rfp_source', e.target.value)}
                placeholder="e.g. Inbound email, Partner referral, LinkedIn..."
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1.5">Brief Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="What is this RFP about?"
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-stone-50 resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2">
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              Create RFP
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RFPWorkspace: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();

  const [rfps,         setRfps]         = useState<RFP[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<string>('all');
  const [search,       setSearch]       = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  const dashPath =
    user?.role === 'Admin' ? '/admin-dashboard' :
    user?.role === 'CSM'   ? '/csm-dashboard'   :
    user?.role === 'PM'    ? '/pm-dashboard'    : '/sales-dashboard';

  // Lock body scroll on mobile sidebar open
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [rfpRes, statsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp?user_id=${user.id}&role=${user.role}`),
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/rfp/stats?user_id=${user.id}&role=${user.role}`),
      ]);
      setRfps(await rfpRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const filtered = useMemo(() => {
    let list = rfps;
    if (activeTab !== 'all') list = list.filter(r => r.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.client_name.toLowerCase().includes(q) ||
        (r.owner_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [rfps, activeTab, search]);

  const canCreate = user?.role === 'Sales' || user?.role === 'Admin';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <AppSidebar
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={NAV_ITEMS(dashPath).map(item => ({
          label: item.label, icon: item.icon,
          active: item.path === '/rfp' ? location.pathname.startsWith('/rfp') : location.pathname === item.path,
          onClick: () => { navigate(item.path); setSidebarOpen(false); },
        }))}
        userName={user?.name ?? ''}
        userRole={ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? ''}
        userInitials={initials}
        onLogout={() => { logout(); navigate('/login'); }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b flex-shrink-0 px-4 sm:px-6 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-stone-900">RFP Workspace</h1>
                <p className="text-xs text-stone-400 mt-0.5">Track, collaborate on and win proposals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && <NotificationBell userId={user.id} theme="light" />}
              {canCreate && (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  New RFP
                </motion.button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">

          {/* Stats */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
            >
              {[
                { label: 'Total RFPs',           value: stats.total,                              icon: '📄', color: 'indigo' },
                { label: 'Deadline This Week',    value: stats.deadline_this_week,                 icon: '⏰', color: stats.deadline_this_week > 0 ? 'rose' : 'stone' },
                { label: 'Win Rate',              value: stats.win_rate !== null ? `${stats.win_rate}%` : '-', icon: '🏆', color: 'emerald' },
                { label: 'Pipeline Value',        value: formatCurrency(stats.pipeline_value),     icon: '💰', color: 'violet' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-2xl p-4 border stat-card"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="text-xl mb-2">{s.icon}</div>
                  <p className="text-2xl font-bold text-stone-900">{s.value}</p>
                  <p className="text-xs text-stone-400 mt-1">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Filter tabs + search */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"
          >
            <div className="flex items-center gap-1 bg-white border rounded-xl p-1 overflow-x-auto flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {tab !== 'all' && (
                    <span className={`ml-1.5 text-[10px] ${activeTab === tab ? 'text-indigo-200' : 'text-stone-400'}`}>
                      {rfps.filter(r => r.status === tab).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search RFPs..."
                className="pl-9 pr-4 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 w-64"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </motion.div>

          {/* RFP List */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-stone-600 font-medium">No RFPs found</p>
              <p className="text-stone-400 text-sm mt-1">
                {canCreate ? 'Create your first RFP to get started' : 'No RFPs assigned to you yet'}
              </p>
              {canCreate && (
                <button onClick={() => setShowNewModal(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
                  New RFP
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              className="space-y-3"
            >
              {filtered.map((rfp, idx) => {
                const s        = STATUS_CONFIG[rfp.status];
                const days     = daysUntil(rfp.submission_deadline);
                const dColor   = deadlineColor(days);
                const pColor   = PRIORITY_COLORS[rfp.priority] || PRIORITY_COLORS.medium;

                return (
                  <motion.div
                    key={rfp.id}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    onClick={() => navigate(`/rfp/${rfp.id}`)}
                    className="bg-white border rounded-2xl px-5 py-4 cursor-pointer hover:shadow-warm-md transition-all duration-200 hover:-translate-y-0.5"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Completion ring */}
                      <div className="flex-shrink-0 relative w-12 h-12">
                        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#F5F3EE" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#6366F1" strokeWidth="3"
                            strokeDasharray={`${(rfp.completion_percent / 100) * 94.2} 94.2`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                          {rfp.completion_percent}%
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">{rfp.title}</p>
                            <p className="text-sm text-stone-500 mt-0.5 truncate">{rfp.client_name}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pColor}`}>
                            {rfp.priority.charAt(0).toUpperCase() + rfp.priority.slice(1)}
                          </span>
                          {rfp.estimated_value && (
                            <span className="text-xs text-stone-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {formatCurrency(rfp.estimated_value, rfp.currency)}
                            </span>
                          )}
                          {rfp.submission_deadline && (
                            <span className={`text-xs flex items-center gap-1 ${dColor}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {days === null ? '-' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
                            </span>
                          )}
                          <span className="text-xs text-stone-400">
                            {rfp.section_count} section{rfp.section_count !== 1 ? 's' : ''}
                          </span>
                          {rfp.owner_name && (
                            <span className="text-xs text-stone-400">{rfp.owner_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showNewModal && (
          <NewRFPModal
            onClose={() => setShowNewModal(false)}
            onCreated={id => { setShowNewModal(false); navigate(`/rfp/${id}`); }}
            userId={user?.id ?? 0}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RFPWorkspace;
