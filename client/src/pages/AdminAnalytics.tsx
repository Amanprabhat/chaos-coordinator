import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AuditLog {
  id: number;
  project_id?: number;
  action: string;
  details: any;
  created_at: string;
  project_name?: string;
  client_name?: string;
}

interface Analytics {
  period: number;
  projectsByStatus: { status: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  overdueTasks: number;
  recentActivity: { action: string; count: number }[];
  milestoneStats: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  INTAKE_CREATED:    'bg-gray-100 text-gray-700',
  MEETING_SCHEDULED: 'bg-blue-100 text-blue-700',
  MEETING_COMPLETED: 'bg-indigo-100 text-indigo-700',
  HANDOVER_PENDING:  'bg-yellow-100 text-yellow-700',
  AWAITING_APPROVAL: 'bg-violet-100 text-violet-700',
  APPROVED:          'bg-emerald-100 text-emerald-700',
  ACTIVE:            'bg-green-100 text-green-700',
  cancelled:         'bg-red-100 text-red-700',
  completed:         'bg-emerald-100 text-emerald-700',
  in_progress:       'bg-blue-100 text-blue-700',
  todo:              'bg-gray-100 text-gray-600',
  blocked:           'bg-red-100 text-red-700',
  not_started:       'bg-gray-100 text-gray-500',
  pending:           'bg-amber-100 text-amber-700',
};

const ACTION_LABELS: Record<string, string> = {
  start_date_changed:  'Start Date Changed',
  stage_transition:    'Stage Transition',
  wbs_plan_saved:      'WBS Saved',
  project_approved:    'Project Approved',
  project_rejected:    'Project Rejected',
  handover_initiated:  'Handover Initiated',
  milestone_completed: 'Milestone Completed',
  plan_generated:      'Plan Generated',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

const AdminAnalytics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'analytics' | 'audit'>('analytics');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [anaRes, auditRes] = await Promise.all([
        fetch(`http://localhost:3001/api/dashboard/analytics?period=${period}`),
        fetch(`http://localhost:3001/api/dashboard/audit-log?limit=300`),
      ]);
      if (anaRes.ok) setAnalytics(await anaRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLogs = auditLogs.filter(l => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (l.project_name || '').toLowerCase().includes(q)
        || (l.action || '').toLowerCase().includes(q)
        || (l.client_name || '').toLowerCase().includes(q)
        || JSON.stringify(l.details || {}).toLowerCase().includes(q);
    }
    return true;
  });

