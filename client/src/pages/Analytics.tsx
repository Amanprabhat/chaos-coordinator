/**
 * Analytics.tsx — role-scoped analytics for all roles
 * Layout: dark sidebar + main content area (matches CSMDashboard style)
 * Features: rich filter panel, 5 content tabs, workload, pipeline funnel
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  period: number;
  scopedRole: string;
  totalProjects: number;
  projectsByStatus: { status: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  wbsTasksByStatus: { status: string; count: number }[];
  overdueTasks: number;
  blockedTasks: number;
  wbsOverdueCount: number;
  wbsBlockedCount: number;
  wbsBlockedTaskList: { projectId: number; projectName: string; clientName: string; taskName: string; wbs: string; ownerRole: string; plannedEnd: string | null }[];
  wbsOverdueTaskList: { projectId: number; projectName: string; clientName: string; taskName: string; wbs: string; ownerRole: string; plannedEnd: string; status: string }[];
  recentActivity: { action: string; count: number }[];
  weeklyActivityTrend: { week: string; label: string; count: number }[];
  milestoneStats: { status: string; count: number }[];
  goLiveThisMonth: number;
  activeProjects: number;
  myTasksByStatus: { status: string; count: number }[];
  byType: { project_type: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  upcomingGoLive: { id: number; name: string; client_name: string; go_live_deadline: string; priority?: string; status: string }[];
  atRiskProjects: { id: number; name: string; client_name: string; overdue: number; blocked: number; total: number; done: number; pct: number }[];
  projectHealth: { id: number; name: string; client_name: string; pct: number; done: number; total: number; status: string }[];
  createdThisPeriod: number;
  avgProjectAgeDays: number;
  topClients: { client_name: string; count: number }[];
  stageVelocity: number;
  csmWorkload: { name: string; total: number; active_count: number }[];
  pmWorkload: { name: string; total: number; active_count: number }[];
}

interface AuditLog {
  id: number;
  project_id?: number;
  action: string;
  details: any;
  created_at: string;
  project_name?: string;
  client_name?: string;
  project_status?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  INTAKE_CREATED:    { label: 'Intake Created',    color: 'text-slate-700',   bg: 'bg-slate-100',   bar: '#94a3b8' },
  MEETING_SCHEDULED: { label: 'Meeting Scheduled', color: 'text-blue-700',    bg: 'bg-blue-100',    bar: '#3b82f6' },
  MEETING_COMPLETED: { label: 'Meeting Completed', color: 'text-cyan-700',    bg: 'bg-cyan-100',    bar: '#06b6d4' },
  HANDOVER_PENDING:  { label: 'Handover Pending',  color: 'text-amber-700',   bg: 'bg-amber-100',   bar: '#f59e0b' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', color: 'text-violet-700',  bg: 'bg-violet-100',  bar: '#8b5cf6' },
  APPROVED:          { label: 'Approved',           color: 'text-emerald-700', bg: 'bg-emerald-100', bar: '#10b981' },
  ACTIVE:            { label: 'Active',             color: 'text-green-700',   bg: 'bg-green-100',   bar: '#22c55e' },
  cancelled:         { label: 'Cancelled',          color: 'text-red-700',     bg: 'bg-red-100',     bar: '#ef4444' },
  completed:         { label: 'Completed',          color: 'text-emerald-700', bg: 'bg-emerald-100', bar: '#10b981' },
  in_progress:       { label: 'In Progress',        color: 'text-blue-700',    bg: 'bg-blue-100',    bar: '#3b82f6' },
  todo:              { label: 'To Do',              color: 'text-gray-600',    bg: 'bg-gray-100',    bar: '#9ca3af' },
  blocked:           { label: 'Blocked',            color: 'text-red-700',     bg: 'bg-red-100',     bar: '#ef4444' },
  not_started:       { label: 'Not Started',        color: 'text-gray-500',    bg: 'bg-gray-50',     bar: '#d1d5db' },
  pending:           { label: 'Pending',            color: 'text-amber-700',   bg: 'bg-amber-100',   bar: '#f59e0b' },
};

const PRIORITY_META: Record<string, { color: string; bg: string; dot: string }> = {
  Critical: { color: 'text-red-700',    bg: 'bg-red-50',    dot: '#ef4444' },
  High:     { color: 'text-orange-700', bg: 'bg-orange-50', dot: '#f97316' },
  Medium:   { color: 'text-amber-700',  bg: 'bg-amber-50',  dot: '#f59e0b' },
  Low:      { color: 'text-green-700',  bg: 'bg-green-50',  dot: '#22c55e' },
};

const PIPELINE_ORDER = [
  'INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED',
  'HANDOVER_PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'ACTIVE',
];

const STAGE_DESC: Record<string, string> = {
  INTAKE_CREATED:    'Initial intake form submitted by the sales team. Project is being evaluated.',
  MEETING_SCHEDULED: 'Discovery meeting with the client has been scheduled.',
  MEETING_COMPLETED: 'Discovery meeting done — awaiting CSM handover.',
  HANDOVER_PENDING:  'Sales-to-CSM handover is in progress.',
  AWAITING_APPROVAL: 'Project details are finalized and waiting for admin sign-off.',
  APPROVED:          'Admin approved — project is being set up for delivery.',
  ACTIVE:            'Project is actively in the delivery / execution phase.',
  completed:         'Project has been successfully delivered and closed.',
  cancelled:         'Project was cancelled before completion.',
};

// Statuses visible per role in the filter dropdown
const ROLE_STATUSES: Record<string, string[]> = {
  Sales:  ['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING', 'AWAITING_APPROVAL', 'APPROVED'],
  CSM:    ['AWAITING_APPROVAL', 'APPROVED', 'ACTIVE', 'completed', 'cancelled'],
  PM:     ['AWAITING_APPROVAL', 'APPROVED', 'ACTIVE', 'completed', 'cancelled'],
  Admin:  ['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'ACTIVE', 'completed', 'cancelled'],
};

const ACTION_LABELS: Record<string, string> = {
  start_date_changed:       'Start Date Changed',
  stage_transition:         'Stage Transition',
  wbs_plan_saved:           'WBS Plan Saved',
  wbs_task_status_changed:  'WBS Task Status Changed',
  project_approved:         'Project Approved',
  project_rejected:         'Project Rejected',
  handover_initiated:       'Handover Initiated',
  milestone_completed:      'Milestone Completed',
  plan_generated:           'Plan Generated',
  task_status_updated:      'Task Status Updated',
};

// ─── Mini components ──────────────────────────────────────────────────────────

function Pill({ label, meta }: { label: string; meta?: { color: string; bg: string } }) {
  const m = meta || { color: 'text-gray-600', bg: 'bg-gray-100' };
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${m.bg} ${m.color}`}>{label}</span>
  );
}

function HorizBar({ label, count, total, barColor, badge }: {
  label: string; count: number; total: number; barColor: string; badge?: React.ReactNode;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {badge || <span className="text-xs text-gray-700 font-medium truncate">{label}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs font-bold text-gray-700">{count}</span>
          <span className="text-[10px] text-gray-400 w-7 text-right">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function DonutRing({ segments, size = 110 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return <div style={{ width: size, height: size }} className="flex items-center justify-center text-xs text-gray-300">No data</div>;
  const r = (size - 20) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.filter(s => s.value > 0).map((s, i) => {
        const dash = (s.value / total) * C;
        const slice = { dash, offset: cumulative };
        cumulative += dash;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={14}
            strokeDasharray={`${slice.dash} ${C - slice.dash}`}
            strokeDashoffset={-slice.offset}
          />
        );
      })}
    </svg>
  );
}

function ProgressCircle({ pct, size = 48, stroke = 5, color = '#6366f1' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(pct/100)*C} ${C}`} strokeLinecap="round" />
    </svg>
  );
}

function Tooltip({ content, children, width = 300 }: { content: React.ReactNode; children: React.ReactNode; width?: number }) {
  const [pos, setPos] = useState<{ anchorTop: number; anchorBottom: number; left: number; above: boolean } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (!anchorRef.current || !content) return;
    const r = anchorRef.current.getBoundingClientRect();
    const above = r.top > 280;
    const left  = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), window.innerWidth - width - 8);
    setPos({ anchorTop: r.top, anchorBottom: r.bottom, left, above });
  };
  const hide = () => setPos(null);

  return (
    <div ref={anchorRef} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos && content && createPortal(
        <div className="fixed z-[9999] pointer-events-none" style={{ width, left: pos.left,
          ...(pos.above
            ? { top: pos.anchorTop - 8, transform: 'translateY(-100%)' }
            : { top: pos.anchorBottom + 8 })
        }}>
          {/* Tooltip box */}
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-3.5 text-xs border border-white/5">
            {content}
          </div>
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            ...(pos.above
              ? { bottom: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #111827' }
              : { top: -6,    borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #111827' }),
            left: Math.min(Math.max(width / 2 - 6, 12), width - 24),
            width: 0, height: 0,
          }} />
        </div>,
        document.body
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'text-gray-900', icon, alert, tooltip }: {
  label: string; value: string | number; sub?: string; color?: string;
  icon: React.ReactNode; alert?: boolean; tooltip?: React.ReactNode;
}) {
  const card = (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm cursor-default ${alert ? 'border-red-200 bg-red-50/30' : 'border-gray-100'} ${tooltip ? 'hover:border-indigo-200 hover:shadow-md transition-all' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
        <div className="flex items-center gap-1.5">
          {tooltip && <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${alert ? 'bg-red-100' : 'bg-gray-50'}`}>{icon}</div>
        </div>
      </div>
      <p className={`text-3xl font-black ${color} leading-none`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-2">{sub}</p>}
    </div>
  );
  return tooltip ? <Tooltip content={tooltip}>{card}</Tooltip> : card;
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-300">
      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-xs">{text}</p>
    </div>
  );
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDateTime(d: string) {
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function fmtDate(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'Admin';
  const isCSM   = user?.role === 'CSM';
  const isPM    = user?.role === 'PM';
  const isSales = user?.role === 'Sales';

  const backPath = isAdmin ? '/admin-dashboard' : isCSM ? '/csm-dashboard' : isPM ? '/pm-dashboard' : '/sales-dashboard';

  const ROLE_LABEL: Record<string, string> = {
    Admin:            'Administrator',
    CSM:              'Customer Success Manager',
    PM:               'Project Manager',
    'Product Manager':'Product Manager',
    Sales:            'Sales',
    Client:           'Client',
  };
  const initials = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // ── State ──────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab]   = useState<'overview' | 'projects' | 'tasks' | 'activity' | 'audit' | 'cr_pipeline'>('overview');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [period, setPeriod]               = useState('30');
  const [showFilters, setShowFilters]     = useState(false);
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterClient, setFilterClient]   = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('');
  const [filterCreatedTo, setFilterCreatedTo]     = useState('');
  const [filterGoLiveFrom, setFilterGoLiveFrom]   = useState('');
  const [filterGoLiveTo, setFilterGoLiveTo]       = useState('');
  const [quickFilter, setQuickFilter]     = useState('');
  const [clientList, setClientList]       = useState<string[]>([]);

  // Audit sub-filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom]     = useState('');
  const [auditTo, setAuditTo]         = useState('');

  // ── CR Pipeline analytics ──────────────────────────────────────────────────
  const [crStats, setCrStats] = useState<any | null>(null);
  const [crStatsLoading, setCrStatsLoading] = useState(false);

  const fetchCrStats = useCallback(async () => {
    setCrStatsLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/cr-analytics`);
      if (res.ok) setCrStats(await res.json());
    } catch { /* silent */ }
    finally { setCrStatsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'cr_pipeline') fetchCrStats();
  }, [tab, fetchCrStats]);

  const lastFetch = useRef(0);

  const activeFilterCount =
    (filterStatus ? 1 : 0) + (filterPriority ? 1 : 0) +
    (filterType ? 1 : 0) + (filterClient ? 1 : 0) +
    (filterCreatedFrom || filterCreatedTo ? 1 : 0) +
    (filterGoLiveFrom || filterGoLiveTo ? 1 : 0);

  // ── Build query ────────────────────────────────────────────────────────────
  const buildScope = useCallback(() => {
    const p = new URLSearchParams({ period: period === '9999' ? '36500' : period });
    if (!isAdmin && user) {
      p.set('user_role', user.role);
      p.set('user_id', String(user.id));
      if (isCSM)   p.set('csm_id', String(user.id));
      if (isPM)    p.set('pm_id', String(user.id));
      if (isSales) p.set('owner_id', String(user.id));
    } else {
      p.set('user_role', 'Admin');
    }
    if (filterStatus)   p.set('status', filterStatus);
    if (filterPriority) p.set('priority', filterPriority);
    if (filterType)            p.set('project_type', filterType);
    if (filterClient.trim())   p.set('client', filterClient.trim());
    if (filterCreatedFrom)     p.set('created_from', filterCreatedFrom);
    if (filterCreatedTo)       p.set('created_to', filterCreatedTo);
    if (filterGoLiveFrom)      p.set('go_live_from', filterGoLiveFrom);
    if (filterGoLiveTo)        p.set('go_live_to', filterGoLiveTo);
    return p.toString();
  }, [period, user, isAdmin, isCSM, isPM, isSales,
      filterStatus, filterPriority, filterType, filterClient,
      filterCreatedFrom, filterCreatedTo, filterGoLiveFrom, filterGoLiveTo]);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetch.current < 600) return;
    lastFetch.current = now;
    setLoading(true);
    try {
      const scope = buildScope();
      const fetches: Promise<Response>[] = [
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/dashboard/analytics?${scope}`),
      ];
      if (isAdmin) {
        fetches.push(fetch(`${process.env.REACT_APP_API_URL || ""}/api/dashboard/audit-log?limit=500&user_role=Admin`));
      }
      const [anaRes, auditRes] = await Promise.all(fetches);
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setData(anaData);
        // Populate client dropdown on first load (only when no client filter active)
        if (!filterClient && anaData.topClients?.length) {
          setClientList(prev => {
            const merged = Array.from(new Set([...prev, ...anaData.topClients.map((c: any) => c.client_name)])).filter(Boolean).sort();
            return merged;
          });
        }
      }
      if (auditRes?.ok) {
        const logs = await auditRes.json();
        for (const l of logs) try { if (typeof l.details === 'string') l.details = JSON.parse(l.details); } catch {}
        setAudit(logs);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildScope]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => { document.body.classList.remove('sidebar-open'); };
  }, [sidebarOpen]);

  // ── Quick filter helpers ───────────────────────────────────────────────────
  const clearFilters = () => {
    setFilterStatus(''); setFilterPriority(''); setFilterType('');
    setFilterClient(''); setFilterCreatedFrom(''); setFilterCreatedTo('');
    setFilterGoLiveFrom(''); setFilterGoLiveTo(''); setQuickFilter('');
  };

  const applyQuickFilter = (key: string) => {
    clearFilters();
    setQuickFilter(key);
    if (key === 'pending_approval') setFilterStatus('AWAITING_APPROVAL');
    if (key === 'active_only')      setFilterStatus('ACTIVE');
    if (key === 'critical')         setFilterPriority('Critical');
    if (key === 'going_live_soon') {
      const from = new Date().toISOString().split('T')[0];
      const to   = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      setFilterGoLiveFrom(from); setFilterGoLiveTo(to);
    }
  };

  // Role-based status list for dropdown
  const roleStatuses = ROLE_STATUSES[user?.role || 'Admin'] || ROLE_STATUSES['Admin'];

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalProjects  = data?.totalProjects || 0;
  const wbsTotal       = (data?.wbsTasksByStatus || []).reduce((s, r) => s + Number(r.count), 0);
  const wbsCompleted   = Number(data?.wbsTasksByStatus.find(r => r.status === 'completed')?.count || 0);
  const wbsRate        = wbsTotal > 0 ? Math.round((wbsCompleted / wbsTotal) * 100) : 0;
  const totalTasks     = (data?.tasksByStatus || []).reduce((s, r) => s + Number(r.count), 0);
  const completedTasks = Number(data?.tasksByStatus.find(r => r.status === 'completed')?.count || 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const myTotal        = (data?.myTasksByStatus || []).reduce((s, r) => s + Number(r.count), 0);
  const myDone         = Number(data?.myTasksByStatus.find(r => r.status === 'completed')?.count || 0);
  const trendValues    = (data?.weeklyActivityTrend || []).map(w => Number(w.count));
  const trendMax       = Math.max(...trendValues, 1);

  const filteredAudit = audit.filter(l => {
    if (auditAction && l.action !== auditAction) return false;
    if (auditFrom && l.created_at < auditFrom) return false;
    if (auditTo   && l.created_at > auditTo + ' 23:59:59') return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      return (l.project_name || '').toLowerCase().includes(q)
        || (l.action || '').toLowerCase().includes(q)
        || (l.client_name || '').toLowerCase().includes(q)
        || JSON.stringify(l.details || {}).toLowerCase().includes(q);
    }
    return true;
  });

  // Sidebar nav
  const NAV = [
    { label: 'Dashboard',   path: backPath,    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
    { label: 'All Projects', path: '/projects', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> },
    { label: 'Analytics',   path: '/analytics', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>, active: true },
    ...(isAdmin ? [
      { label: 'Client Requests', path: '/admin-dashboard?filter=CLIENT_REQUESTS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
      { label: 'User Management', path: '/admin-dashboard?filter=USER_MANAGEMENT', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg> },
    ] : []),
  ];

  const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'projects',     label: 'Projects' },
    { key: 'tasks',        label: 'Tasks & WBS' },
    { key: 'activity',     label: 'Activity' },
    { key: 'cr_pipeline',  label: 'CR Pipeline' },
    ...(isAdmin ? [{ key: 'audit' as const, label: 'Audit Trail' }] : []),
  ] as const;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`sidebar-drawer fixed inset-y-0 left-0 z-30 w-72 flex flex-col bg-slate-900 text-white
        lg:relative lg:translate-x-0 lg:w-56 lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <img src="/logo192.png" alt="logo" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg"
            onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          <div className="flex-1">
            <p className="text-sm font-bold text-white leading-tight">Chaos</p>
            <p className="text-sm font-bold text-indigo-400 leading-tight">Coordinator</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 text-white/40 hover:text-white rounded-md transition-colors"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
          {NAV.map(item => (
            <React.Fragment key={item.path}>
              <button onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                aria-current={item.active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                  item.active ? 'bg-indigo-600 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                }`}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>

              {/* Sub-nav directly under Analytics */}
              {item.label === 'Analytics' && (
                <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pb-1">
                  {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      aria-current={tab === t.key ? 'page' : undefined}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                        tab === t.key ? 'text-indigo-300 bg-white/10' : 'text-white/30 hover:text-white/60'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }}
              aria-label="Sign out"
              className="p-1.5 text-white/30 hover:text-red-400 rounded-md transition-colors flex-shrink-0">
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top header ── */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black text-gray-900">Analytics</h1>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white ${
                  isAdmin ? 'bg-violet-600' : isCSM ? 'bg-blue-600' : isPM ? 'bg-indigo-600' : 'bg-emerald-600'
                }`}>{user?.role}</span>
                {activeFilterCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalProjects} project{totalProjects !== 1 ? 's' : ''} · {
                  isAdmin ? 'System-wide view' :
                  isCSM   ? 'Your CSM assignments' :
                  isPM    ? 'Your PM assignments' : 'Your owned projects'
                }
              </p>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium text-gray-700">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="9999">All time</option>
              </select>
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
                </svg>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              <button onClick={fetchData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* ── Filter panel ── */}
          {showFilters && (
            <div className="border-t border-gray-100 px-6 py-4 bg-slate-50">
              {/* Row 1: 4 dropdowns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                {/* Status dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Project Status</label>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setQuickFilter(''); }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
                    <option value="">All Statuses</option>
                    {roleStatuses.map(s => (
                      <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                    ))}
                  </select>
                </div>

                {/* Priority dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Priority</label>
                  <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setQuickFilter(''); }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
                    <option value="">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Project Type dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Project Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
                    <option value="">All Types</option>
                    <option value="POC">POC</option>
                    <option value="Actual Project">Actual Project</option>
                  </select>
                </div>

                {/* Client dropdown */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Client</label>
                  <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
                    <option value="">All Clients</option>
                    {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: 2 date ranges side by side */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Created Date Range</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={filterCreatedFrom} onChange={e => setFilterCreatedFrom(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <span className="text-gray-400 text-xs font-bold flex-shrink-0">–</span>
                    <input type="date" value={filterCreatedTo} onChange={e => setFilterCreatedTo(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Go-Live Date Range</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={filterGoLiveFrom} onChange={e => setFilterGoLiveFrom(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <span className="text-gray-400 text-xs font-bold flex-shrink-0">–</span>
                    <input type="date" value={filterGoLiveTo} onChange={e => setFilterGoLiveTo(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
              </div>

              {/* Quick filters + clear */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick:</span>
                  {[
                    { key: 'pending_approval', label: 'Awaiting Approval' },
                    { key: 'active_only',      label: 'Active Only' },
                    { key: 'critical',         label: 'Critical Priority' },
                    { key: 'going_live_soon',  label: 'Go-Live ≤ 14 days' },
                  ].map(qf => (
                    <button key={qf.key} onClick={() => applyQuickFilter(qf.key)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                        quickFilter === qf.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}>
                      {qf.label}
                    </button>
                  ))}
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Tab bar ── */}
          <div className="flex gap-0 px-6 border-t border-gray-100">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading analytics…</p>
            </div>
          ) : (
            <div className="px-6 py-6 max-w-screen-xl mx-auto">

              {/* ══════════ OVERVIEW ══════════ */}
              {tab === 'overview' && (
                <div className="space-y-6">

                  {/* Primary KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard label={isAdmin ? 'Total Projects' : 'My Projects'} value={totalProjects}
                      sub={`${Number(data?.activeProjects||0)} active · ${Number(data?.createdThisPeriod||0)} new this period`}
                      icon={<svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>}
                      tooltip={
                        <div className="w-64">
                          <p className="font-bold text-white text-xs mb-2">{isAdmin ? 'Total Projects' : 'My Projects'}</p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between gap-3"><span className="text-gray-400">Total in scope</span><span className="font-bold text-white">{totalProjects}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-gray-400">Active</span><span className="font-bold text-emerald-300">{Number(data?.activeProjects||0)}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-gray-400">New this period</span><span className="font-bold text-indigo-300">{Number(data?.createdThisPeriod||0)}</span></div>
                            <div className="flex justify-between gap-3"><span className="text-gray-400">Inactive / other</span><span className="font-bold text-gray-300">{totalProjects - Number(data?.activeProjects||0)}</span></div>
                          </div>
                        </div>
                      }
                    />
                    <KpiCard label="WBS Completion Rate" value={`${wbsRate}%`}
                      sub={`${wbsCompleted} / ${wbsTotal} tasks done`}
                      color={wbsRate >= 70 ? 'text-emerald-600' : wbsRate >= 40 ? 'text-amber-600' : 'text-red-500'}
                      icon={<svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      tooltip={
                        <div className="w-64">
                          <p className="font-bold text-white text-xs mb-2">WBS Task Breakdown</p>
                          <div className="space-y-1.5">
                            {(data?.wbsTasksByStatus||[]).map(r => (
                              <div key={r.status} className="flex items-center justify-between gap-3 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[r.status]?.bar||'#94a3b8' }} />
                                  <span className="text-gray-300">{STATUS_META[r.status]?.label||r.status}</span>
                                </div>
                                <span className="font-bold text-white">{r.count}</span>
                              </div>
                            ))}
                            {(data?.wbsTasksByStatus||[]).length === 0 && <p className="text-gray-400 text-[11px]">No WBS tasks recorded.</p>}
                          </div>
                        </div>
                      }
                    />
                    <KpiCard label="Overdue WBS Tasks" value={Number(data?.wbsOverdueCount||0)}
                      sub={Number(data?.wbsOverdueCount||0) > 0 ? `across ${new Set((data?.wbsOverdueTaskList||[]).map(t=>t.projectName)).size} project(s)` : 'all on track'}
                      color={Number(data?.wbsOverdueCount||0) > 0 ? 'text-red-600' : 'text-emerald-600'}
                      alert={Number(data?.wbsOverdueCount||0) > 0}
                      icon={<svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      tooltip={(data?.wbsOverdueTaskList||[]).length > 0 ? (
                        <div className="w-72">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <p className="font-bold text-white text-xs">Overdue Tasks — {(data?.wbsOverdueTaskList||[]).length} total</p>
                          </div>
                          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                            {(data?.wbsOverdueTaskList||[]).slice(0, 15).map((t, i) => (
                              <div key={i} className="bg-white/5 rounded-lg p-2 border border-white/10">
                                <p className="font-semibold text-white text-[11px]">{t.projectName}</p>
                                <p className="text-gray-300 text-[10px] mt-0.5">{t.taskName}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {t.ownerRole && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{t.ownerRole}</span>}
                                  <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Due: {t.plannedEnd}</span>
                                  {t.clientName && <span className="text-[9px] text-gray-500">{t.clientName}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : undefined}
                    />
                    <KpiCard label="Go-Live This Month" value={Number(data?.goLiveThisMonth||0)}
                      sub={`${(data?.upcomingGoLive||[]).length} upcoming in 45 days`}
                      color="text-indigo-600"
                      icon={<svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
                      tooltip={(data?.upcomingGoLive||[]).length > 0 ? (
                        <div className="w-72">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            </div>
                            <p className="font-bold text-white text-xs">Upcoming Go-Lives</p>
                          </div>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {(data?.upcomingGoLive||[]).slice(0, 8).map((p, i) => {
                              const d = daysUntil(p.go_live_deadline);
                              return (
                                <div key={i} className="bg-white/5 rounded-lg p-2 border border-white/10 flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex flex-col items-center justify-center text-white font-black text-[10px] ${d<=7?'bg-red-500':d<=14?'bg-amber-500':'bg-indigo-500'}`}>
                                    <span className="leading-none">{d}</span>
                                    <span className="opacity-70 text-[7px]">days</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white text-[11px] truncate">{p.name}</p>
                                    <p className="text-gray-400 text-[9px] truncate">{p.client_name} · {fmtDate(p.go_live_deadline)}</p>
                                  </div>
                                  {p.priority && <span className="text-[9px] font-bold text-gray-300 flex-shrink-0">{p.priority}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : undefined}
                    />
                  </div>

                  {/* Secondary KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Blocked WBS Tasks — with tooltip */}
                    <Tooltip content={(data?.wbsBlockedTaskList||[]).length > 0 ? (
                      <div>
                        <p className="font-bold text-white mb-2 text-xs">Blocked WBS Tasks ({(data?.wbsBlockedTaskList||[]).length})</p>
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                          {(data?.wbsBlockedTaskList||[]).slice(0, 12).map((t, i) => (
                            <div key={i} className="border-b border-white/10 pb-2">
                              <p className="font-semibold text-white text-[11px] truncate">{t.projectName}</p>
                              <p className="text-gray-300 text-[10px] truncate">{t.wbs ? `${t.wbs} · ` : ''}{t.taskName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {t.ownerRole && <span className="text-indigo-300 text-[10px]">{t.ownerRole}</span>}
                                {t.plannedEnd && <span className="text-orange-300 text-[10px]">Due: {t.plannedEnd}</span>}
                                <span className="text-gray-400 text-[10px] truncate">{t.clientName}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : undefined}>
                      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:border-orange-200 hover:shadow-md transition-all cursor-default">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-2xl font-black text-orange-600">{Number(data?.wbsBlockedCount||0)}</p>
                          <p className="text-xs text-gray-500 font-medium">Blocked WBS Tasks</p>
                          {(data?.wbsBlockedTaskList||[]).length > 0 && (
                            <p className="text-[9px] text-orange-400 mt-0.5">hover for details</p>
                          )}
                        </div>
                      </div>
                    </Tooltip>

                    {/* Awaiting Approval */}
                    {(() => {
                      const awaitingCount = Number(data?.projectsByStatus.find(r=>r.status==='AWAITING_APPROVAL')?.count||0);
                      return (
                        <Tooltip width={260} content={
                          <div>
                            <p className="font-bold text-white text-xs mb-2">Awaiting Approval</p>
                            <p className="text-gray-300 text-[11px] leading-snug mb-2">
                              {awaitingCount > 0
                                ? `${awaitingCount} project${awaitingCount!==1?'s':''} submitted and waiting for admin sign-off.`
                                : 'No projects currently awaiting approval.'}
                            </p>
                            {awaitingCount > 0 && isAdmin && (
                              <p className="text-violet-300 text-[10px]">Go to Admin Dashboard → filter by Awaiting Approval to review.</p>
                            )}
                          </div>
                        }>
                          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:border-violet-200 hover:shadow-md transition-all cursor-default">
                            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-violet-600">{awaitingCount}</p>
                              <p className="text-xs text-gray-500 font-medium">Awaiting Approval</p>
                            </div>
                          </div>
                        </Tooltip>
                      );
                    })()}

                    {/* Avg Project Age */}
                    {(() => {
                      const age = Number(data?.avgProjectAgeDays||0);
                      const ageLabel = age < 30 ? 'New projects' : age < 180 ? 'Active lifecycle' : 'Long-running';
                      const ageColor = age < 30 ? 'text-emerald-300' : age < 180 ? 'text-amber-300' : 'text-red-300';
                      return (
                        <Tooltip width={260} content={
                          <div>
                            <p className="font-bold text-white text-xs mb-2">Avg Project Age</p>
                            <p className="text-gray-300 text-[11px] mb-2">Average days since creation across all projects in scope.</p>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between gap-3"><span className="text-gray-400">Current avg</span><span className={`font-bold ${ageColor}`}>{age}d — {ageLabel}</span></div>
                              <div className="flex justify-between gap-3"><span className="text-gray-400">&lt; 30d</span><span className="text-emerald-300">New / just started</span></div>
                              <div className="flex justify-between gap-3"><span className="text-gray-400">30–180d</span><span className="text-amber-300">Normal lifecycle</span></div>
                              <div className="flex justify-between gap-3"><span className="text-gray-400">&gt; 180d</span><span className="text-red-300">Long-running — review</span></div>
                            </div>
                          </div>
                        }>
                          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:border-amber-200 hover:shadow-md transition-all cursor-default">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-amber-600">{age}</p>
                              <p className="text-xs text-gray-500 font-medium">Avg Project Age (d)</p>
                            </div>
                          </div>
                        </Tooltip>
                      );
                    })()}

                    {/* My Tasks Done / Stage Transitions */}
                    {(!isAdmin && !isSales) ? (
                      <Tooltip width={260} content={
                        <div>
                          <p className="font-bold text-white text-xs mb-2">My Tasks Breakdown</p>
                          <div className="space-y-1.5">
                            {(data?.myTasksByStatus||[]).map(r => (
                              <div key={r.status} className="flex items-center justify-between gap-3 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[r.status]?.bar||'#94a3b8' }} />
                                  <span className="text-gray-300">{STATUS_META[r.status]?.label||r.status}</span>
                                </div>
                                <span className="font-bold text-white">{r.count}</span>
                              </div>
                            ))}
                            {(data?.myTasksByStatus||[]).length === 0 && <p className="text-gray-400 text-[11px]">No tasks assigned to you.</p>}
                          </div>
                        </div>
                      }>
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-default">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-blue-600">{myDone}/{myTotal}</p>
                            <p className="text-xs text-gray-500 font-medium">My Tasks Done</p>
                          </div>
                        </div>
                      </Tooltip>
                    ) : (
                      <Tooltip width={260} content={
                        <div>
                          <p className="font-bold text-white text-xs mb-2">Stage Transitions</p>
                          <p className="text-gray-300 text-[11px] leading-snug">
                            Number of times projects moved between lifecycle stages in the selected period.
                          </p>
                          <p className="text-gray-400 text-[11px] mt-1.5">Higher = more active pipeline movement. Low values may indicate bottlenecks.</p>
                        </div>
                      }>
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all cursor-default">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-emerald-600">{Number(data?.stageVelocity||0)}</p>
                            <p className="text-xs text-gray-500 font-medium">Stage Transitions</p>
                          </div>
                        </div>
                      </Tooltip>
                    )}
                  </div>

                  {/* Pipeline funnel + Donut */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="Project Pipeline Funnel" sub="Count at each lifecycle stage">
                      {totalProjects === 0 ? <Empty text="No projects" /> : (
                        <div className="space-y-2">
                          {PIPELINE_ORDER.filter(s => roleStatuses.includes(s)).map(stage => {
                            const count = Number(data?.projectsByStatus.find(r => r.status === stage)?.count || 0);
                            const pct   = totalProjects > 0 ? (count / totalProjects) * 100 : 0;
                            const meta  = STATUS_META[stage];
                            return (
                              <Tooltip key={stage} width={240} content={
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                  </div>
                                  <p className="text-gray-300 text-[11px] leading-snug mb-2">{STAGE_DESC[stage] || meta.label}</p>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Projects</span><span className="font-bold text-white">{count}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">% of total</span><span className="font-bold text-white">{Math.round(pct)}%</span></div>
                                  </div>
                                </div>
                              }>
                                <div className="flex items-center gap-3">
                                  <div className="w-28 flex-shrink-0 text-right">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                  </div>
                                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                                    <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, backgroundColor: meta.bar }}>
                                      {count > 0 && <span className="text-[9px] font-black text-white">{count}</span>}
                                    </div>
                                  </div>
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Status Distribution" sub="Donut view">
                      <div className="flex items-center gap-6">
                        <div className="relative flex-shrink-0">
                          <DonutRing
                            segments={(data?.projectsByStatus||[]).filter(r=>Number(r.count)>0 && roleStatuses.includes(r.status)).map(r => ({
                              value: Number(r.count), color: STATUS_META[r.status]?.bar || '#94a3b8',
                            }))}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-gray-800">{totalProjects}</span>
                            <span className="text-[8px] text-gray-400 font-bold uppercase">total</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
                          {(data?.projectsByStatus||[]).filter(r=>Number(r.count)>0 && roleStatuses.includes(r.status)).sort((a,b)=>Number(b.count)-Number(a.count)).map(r => {
                            const pct = totalProjects > 0 ? Math.round((Number(r.count)/totalProjects)*100) : 0;
                            const meta = STATUS_META[r.status];
                            return (
                              <Tooltip key={r.status} width={230} content={
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.bar||'#94a3b8' }} />
                                    <span className="font-bold text-white text-xs">{meta?.label||r.status}</span>
                                  </div>
                                  {STAGE_DESC[r.status] && <p className="text-gray-300 text-[11px] leading-snug mb-2">{STAGE_DESC[r.status]}</p>}
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Count</span><span className="font-bold text-white">{r.count}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Share</span><span className="font-bold text-white">{pct}%</span></div>
                                  </div>
                                </div>
                              }>
                                <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-gray-50 cursor-default transition-colors">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.bar||'#94a3b8' }} />
                                  <span className="text-xs text-gray-600 flex-1 truncate">{meta?.label||r.status}</span>
                                  <span className="text-xs font-bold text-gray-700 flex-shrink-0">{r.count}</span>
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  {/* Upcoming go-live + At risk */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="Upcoming Go-Lives" sub="Next 45 days">
                      {(data?.upcomingGoLive||[]).length === 0 ? <Empty text="No upcoming go-lives" /> : (
                        <div className="space-y-2">
                          {(data?.upcomingGoLive||[]).slice(0,6).map(p => {
                            const days = daysUntil(p.go_live_deadline);
                            return (
                              <Tooltip key={p.id} content={
                                <div className="min-w-[200px]">
                                  <p className="font-bold text-white text-xs mb-2">{p.name}</p>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Client</span><span className="text-white font-medium">{p.client_name}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Go-Live</span><span className={`font-bold ${days<=7?'text-red-300':days<=14?'text-amber-300':'text-emerald-300'}`}>{fmtDate(p.go_live_deadline)}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Days left</span><span className="text-white font-bold">{days} days</span></div>
                                    {p.priority && <div className="flex justify-between gap-3"><span className="text-gray-400">Priority</span><span className="text-white font-medium">{p.priority}</span></div>}
                                    <div className="flex justify-between gap-3"><span className="text-gray-400">Status</span><span className="text-white font-medium">{p.status}</span></div>
                                  </div>
                                  <p className="text-[10px] text-indigo-300 mt-2">Click to open project →</p>
                                </div>
                              }>
                                <div onClick={() => navigate(`/project/${p.id}`)}
                                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white font-black flex-shrink-0 ${days<=7?'bg-red-500':days<=14?'bg-amber-500':'bg-indigo-500'}`}>
                                    <span className="text-base leading-none">{days}</span>
                                    <span className="text-[8px] opacity-75">days</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-gray-800 truncate group-hover:text-indigo-600">{p.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{p.client_name} · {fmtDate(p.go_live_deadline)}</p>
                                  </div>
                                  {p.priority && <Pill label={p.priority} meta={PRIORITY_META[p.priority]} />}
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="At-Risk Projects" sub="Most overdue + blocked WBS tasks">
                      {(data?.atRiskProjects||[]).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                          <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          <p className="text-xs">No at-risk projects — great!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(data?.atRiskProjects||[]).slice(0,6).map(p => (
                            <Tooltip key={p.id} content={
                              <div className="min-w-[200px]">
                                <p className="font-bold text-white text-xs mb-2">{p.name}</p>
                                <div className="space-y-1 text-[11px]">
                                  <div className="flex justify-between gap-3"><span className="text-gray-400">Client</span><span className="text-white font-medium">{p.client_name}</span></div>
                                  {p.overdue > 0 && <div className="flex justify-between gap-3"><span className="text-gray-400">Overdue tasks</span><span className="text-red-300 font-bold">{p.overdue}</span></div>}
                                  {p.blocked > 0 && <div className="flex justify-between gap-3"><span className="text-gray-400">Blocked tasks</span><span className="text-orange-300 font-bold">{p.blocked}</span></div>}
                                  <div className="flex justify-between gap-3"><span className="text-gray-400">Completion</span><span className="text-white font-bold">{p.pct}% ({p.done}/{p.total})</span></div>
                                </div>
                                <p className="text-[10px] text-indigo-300 mt-2">Click to open project →</p>
                              </div>
                            }>
                              <div onClick={() => navigate(`/project/${p.id}`)}
                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-red-50 cursor-pointer transition-colors group">
                                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-black text-red-600">{p.overdue+p.blocked}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-gray-800 truncate group-hover:text-red-600">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {p.overdue>0 && <span className="text-[9px] text-red-500 font-bold">{p.overdue} overdue</span>}
                                    {p.blocked>0 && <span className="text-[9px] text-orange-500 font-bold">{p.blocked} blocked</span>}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-black text-gray-600">{p.pct}%</p>
                                  <p className="text-[9px] text-gray-400">done</p>
                                </div>
                              </div>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  {/* Activity trend */}
                  {trendValues.some(v=>v>0) && (
                    <SectionCard title="Weekly Activity Trend" sub="Action volume per week — last 8 weeks">
                      <div className="flex items-end gap-2" style={{ height: 80 }}>
                        {(data?.weeklyActivityTrend||[]).map((w,i) => {
                          const h = trendMax > 0 ? (w.count / trendMax) * 100 : 0;
                          const isLast = i === (data?.weeklyActivityTrend?.length||0) - 1;
                          return (
                            <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                              {w.count > 0 && <span className="text-[8px] font-bold text-gray-500">{w.count}</span>}
                              <div className="w-full rounded-t-sm transition-all"
                                style={{ height: `${Math.max(h, w.count>0?4:0)}%`, backgroundColor: isLast?'#6366f1':'#c7d2fe' }} />
                              <span className="text-[8px] text-gray-400 text-center leading-tight truncate w-full">{w.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ══════════ PROJECTS ══════════ */}
              {tab === 'projects' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="Projects by Status" sub={`${totalProjects} total`}>
                      {totalProjects === 0 ? <Empty text="No projects" /> : (
                        <div className="space-y-3">
                          {(data?.projectsByStatus||[]).filter(r=>Number(r.count)>0 && roleStatuses.includes(r.status)).sort((a,b)=>Number(b.count)-Number(a.count)).map(r => (
                            <HorizBar key={r.status} label={r.status} count={Number(r.count)} total={totalProjects}
                              barColor={STATUS_META[r.status]?.bar||'#94a3b8'}
                              badge={<Pill label={STATUS_META[r.status]?.label||r.status} meta={STATUS_META[r.status]?{color:STATUS_META[r.status].color,bg:STATUS_META[r.status].bg}:undefined} />}
                            />
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <div className="space-y-4">
                      <SectionCard title="By Project Type">
                        <div className="space-y-2.5">
                          {(data?.byType||[]).filter(r=>Number(r.count)>0).length === 0
                            ? <Empty text="No type data" />
                            : (data?.byType||[]).filter(r=>Number(r.count)>0).map(r => (
                              <HorizBar key={r.project_type} label={r.project_type||'Unknown'} count={Number(r.count)} total={totalProjects} barColor="#6366f1" />
                            ))}
                        </div>
                      </SectionCard>
                      <SectionCard title="By Priority">
                        {(() => {
                          const order = ['Critical','High','Medium','Low'];
                          const sorted = (data?.byPriority||[]).filter(r=>Number(r.count)>0).sort((a,b)=>order.indexOf(a.priority)-order.indexOf(b.priority));
                          return sorted.length === 0 ? <Empty text="No priority data" /> : (
                            <div className="space-y-2.5">
                              {sorted.map(r => (
                                <HorizBar key={r.priority} label={r.priority} count={Number(r.count)} total={totalProjects}
                                  barColor={PRIORITY_META[r.priority]?.dot||'#94a3b8'}
                                  badge={<Pill label={r.priority} meta={PRIORITY_META[r.priority]?{color:PRIORITY_META[r.priority].color,bg:PRIORITY_META[r.priority].bg}:undefined} />}
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </SectionCard>
                    </div>
                  </div>

                  {/* Top clients */}
                  {(data?.topClients||[]).length > 0 && (
                    <SectionCard title="Top Clients by Project Count">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {(data?.topClients||[]).map((c,i) => (
                          <div key={c.client_name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 flex-shrink-0">{i+1}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate">{c.client_name}</p>
                              <p className="text-[10px] text-gray-400">{c.count} project{Number(c.count)!==1?'s':''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* Workload distribution — Admin */}
                  {isAdmin && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {(data?.csmWorkload||[]).length > 0 && (
                        <SectionCard title="CSM Workload" sub="Projects managed per CSM">
                          <div className="space-y-2.5">
                            {(data?.csmWorkload||[]).map(w => (
                              <div key={w.name} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-black text-blue-600">{(w.name||'?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-700 truncate">{w.name}</span>
                                    <span className="text-xs font-bold text-gray-600 flex-shrink-0 ml-2">{w.total} · <span className="text-green-600">{w.active_count} active</span></span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min((Number(w.total)/Math.max(...(data?.csmWorkload||[]).map(x=>Number(x.total)),1))*100,100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}
                      {(data?.pmWorkload||[]).length > 0 && (
                        <SectionCard title="PM Workload" sub="Projects managed per PM">
                          <div className="space-y-2.5">
                            {(data?.pmWorkload||[]).map(w => (
                              <div key={w.name} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-black text-indigo-600">{(w.name||'?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-700 truncate">{w.name}</span>
                                    <span className="text-xs font-bold text-gray-600 flex-shrink-0 ml-2">{w.total} · <span className="text-green-600">{w.active_count} active</span></span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min((Number(w.total)/Math.max(...(data?.pmWorkload||[]).map(x=>Number(x.total)),1))*100,100)}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}
                    </div>
                  )}

                  {/* Project completion health table */}
                  {(data?.projectHealth||[]).length > 0 && (
                    <SectionCard title="Project Completion Health" sub="Active & approved projects — sorted by completion %">
                      <div className="space-y-3">
                        {(data?.projectHealth||[]).map(p => (
                          <Tooltip key={p.id} content={
                            <div className="min-w-[200px]">
                              <p className="font-bold text-white text-xs mb-2">{p.name}</p>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Client</span><span className="text-white font-medium">{p.client_name}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Completion</span><span className={`font-bold ${p.pct>=75?'text-emerald-300':p.pct>=40?'text-amber-300':'text-red-300'}`}>{p.pct}%</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Tasks done</span><span className="text-white font-medium">{p.done} of {p.total}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Status</span><span className="text-white font-medium">{STATUS_META[p.status]?.label||p.status}</span></div>
                              </div>
                              <p className="text-[10px] text-indigo-300 mt-2">Click to open project →</p>
                            </div>
                          }>
                            <div onClick={() => navigate(`/project/${p.id}`)}
                              className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                              <div className="relative flex-shrink-0">
                                <ProgressCircle pct={p.pct} size={48} stroke={5}
                                  color={p.pct>=75?'#10b981':p.pct>=40?'#f59e0b':'#ef4444'} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[9px] font-black text-gray-600">{p.pct}%</span>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-600">{p.name}</p>
                                <p className="text-xs text-gray-400 truncate">{p.client_name}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-bold text-gray-600">{p.done}/{p.total} tasks</p>
                                <Pill label={STATUS_META[p.status]?.label||p.status} meta={STATUS_META[p.status]?{color:STATUS_META[p.status].color,bg:STATUS_META[p.status].bg}:undefined} />
                              </div>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ══════════ TASKS & WBS ══════════ */}
              {tab === 'tasks' && (
                <div className="space-y-6">
                  {/* WBS rate big display */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="col-span-1 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
                      <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-2">WBS Completion</p>
                      <p className="text-5xl font-black">{wbsRate}%</p>
                      <p className="text-sm text-white/70 mt-2">{wbsCompleted} of {wbsTotal} tasks done</p>
                      <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${wbsRate}%` }} />
                      </div>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <Tooltip content={(data?.wbsOverdueTaskList||[]).length > 0 ? (
                        <div>
                          <p className="font-bold text-white mb-2 text-xs">Overdue Tasks ({(data?.wbsOverdueTaskList||[]).length})</p>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {(data?.wbsOverdueTaskList||[]).slice(0,12).map((t,i) => (
                              <div key={i} className="border-b border-white/10 pb-1.5">
                                <p className="font-semibold text-white text-[11px] truncate">{t.projectName}</p>
                                <p className="text-gray-300 text-[10px] truncate">{t.wbs ? `${t.wbs} · ` : ''}{t.taskName}</p>
                                <div className="flex gap-2 mt-0.5">
                                  {t.ownerRole && <span className="text-indigo-300 text-[10px]">{t.ownerRole}</span>}
                                  <span className="text-red-300 text-[10px]">Due: {t.plannedEnd}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : undefined}>
                        <div className="bg-red-50 rounded-2xl p-4 border border-gray-100 cursor-default hover:border-red-200 transition-colors">
                          <p className="text-2xl font-black text-red-600">{Number(data?.wbsOverdueCount||0)}</p>
                          <p className="text-xs text-gray-500 font-medium mt-1">WBS Overdue</p>
                          {(data?.wbsOverdueTaskList||[]).length > 0 && <p className="text-[9px] text-red-400 mt-0.5">hover for details</p>}
                        </div>
                      </Tooltip>
                      <Tooltip content={(data?.wbsBlockedTaskList||[]).length > 0 ? (
                        <div>
                          <p className="font-bold text-white mb-2 text-xs">Blocked Tasks ({(data?.wbsBlockedTaskList||[]).length})</p>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {(data?.wbsBlockedTaskList||[]).slice(0,12).map((t,i) => (
                              <div key={i} className="border-b border-white/10 pb-1.5">
                                <p className="font-semibold text-white text-[11px] truncate">{t.projectName}</p>
                                <p className="text-gray-300 text-[10px] truncate">{t.wbs ? `${t.wbs} · ` : ''}{t.taskName}</p>
                                <div className="flex gap-2 mt-0.5">
                                  {t.ownerRole && <span className="text-indigo-300 text-[10px]">{t.ownerRole}</span>}
                                  {t.plannedEnd && <span className="text-orange-300 text-[10px]">Due: {t.plannedEnd}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : undefined}>
                        <div className="bg-orange-50 rounded-2xl p-4 border border-gray-100 cursor-default hover:border-orange-200 transition-colors">
                          <p className="text-2xl font-black text-orange-600">{Number(data?.wbsBlockedCount||0)}</p>
                          <p className="text-xs text-gray-500 font-medium mt-1">WBS Blocked</p>
                          {(data?.wbsBlockedTaskList||[]).length > 0 && <p className="text-[9px] text-orange-400 mt-0.5">hover for details</p>}
                        </div>
                      </Tooltip>
                      {[
                        { label: 'In Progress', val: Number(data?.wbsTasksByStatus.find(r=>r.status==='in_progress')?.count||0), color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Not Started', val: Number(data?.wbsTasksByStatus.find(r=>['not_started','todo'].includes(r.status))?.count||0), color: 'text-gray-600', bg: 'bg-gray-50' },
                      ].map(k => (
                        <div key={k.label} className={`${k.bg} rounded-2xl p-4 border border-gray-100`}>
                          <p className={`text-2xl font-black ${k.color}`}>{k.val}</p>
                          <p className="text-xs text-gray-500 font-medium mt-1">WBS {k.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard title="WBS Tasks by Status" sub={`${wbsTotal} total plan tasks`}>
                      {(data?.wbsTasksByStatus||[]).length === 0 ? <Empty text="No WBS plan data yet" /> : (
                        <div className="space-y-3">
                          {(data?.wbsTasksByStatus||[]).filter(r=>Number(r.count)>0).sort((a,b)=>Number(b.count)-Number(a.count)).map(r => (
                            <HorizBar key={r.status} label={r.status} count={Number(r.count)} total={wbsTotal}
                              barColor={STATUS_META[r.status]?.bar||'#94a3b8'}
                              badge={<Pill label={STATUS_META[r.status]?.label||r.status} meta={STATUS_META[r.status]?{color:STATUS_META[r.status].color,bg:STATUS_META[r.status].bg}:undefined} />}
                            />
                          ))}
                        </div>
                      )}
                    </SectionCard>
                    <SectionCard title="Milestones by Status">
                      {(() => {
                        const mTotal = (data?.milestoneStats||[]).reduce((s,r)=>s+Number(r.count),0);
                        return mTotal === 0 ? <Empty text="No milestone data" /> : (
                          <div className="space-y-3">
                            {(data?.milestoneStats||[]).filter(r=>Number(r.count)>0).map(r => (
                              <HorizBar key={r.status} label={r.status} count={Number(r.count)} total={mTotal}
                                barColor={STATUS_META[r.status]?.bar||'#94a3b8'}
                                badge={<Pill label={STATUS_META[r.status]?.label||r.status} meta={STATUS_META[r.status]?{color:STATUS_META[r.status].color,bg:STATUS_META[r.status].bg}:undefined} />}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </SectionCard>
                  </div>

                  {/* My tasks CSM/PM */}
                  {!isAdmin && !isSales && myTotal > 0 && (
                    <SectionCard title="My Personal Tasks" sub={`${myDone}/${myTotal} completed`}>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {(data?.myTasksByStatus||[]).filter(r=>Number(r.count)>0).map(r => {
                          const meta = STATUS_META[r.status];
                          return (
                            <div key={r.status} className={`rounded-xl p-4 ${meta?.bg||'bg-gray-50'}`}>
                              <p className={`text-2xl font-black ${meta?.color||'text-gray-700'}`}>{r.count}</p>
                              <p className={`text-xs font-bold mt-1 ${meta?.color||'text-gray-500'}`}>{meta?.label||r.status}</p>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  )}
                </div>
              )}

              {/* ══════════ ACTIVITY ══════════ */}
              {tab === 'activity' && (
                <div className="space-y-6">
                  <SectionCard title="Weekly Activity Volume" sub="Total actions per week — last 8 weeks">
                    <div className="flex items-end gap-2 mt-2" style={{ height: 100 }}>
                      {(data?.weeklyActivityTrend||[]).map((w,i) => {
                        const h = trendMax>0?(w.count/trendMax)*100:0;
                        const isLast = i===(data?.weeklyActivityTrend?.length||0)-1;
                        return (
                          <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                            {w.count>0 && <span className="text-[9px] font-bold text-gray-500">{w.count}</span>}
                            <div className="w-full rounded-t-md transition-all"
                              style={{ height: `${Math.max(h,w.count>0?4:0)}%`, backgroundColor: isLast?'#6366f1':'#c7d2fe' }} />
                            <span className="text-[8px] text-gray-400 text-center leading-tight">{w.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard title="Action Breakdown" sub={`Last ${period} days`}>
                    {(data?.recentActivity||[]).length === 0 ? <Empty text="No activity in this period" /> : (
                      <div className="space-y-3">
                        {(data?.recentActivity||[]).map(r => {
                          const maxAct = Number(data!.recentActivity[0]?.count)||1;
                          return (
                            <div key={r.action} className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg flex-shrink-0 w-40 truncate">
                                {ACTION_LABELS[r.action]||r.action.replace(/_/g,' ')}
                              </span>
                              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(Number(r.count)/maxAct)*100}%` }} />
                              </div>
                              <span className="text-xs font-black text-gray-600 w-8 text-right">{r.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}

              {/* ══════════ CR PIPELINE ══════════ */}
              {tab === 'cr_pipeline' && (
                <div className="space-y-6">
                  {crStatsLoading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-3">
                      <div className="w-6 h-6 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                      Loading CR analytics…
                    </div>
                  ) : !crStats ? (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
                      <p className="text-sm text-gray-400">No CR data available</p>
                      <button onClick={fetchCrStats} className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800">Retry</button>
                    </div>
                  ) : (
                    <>
                      {/* Top KPIs */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { label: 'Total CRs',          value: crStats.total ?? 0,                     color: 'text-gray-900',   sub: 'all time' },
                          { label: 'Pending in Pipeline', value: (crStats.by_stage?.csm_review ?? 0) + (crStats.by_stage?.pm_review ?? 0) + (crStats.by_stage?.sales_review ?? 0) + (crStats.by_stage?.admin_review ?? 0), color: 'text-amber-600', sub: 'across all stages' },
                          { label: 'Approved',            value: crStats.by_stage?.approved ?? 0,        color: 'text-emerald-600', sub: 'fully processed' },
                          { label: 'Avg Effort',          value: crStats.avg_effort_man_days ? `${parseFloat(crStats.avg_effort_man_days).toFixed(1)} d` : '—', color: 'text-indigo-600', sub: 'man-days per CR' },
                        ].map((s, i) => (
                          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{s.label}</p>
                            <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Stage funnel */}
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-gray-800 mb-4">Approval Stage Funnel</h3>
                        <div className="space-y-3">
                          {[
                            { key: 'csm_review',   label: 'CSM Review',   color: 'bg-blue-500' },
                            { key: 'pm_review',    label: 'PM Review',    color: 'bg-indigo-500' },
                            { key: 'sales_review', label: 'Sales Review', color: 'bg-violet-500' },
                            { key: 'admin_review', label: 'Admin Review', color: 'bg-amber-500' },
                            { key: 'approved',     label: 'Approved',     color: 'bg-emerald-500' },
                            { key: 'rejected',     label: 'Rejected',     color: 'bg-red-400' },
                          ].map(stage => {
                            const count = crStats.by_stage?.[stage.key] ?? 0;
                            const total = crStats.total || 1;
                            const pct = Math.round((count / total) * 100);
                            return (
                              <div key={stage.key} className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-gray-600 w-28 flex-shrink-0">{stage.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                  <div className={`h-3 rounded-full ${stage.color} transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
                                <span className="text-[10px] text-gray-400 w-8">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* By type + By billing type */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* By request type */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                          <h3 className="text-sm font-bold text-gray-800 mb-4">By Request Type</h3>
                          {!crStats.by_type || Object.keys(crStats.by_type).length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-6">No data</p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(crStats.by_type as Record<string,number>).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                                const total = Object.values(crStats.by_type as Record<string,number>).reduce((s,v) => s + v, 0) || 1;
                                const pct = Math.round(((count as number) / total) * 100);
                                return (
                                  <div key={type} className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-gray-600 w-36 flex-shrink-0 capitalize">{String(type).replace(/_/g,' ')}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                      <div className="h-2.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-6 text-right">{String(count)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* By billing type */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                          <h3 className="text-sm font-bold text-gray-800 mb-4">By Billing Type</h3>
                          {!crStats.by_billing_type || Object.keys(crStats.by_billing_type).length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-6">No approved CRs with billing classification yet</p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(crStats.by_billing_type as Record<string,number>).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                                const total = Object.values(crStats.by_billing_type as Record<string,number>).reduce((s,v) => s + v, 0) || 1;
                                const pct = Math.round(((count as number) / total) * 100);
                                const color = type === 'paid_cr' ? 'bg-emerald-400' : type === 'engineering' ? 'bg-blue-400' : 'bg-violet-400';
                                return (
                                  <div key={type} className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-gray-600 w-36 flex-shrink-0 capitalize">{String(type).replace(/_/g,' ')}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                      <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-6 text-right">{String(count)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Volume stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pending This Week</p>
                          <p className="text-2xl font-extrabold text-amber-600">{crStats.pending_this_week ?? 0}</p>
                          <p className="text-xs text-gray-400 mt-1">new CRs submitted in the last 7 days</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Approved This Month</p>
                          <p className="text-2xl font-extrabold text-emerald-600">{crStats.approved_this_month ?? 0}</p>
                          <p className="text-xs text-gray-400 mt-1">CRs fully approved in the last 30 days</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ══════════ AUDIT LOG ══════════ */}
              {tab === 'audit' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3 shadow-sm">
                    <div className="relative flex-1 min-w-48">
                      <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                      </svg>
                      <input type="text" placeholder="Search project, action, client…" value={auditSearch}
                        onChange={e => setAuditSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                      className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
                      <option value="">All Actions</option>
                      {Array.from(new Set(audit.map(l=>l.action))).sort().map(a => (
                        <option key={a} value={a}>{ACTION_LABELS[a]||a.replace(/_/g,' ')}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input type="date" value={auditFrom} onChange={e => setAuditFrom(e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <span className="text-xs text-gray-400">–</span>
                      <input type="date" value={auditTo} onChange={e => setAuditTo(e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg">{filteredAudit.length} entries</span>
                      {(auditSearch||auditAction||auditFrom||auditTo) && (
                        <button onClick={() => { setAuditSearch(''); setAuditAction(''); setAuditFrom(''); setAuditTo(''); }}
                          className="text-xs font-bold text-red-500 hover:text-red-700">Clear</button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3 bg-gray-50 border-b border-gray-100"
                      style={{ gridTemplateColumns: '155px 165px 1fr 175px' }}>
                      <span>Timestamp</span><span>Action</span><span>Details</span><span>Project / Client</span>
                    </div>
                    <div className="divide-y divide-gray-50" style={{ maxHeight: 560, overflowY: 'auto' }}>
                      {filteredAudit.length === 0 ? <Empty text="No entries found" /> : filteredAudit.map(log => (
                        <div key={log.id} className="grid items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                          style={{ gridTemplateColumns: '155px 165px 1fr 175px' }}>
                          <div>
                            <p className="text-xs text-gray-700 font-medium">{fmtDateTime(log.created_at)}</p>
                            <p className="text-[10px] text-gray-400">{timeAgo(log.created_at)}</p>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg self-start inline-block truncate max-w-full">
                            {ACTION_LABELS[log.action]||log.action.replace(/_/g,' ')}
                          </span>
                          <div className="min-w-0">
                            {log.action === 'wbs_task_status_changed' && typeof log.details === 'object' && log.details !== null ? (
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-semibold text-gray-800 truncate">
                                  {(log.details as any).wbs && <span className="text-gray-400 font-mono mr-1">{(log.details as any).wbs}</span>}
                                  {(log.details as any).task_name || '—'}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  <span className="font-semibold text-red-500">{String((log.details as any).old_status||'').replace(/_/g,' ')}</span>
                                  {' → '}
                                  <span className="font-semibold text-emerald-600">{String((log.details as any).new_status||'').replace(/_/g,' ')}</span>
                                </p>
                                {(log.details as any).sprint_label && (
                                  <p className="text-[10px] text-gray-400 truncate">Sprint: {(log.details as any).sprint_label}</p>
                                )}
                                {(log.details as any).changed_by_name && (
                                  <p className="text-[10px] text-gray-400 truncate">
                                    By: {(log.details as any).changed_by_name}
                                    {(log.details as any).changed_by_role && ` (${(log.details as any).changed_by_role})`}
                                  </p>
                                )}
                              </div>
                            ) : typeof log.details === 'object' && log.details !== null ? (
                              <div className="space-y-0.5">
                                {Object.entries(log.details).slice(0,4).map(([k,v]) => (
                                  <p key={k} className="text-[10px] truncate">
                                    <span className="font-semibold text-gray-500">{k.replace(/_/g,' ')}:</span>{' '}
                                    <span className="text-gray-700">{String(v)}</span>
                                  </p>
                                ))}
                              </div>
                            ) : <p className="text-[10px] text-gray-500 truncate">{String(log.details||'—')}</p>}
                          </div>
                          <div className="min-w-0">
                            {log.project_id ? (
                              <button onClick={() => navigate(`/project/${log.project_id}`)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 truncate block text-left max-w-full">
                                {log.project_name||`Project #${log.project_id}`}
                              </button>
                            ) : <span className="text-xs text-gray-400">—</span>}
                            {log.client_name && <p className="text-[10px] text-gray-400 truncate">{log.client_name}</p>}
                            {log.project_status && (
                              <Pill label={STATUS_META[log.project_status]?.label||log.project_status}
                                meta={STATUS_META[log.project_status]?{color:STATUS_META[log.project_status].color,bg:STATUS_META[log.project_status].bg}:undefined} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Analytics;
