import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface WBSTask {
  id: number; wbs: string; name: string; type?: string;
  status: string; planned_end?: string; owner_role?: string;
}

interface Project {
  id: number;
  name: string;
  client_name: string;
  description?: string;
  status: string;
  project_type?: string;
  priority?: string;
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
  project_start_date?: string;
  target_go_live_date?: string;
  go_live_deadline?: string;
  project_plan?: string;
  business_objective?: string;
  success_criteria?: string;
  num_users?: string;
  budget_range?: string;
  created_at: string;
  updated_at: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string; gradient: string; gradientFrom: string;
  bg: string; text: string; dot: string; border: string;
}> = {
  INTAKE_CREATED:    { label: 'Intake Created',    gradient: 'from-slate-400 to-slate-500',   gradientFrom: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-700',   dot: 'bg-slate-400',   border: 'border-slate-200'   },
  MEETING_SCHEDULED: { label: 'Meeting Scheduled', gradient: 'from-blue-400 to-blue-600',     gradientFrom: '#60a5fa', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200'    },
  MEETING_COMPLETED: { label: 'Meeting Completed', gradient: 'from-cyan-400 to-cyan-600',     gradientFrom: '#22d3ee', bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-200'    },
  HANDOVER_PENDING:  { label: 'Handover Pending',  gradient: 'from-amber-400 to-orange-500',  gradientFrom: '#fbbf24', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200'   },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', gradient: 'from-violet-500 to-purple-600', gradientFrom: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500',  border: 'border-violet-200'  },
  APPROVED:          { label: 'Approved',           gradient: 'from-emerald-400 to-green-600', gradientFrom: '#34d399', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  ACTIVE:            { label: 'Active',             gradient: 'from-green-400 to-emerald-600', gradientFrom: '#4ade80', bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500',   border: 'border-green-200'   },
};

const fallbackStatus = { label: 'Unknown', gradient: 'from-gray-400 to-gray-500', gradientFrom: '#9ca3af', bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400', border: 'border-gray-200' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseTasks(project: Project): WBSTask[] {
  if (!project.project_plan) return [];
  try { const p = JSON.parse(project.project_plan); return Array.isArray(p) ? p : []; }
  catch { return []; }
}

function getProgress(project: Project): number | null {
  const tasks = parseTasks(project).filter(t => t.type === 'Task' || t.type === 'Deliverable');
  if (tasks.length === 0) return null;
  return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100);
}

function getOverdueTasks(project: Project): WBSTask[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return parseTasks(project).filter(t =>
    t.status !== 'completed' && t.planned_end && new Date(t.planned_end) < today
  );
}

function getGoLiveDate(project: Project): string | undefined {
  return project.go_live_deadline || project.target_go_live_date;
}

function getGoLiveDays(project: Project): number | null {
  const d = getGoLiveDate(project);
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return v; }
}

function avatarInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Avatar chip ────────────────────────────────────────────────────────────────

const Avatar: React.FC<{ name?: string; color?: string; size?: string }> = ({
  name, color = 'from-indigo-400 to-violet-500', size = 'w-7 h-7',
}) => (
  <div title={name} className={`${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-2 ring-white`}>
    {avatarInitials(name)}
  </div>
);

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const cfg = STATUS_CONFIG[status] ?? fallbackStatus;
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${cfg.bg} ${cfg.text}`}>
      <span className={`rounded-full flex-shrink-0 ${small ? 'w-1 h-1' : 'w-1.5 h-1.5'} ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Progress ring ──────────────────────────────────────────────────────────────

const ProgressRing: React.FC<{ pct: number; size?: number; stroke?: number; color?: string }> = ({
  pct, size = 48, stroke = 4, color = '#6366f1',
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  );
};

// ── Project Detail Drawer ──────────────────────────────────────────────────────

const ProjectDetailDrawer: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const navigate = useNavigate();
  const [drawerTab, setDrawerTab] = useState<'overview' | 'team' | 'timeline' | 'notes'>('overview');
  const cfg = STATUS_CONFIG[project.status] ?? fallbackStatus;
  const progress = getProgress(project);
  const overdue = getOverdueTasks(project);
  const goLiveDays = getGoLiveDays(project);

  const DRAWER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'team',     label: 'Team & Client' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'notes',    label: 'Notes' },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      <div className="flex-1 bg-slate-900/50 backdrop-blur-sm" />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${cfg.gradient} px-6 pt-6 pb-5 flex-shrink-0 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-black/5 rounded-full translate-y-1/2 pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {project.project_type ?? 'Project'}
                </span>
                {project.priority && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    project.priority === 'Critical' ? 'bg-red-500/30 text-white' :
                    project.priority === 'High'     ? 'bg-orange-400/30 text-white' :
                    'bg-white/20 text-white/80'
                  }`}>{project.priority}</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white leading-tight truncate">{project.name}</h2>
              <p className="text-white/70 text-sm mt-1">{project.client_name}</p>
              <div className="mt-3">
                <StatusBadge status={project.status} />
              </div>
            </div>
            {progress !== null && (
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="relative">
                  <ProgressRing pct={progress} size={56} stroke={5} color="rgba(255,255,255,0.9)" />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {progress}%
                  </span>
                </div>
                <p className="text-[10px] text-white/60 mt-1">Progress</p>
              </div>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-0 right-0 p-1.5 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick stats row */}
          <div className="relative flex items-center gap-3 mt-4 flex-wrap">
            {overdue.length > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/25 border border-red-300/30 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />
                <span className="text-xs font-bold text-white">{overdue.length} overdue task{overdue.length > 1 ? 's' : ''}</span>
              </div>
            )}
            {goLiveDays !== null && (
              <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 border ${
                goLiveDays < 0 ? 'bg-red-500/25 border-red-300/30' :
                goLiveDays <= 7 ? 'bg-orange-400/25 border-orange-300/30' :
                'bg-white/15 border-white/20'
              }`}>
                <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-bold text-white">
                  {goLiveDays < 0 ? `${Math.abs(goLiveDays)}d overdue` : goLiveDays === 0 ? 'Go-live today!' : `${goLiveDays}d to go-live`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Drawer tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-100 flex-shrink-0 bg-white">
          {DRAWER_TABS.map(t => (
            <button key={t.id} onClick={() => setDrawerTab(t.id)}
              className={`px-3 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                drawerTab === t.id
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gray-50/50">

          {drawerTab === 'overview' && (
            <>
              {/* KPI mini-tiles */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Stage', value: project.stage_name || '—', icon: '🎯' },
                  { label: 'Type', value: project.project_type || '—', icon: '🏗️' },
                  { label: 'Region', value: project.deployment_region || '—', icon: '🌍' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                    <p className="text-base mb-1">{s.icon}</p>
                    <p className="text-xs font-bold text-gray-800 truncate">{s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {progress !== null && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-600">Implementation Progress</p>
                    <span className="text-sm font-bold text-indigo-600">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Overdue tasks */}
              {overdue.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    {overdue.length} Overdue Task{overdue.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {overdue.slice(0, 4).map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-red-800 font-medium truncate flex-1">{t.name}</span>
                        <span className="text-red-500 ml-2 flex-shrink-0">{fmtDate(t.planned_end)}</span>
                      </div>
                    ))}
                    {overdue.length > 4 && <p className="text-xs text-red-400">+{overdue.length - 4} more…</p>}
                  </div>
                </div>
              )}

              {/* Project details */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Project Details</p>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'Deployment Type', value: project.deployment_type },
                    { label: 'SSO Required', value: project.sso_required != null ? (project.sso_required ? 'Yes' : 'No') : undefined },
                    { label: 'Expected Timeline', value: project.expected_timeline },
                    { label: 'Num. Users', value: project.num_users },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-gray-400">{r.label}</span>
                      <span className="font-semibold text-gray-800 text-right ml-4">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {project.business_objective && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Business Objective</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{project.business_objective}</p>
                </div>
              )}
            </>
          )}

          {drawerTab === 'team' && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Internal Team</p>
                <div className="divide-y divide-gray-50">
                  {[
                    { role: 'Sales Owner', name: project.owner_name, color: 'from-blue-400 to-blue-600' },
                    { role: 'CSM', name: project.csm_name, color: 'from-cyan-400 to-cyan-600' },
                    { role: 'Project Manager', name: project.pm_name, color: 'from-indigo-400 to-indigo-600' },
                    { role: 'Product Manager', name: project.product_manager_name, color: 'from-violet-400 to-violet-600' },
                  ].filter(r => r.name).map(r => (
                    <div key={r.role} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={r.name} color={r.color} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        <p className="text-[10px] text-gray-400">{r.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Client SPOC</p>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'Name', value: project.client_spoc_name },
                    { label: 'Email', value: project.client_spoc_email },
                    { label: 'Mobile', value: project.client_spoc_mobile },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-gray-400">{r.label}</span>
                      <span className="font-semibold text-gray-800 break-all ml-4 text-right max-w-[60%]">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {drawerTab === 'timeline' && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">Key Dates</p>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'Date Submitted', value: fmtDate(project.created_at), icon: '📋' },
                    { label: 'Kickoff Meeting', value: fmtDate(project.meeting_date), icon: '🤝', extra: project.meeting_done ? '✓ Done' : undefined },
                    { label: 'Project Start', value: fmtDate(project.start_date || project.project_start_date), icon: '🚀' },
                    { label: 'Go-Live Target', value: fmtDate(getGoLiveDate(project)), icon: '🎯' },
                  ].filter(r => r.value !== '—').map(r => (
                    <div key={r.label} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-base flex-shrink-0">{r.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">{r.label}</p>
                        <p className="text-sm font-semibold text-gray-800">{r.value}</p>
                      </div>
                      {r.extra && <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">{r.extra}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Go-live countdown visual */}
              {getGoLiveDays(project) !== null && (() => {
                const days = getGoLiveDays(project)!;
                const isOverdue = days < 0;
                const isSoon = !isOverdue && days <= 14;
                return (
                  <div className={`rounded-xl p-4 border ${
                    isOverdue ? 'bg-red-50 border-red-200' : isSoon ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'
                  }`}>
                    <p className={`text-2xl font-black ${isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {isOverdue ? `${Math.abs(days)} days overdue` : days === 0 ? 'Go-live today!' : `${days} days`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isOverdue ? 'Past go-live deadline' : 'Until go-live date'}
                    </p>
                  </div>
                );
              })()}
            </>
          )}

          {drawerTab === 'notes' && (
            <>
              {project.mom_text ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Meeting Minutes (MoM)</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.mom_text}</p>
                </div>
              ) : null}

              {project.integrations_required && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Integrations Required</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{project.integrations_required}</p>
                </div>
              )}

              {project.success_criteria && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Success Criteria</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{project.success_criteria}</p>
                </div>
              )}

              {project.description && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Additional Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
                </div>
              )}

              {!project.mom_text && !project.integrations_required && !project.success_criteria && !project.description && (
                <div className="text-center py-12 text-gray-300">
                  <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">No notes added yet</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">Last updated {fmtDate(project.updated_at)}</p>
          <button
            onClick={() => navigate(`/project/${project.id}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            Open full page
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── KPI tile ───────────────────────────────────────────────────────────────────

const KpiTile: React.FC<{
  label: string; value: number; icon: React.ReactNode;
  gradient: string; subtext?: string; pulse?: boolean; delay?: number;
}> = ({ label, value, icon, gradient, subtext, pulse, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br ${gradient} shadow-sm`}
  >
    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">{label}</p>
        <motion.p
          className="text-3xl font-black text-white"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.2 }}
        >
          {value}
        </motion.p>
        {subtext && <p className="text-xs text-white/60 mt-1">{subtext}</p>}
      </div>
      <div className={`p-2 rounded-xl bg-white/20 ${pulse ? 'animate-pulse' : ''}`}>
        {icon}
      </div>
    </div>
  </motion.div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const AllProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  useEffect(() => {
    fetch('http://localhost:3001/api/projects')
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => { document.body.classList.remove('sidebar-open'); };
  }, [sidebarOpen]);

  const isSalesOrAdmin = user?.role === 'Sales' || user?.role === 'Admin';
  const isSalesOnly = user?.role === 'Sales';
  const isAdmin = user?.role === 'Admin';

  const visibleProjects = useMemo(() => isSalesOrAdmin
    ? projects
    : projects.filter(p => !['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING'].includes(p.status)),
    [projects, isSalesOrAdmin]);

  // KPI computations
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      total:    visibleProjects.length,
      active:   visibleProjects.filter(p => p.status === 'ACTIVE').length,
      atRisk:   visibleProjects.filter(p => getOverdueTasks(p).length > 0).length,
      goLive:   visibleProjects.filter(p => {
        const d = getGoLiveDate(p); if (!d) return false;
        const dt = new Date(d);
        return dt >= monthStart && dt <= monthEnd;
      }).length,
      pending:  visibleProjects.filter(p => p.status === 'AWAITING_APPROVAL').length,
    };
  }, [visibleProjects]);

  // Smart filter logic
  const SMART_FILTERS = useMemo(() => [
    { key: 'ALL',          label: 'All Projects',       count: kpis.total },
    { key: 'ACTIVE',       label: 'Active',              count: kpis.active },
    { key: 'AT_RISK',      label: 'At Risk',             count: kpis.atRisk },
    { key: 'GO_LIVE_SOON', label: 'Go-Live This Month',  count: kpis.goLive },
    { key: 'NEEDS_ATTENTION', label: 'Needs Attention',  count: visibleProjects.filter(p => ['HANDOVER_PENDING','AWAITING_APPROVAL'].includes(p.status)).length },
    ...(isSalesOrAdmin ? [{ key: 'INTAKE_CREATED', label: 'Intake',         count: visibleProjects.filter(p => p.status === 'INTAKE_CREATED').length }] : []),
  ], [kpis, visibleProjects, isSalesOrAdmin]);

  const filtered = useMemo(() => {
    let list = visibleProjects;
    if (activeFilter === 'AT_RISK')       list = list.filter(p => getOverdueTasks(p).length > 0);
    else if (activeFilter === 'GO_LIVE_SOON') {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      list = list.filter(p => { const d = getGoLiveDate(p); if (!d) return false; const dt = new Date(d); return dt >= now && dt <= end; });
    }
    else if (activeFilter === 'NEEDS_ATTENTION') list = list.filter(p => ['HANDOVER_PENDING','AWAITING_APPROVAL'].includes(p.status));
    else if (activeFilter !== 'ALL') list = list.filter(p => p.status === activeFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.owner_name ?? '').toLowerCase().includes(q) ||
        (p.csm_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [visibleProjects, activeFilter, search]);

  const dashboardPath =
    user?.role === 'CSM'   ? '/csm-dashboard' :
    user?.role === 'PM'    ? '/pm-dashboard'  :
    user?.role === 'Admin' ? '/admin-dashboard' : '/sales-dashboard';

  const ROLE_LABEL: Record<string, string> = {
    Admin: 'Administrator', CSM: 'Customer Success Manager',
    PM: 'Project Manager', 'Product Manager': 'Product Manager',
    Sales: 'Sales', Client: 'Client',
  };

  const NAV_ITEMS = [
    { label: 'Dashboard', path: dashboardPath, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { label: 'All Projects', path: '/projects', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    { label: 'Analytics', path: '/analytics', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    ...(isAdmin ? [
      { label: 'Client Requests', path: '/admin-dashboard?filter=CLIENT_REQUESTS', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      { label: 'User Management', path: '/admin-dashboard?filter=USER_MANAGEMENT', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    ] : []),
  ];

  return (
    <>
      <div className="flex h-screen bg-[#F0F2F8] overflow-hidden">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        {/* ── Sidebar ── */}
        <aside className={`sidebar-drawer fixed inset-y-0 left-0 z-30 w-72 flex flex-col bg-slate-900 text-white
          lg:relative lg:translate-x-0 lg:w-64 lg:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
            <div className="flex-1">
              <p className="text-sm font-bold text-white leading-tight">Chaos</p>
              <p className="text-sm font-bold text-indigo-400 leading-tight">Coordinator</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} aria-label="Close navigation" className="lg:hidden p-1.5 text-white/40 hover:text-white rounded-md transition-colors">
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
            {NAV_ITEMS.map(item => {
              const active = item.path === '/projects';
              return (
                <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${active ? 'bg-indigo-600 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}>
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'User'}</p>
                <p className="text-xs text-white/50">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</p>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} aria-label="Sign out" className="p-1.5 text-white/30 hover:text-red-400 rounded-md transition-colors">
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">All Projects</h1>
                <p className="text-xs text-gray-400 mt-0.5">{visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} across the organisation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && <div className="bg-slate-800 rounded-lg"><NotificationBell userId={user.id} theme="light" /></div>}
              {isSalesOnly && (
                <div className="relative">
                  <span className="absolute inset-0 rounded-xl bg-indigo-400/30 animate-ping" />
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/sales/intake')}
                    className="relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-300/40 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    New Intake
                  </motion.button>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">

            {/* ── KPI strip ── */}
            <div className="px-4 sm:px-6 pt-6 pb-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiTile label="Total Projects" value={kpis.total} delay={0}
                  gradient="from-slate-700 to-slate-800"
                  subtext="all projects"
                  icon={<svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                />
                <KpiTile label="Active" value={kpis.active} delay={0.05}
                  gradient="from-green-500 to-emerald-600"
                  subtext="live & running"
                  icon={<svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <KpiTile label="At Risk" value={kpis.atRisk} delay={0.1}
                  gradient="from-red-500 to-rose-600"
                  subtext="overdue tasks"
                  pulse={kpis.atRisk > 0}
                  icon={<svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KpiTile label="Go-Live This Month" value={kpis.goLive} delay={0.15}
                  gradient="from-indigo-500 to-violet-600"
                  subtext="due this month"
                  icon={<svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                />
                <KpiTile label="Awaiting Approval" value={kpis.pending} delay={0.2}
                  gradient="from-violet-500 to-purple-700"
                  subtext="needs decision"
                  icon={<svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
              </div>
            </div>

            {/* ── Filters + search + view toggle ── */}
            <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Smart filter pills */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {SMART_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setActiveFilter(f.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                      activeFilter === f.key
                        ? f.key === 'AT_RISK' ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                          : 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600 shadow-sm'
                    }`}>
                    {f.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{f.count}</span>
                  </button>
                ))}
              </div>

              {/* Search + view toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48 shadow-sm" />
                </div>
                <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <button onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    aria-label="Grid view">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    aria-label="List view">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Project list/grid ── */}
            <div className="px-4 sm:px-6 pb-8">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading projects…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center shadow-sm">
                  <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-500">No projects found</p>
                  {search && <p className="text-xs text-gray-400 mt-1">Try a different search term</p>}
                </div>
              ) : viewMode === 'grid' ? (

                /* ── Grid view ── */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((project, i) => {
                    const cfg = STATUS_CONFIG[project.status] ?? fallbackStatus;
                    const progress = getProgress(project);
                    const overdue = getOverdueTasks(project);
                    const goLiveDays = getGoLiveDays(project);
                    const isAtRisk = overdue.length > 0;

                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        whileHover={{ y: -3, boxShadow: '0 12px 32px -6px rgba(99,102,241,0.18)' }}
                        onClick={() => setSelectedProject(project)}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer overflow-hidden group transition-all"
                      >
                        {/* Gradient top strip */}
                        <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.gradient} ${isAtRisk ? 'animate-pulse' : ''}`} />

                        <div className="p-5">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 leading-snug truncate group-hover:text-indigo-700 transition-colors">
                                {project.name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{project.client_name}</p>
                            </div>
                            <StatusBadge status={project.status} small />
                          </div>

                          {/* Progress bar */}
                          {progress !== null && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-gray-400">Progress</span>
                                <span className="text-[10px] font-bold text-gray-600">{progress}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.04 + 0.3 }}
                                  className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient}`}
                                />
                              </div>
                            </div>
                          )}

                          {/* At-risk banner */}
                          {isAtRisk && (
                            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              {overdue.length} overdue task{overdue.length > 1 ? 's' : ''}
                            </div>
                          )}

                          {/* Go-live chip */}
                          {goLiveDays !== null && (
                            <div className="mb-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                                goLiveDays < 0  ? 'bg-red-50 text-red-600'    :
                                goLiveDays <= 7 ? 'bg-amber-50 text-amber-600' :
                                                  'bg-indigo-50 text-indigo-600'
                              }`}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {goLiveDays < 0 ? `${Math.abs(goLiveDays)}d overdue` : goLiveDays === 0 ? 'Go-live today' : `Go-live in ${goLiveDays}d`}
                              </span>
                            </div>
                          )}

                          {/* Team avatars */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                            <div className="flex items-center -space-x-1.5">
                              {project.owner_name && <Avatar name={project.owner_name} color="from-blue-400 to-blue-600" size="w-6 h-6" />}
                              {project.csm_name   && <Avatar name={project.csm_name}   color="from-cyan-400 to-cyan-600"   size="w-6 h-6" />}
                              {project.pm_name    && <Avatar name={project.pm_name}    color="from-indigo-400 to-indigo-600" size="w-6 h-6" />}
                            </div>
                            <span className="text-xs text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              Open
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

              ) : (

                /* ── List view ── */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3 border-b border-gray-100 bg-gray-50/80">
                    <span>Project</span>
                    <span className="hidden sm:block w-32 text-right">Status</span>
                    <span className="hidden md:block w-28 text-right">Team</span>
                    <span className="hidden lg:block w-24 text-right">Go-Live</span>
                    <span className="w-8" />
                  </div>
                  {filtered.map((project, i) => {
                    const cfg = STATUS_CONFIG[project.status] ?? fallbackStatus;
                    const overdue = getOverdueTasks(project);
                    const goLiveDays = getGoLiveDays(project);
                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.025 }}
                        onClick={() => setSelectedProject(project)}
                        className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-5 py-3.5 border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer group transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${cfg.gradient} flex-shrink-0`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{project.name}</p>
                            <p className="text-xs text-gray-400 truncate">{project.client_name}</p>
                          </div>
                          {overdue.length > 0 && (
                            <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {overdue.length} overdue
                            </span>
                          )}
                        </div>
                        <div className="hidden sm:flex w-32 justify-end">
                          <StatusBadge status={project.status} small />
                        </div>
                        <div className="hidden md:flex w-28 justify-end -space-x-1">
                          {project.csm_name && <Avatar name={project.csm_name} color="from-cyan-400 to-cyan-600" size="w-6 h-6" />}
                          {project.pm_name  && <Avatar name={project.pm_name}  color="from-indigo-400 to-indigo-600" size="w-6 h-6" />}
                        </div>
                        <div className="hidden lg:flex w-24 justify-end">
                          {goLiveDays !== null ? (
                            <span className={`text-xs font-semibold ${goLiveDays < 0 ? 'text-red-500' : goLiveDays <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {goLiveDays < 0 ? `${Math.abs(goLiveDays)}d late` : `${goLiveDays}d`}
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                        <div className="w-8 flex justify-end">
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div className="px-5 py-3 text-xs text-gray-400 bg-gray-50/50">
                    Showing {filtered.length} of {visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Detail Drawer overlay ── */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailDrawer project={selectedProject} onClose={() => setSelectedProject(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default AllProjectsPage;