  const totalProjects = analytics?.projectsByStatus.reduce((s, r) => s + Number(r.count), 0) || 0;
  const totalTasks    = analytics?.tasksByStatus.reduce((s, r) => s + Number(r.count), 0) || 0;
  const completedTasks = Number(analytics?.tasksByStatus.find(r => r.status === 'completed')?.count || 0);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeProjects = Number(analytics?.projectsByStatus.find(r => r.status === 'ACTIVE')?.count || 0);
  const pendingApproval = Number(analytics?.projectsByStatus.find(r => r.status === 'AWAITING_APPROVAL')?.count || 0);
  const overdueTasks   = Number(analytics?.overdueTasks || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin-dashboard')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics & Audit Log</h1>
            <p className="text-sm text-gray-500">System-wide insights and full activity trail</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <span className="text-xs text-gray-400">Signed in as {user?.name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex gap-0">
          {(['analytics', 'audit'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'audit' ? 'Audit Log' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : tab === 'analytics' ? (
          /* ── ANALYTICS TAB ── */
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Projects',    value: totalProjects,    color: 'text-gray-900',    sub: `${activeProjects} active` },
                { label: 'Task Completion',   value: `${completionRate}%`, color: completionRate >= 70 ? 'text-emerald-600' : 'text-amber-600', sub: `${completedTasks} of ${totalTasks} tasks done` },
                { label: 'Overdue Tasks',     value: overdueTasks,     color: overdueTasks > 0 ? 'text-red-600' : 'text-emerald-600', sub: overdueTasks > 0 ? 'need attention' : 'all on track' },
                { label: 'Pending Approval',  value: pendingApproval,  color: pendingApproval > 0 ? 'text-violet-600' : 'text-gray-400', sub: 'awaiting review' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{k.label}</p>
                  <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Projects by Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Projects by Status</h3>
                {totalProjects === 0 ? <p className="text-sm text-gray-400 text-center py-6">No projects yet</p> : (
                  <div className="space-y-3">
                    {(analytics?.projectsByStatus || []).sort((a, b) => Number(b.count) - Number(a.count)).map(r => {
                      const pct = (Number(r.count) / totalProjects) * 100;
                      return (
                        <div key={r.status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {r.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-bold text-gray-600">{r.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tasks by Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Tasks by Status</h3>
                {totalTasks === 0 ? <p className="text-sm text-gray-400 text-center py-6">No tasks yet</p> : (
                  <div className="space-y-3">
                    {(analytics?.tasksByStatus || []).sort((a, b) => Number(b.count) - Number(a.count)).map(r => {
                      const pct = (Number(r.count) / totalTasks) * 100;
                      const barColor = r.status === 'completed' ? 'bg-emerald-500' : r.status === 'in_progress' ? 'bg-blue-500' : r.status === 'blocked' ? 'bg-red-500' : 'bg-gray-400';
                      return (
                        <div key={r.status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {r.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-bold text-gray-600">{r.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Activity Types */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Top Activity</h3>
                <p className="text-xs text-gray-400 mb-4">Last {period} days</p>
                {(analytics?.recentActivity || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No activity in this period</p>
                ) : (
                  <div className="space-y-3">
                    {(analytics?.recentActivity || []).map((r, i) => {
                      const max = Number(analytics!.recentActivity[0]?.count) || 1;
                      const pct = (Number(r.count) / max) * 100;
                      return (
                        <div key={r.action}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-700">{ACTION_LABELS[r.action] || r.action.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-bold text-gray-600">{r.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Milestones */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Milestones</h3>
                {(analytics?.milestoneStats || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No milestones yet</p>
                ) : (() => {
                  const total = (analytics?.milestoneStats || []).reduce((s, r) => s + Number(r.count), 0);
                  return (
                    <div className="space-y-3">
                      {(analytics?.milestoneStats || []).map(r => {
                        const pct = total > 0 ? (Number(r.count) / total) * 100 : 0;
                        const barColor = r.status === 'completed' ? 'bg-emerald-500' : r.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-400';
                        return (
                          <div key={r.status}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                                {r.status.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs font-bold text-gray-600">{r.count}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          /* ── AUDIT LOG TAB ── */
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search project, action, client, details…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">All Actions</option>
                {Array.from(new Set(auditLogs.map(l => l.action))).sort().map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a] || a.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400 flex-shrink-0 font-medium">{filteredLogs.length} entries</span>
              <button
                onClick={fetchData}
                className="px-3 py-2 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: '150px 180px 1fr 170px' }}>
                <span>Timestamp</span>
                <span>Action</span>
                <span>Details</span>
                <span>Project</span>
              </div>

              <div className="divide-y divide-gray-50" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">No audit entries found</p>
                ) : (
                  filteredLogs.map(log => (
                    <div
                      key={log.id}
                      className="grid items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      style={{ gridTemplateColumns: '150px 180px 1fr 170px' }}
                    >
                      <div>
                        <p className="text-[10px] text-gray-600">{fmtDate(log.created_at)}</p>
                        <p className="text-[9px] text-gray-400">{timeAgo(log.created_at)}</p>
                      </div>

                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full self-start inline-block">
                        {ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ')}
                      </span>

                      <div className="text-xs text-gray-600 min-w-0 overflow-hidden">
                        {typeof log.details === 'object' && log.details !== null ? (
                          <div className="space-y-0.5">
                            {Object.entries(log.details).slice(0, 5).map(([k, v]) => (
                              <p key={k} className="text-[10px] truncate">
                                <span className="font-medium text-gray-500">{k.replace(/_/g, ' ')}:</span>{' '}
                                <span className="text-gray-700">{String(v)}</span>
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 truncate">{String(log.details || '—')}</p>
                        )}
                      </div>

                      <div className="min-w-0">
                        {log.project_id ? (
                          <button
                            onClick={() => navigate(`/project/${log.project_id}`)}
                            className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 truncate block text-left max-w-full"
                          >
                            {log.project_name || `Project #${log.project_id}`}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                        {log.client_name && (
                          <p className="text-[9px] text-gray-400 truncate mt-0.5">{log.client_name}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
