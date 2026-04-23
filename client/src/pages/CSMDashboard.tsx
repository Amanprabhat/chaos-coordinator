import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

interface WBSTask {
  id: number;
  wbs: string;
  phase: string;
  sprint: number;
  sprint_label: string;
  sprint_week: string;
  deliverable: string;
  name: string;
  day_start: number;
  day_end: number;
  duration_days: number;
  owner_role: string;
  type?: string;
  status: string;
  tentative: boolean;
  total_working_days: number;
  planned_start?: string;
  planned_end?: string;
}

interface Project {
  id: number;
  name: string;
  client_name: string;
  status: string;
  project_type?: string;
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
  integration_details?: string;
  client_spoc_name?: string;
  client_spoc_email?: string;
  client_spoc_mobile?: string;
  business_objective?: string;
  priority?: string;
  go_live_deadline?: string;
  num_users?: string;
  success_criteria?: string;
  current_tools?: string;
  budget_range?: string;
  sow_file_path?: string;
  sow_file_name?: string;
  sow_file_size?: string;
  project_plan?: string;
  project_start_date?: string;
  stage_name?: string;
  created_at: string;
  updated_at: string;
}

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

const SPRINT_COLORS: Record<number, { header: string; badge: string; accent: string; icon: string }> = {
  0: { header: 'bg-slate-100 border-slate-200',  badge: 'bg-slate-200 text-slate-700',    accent: 'border-l-slate-400',  icon: '🔧' },
  1: { header: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700',  accent: 'border-l-indigo-400', icon: '⚙️' },
  2: { header: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-100 text-blue-700',      accent: 'border-l-blue-400',   icon: '📦' },
  3: { header: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700',    accent: 'border-l-amber-400',  icon: '🧪' },
  4: { header: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'border-l-emerald-400', icon: '🚀' },
  5: { header: 'bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700',  accent: 'border-l-violet-400', icon: '🔗' },
};

// ── Project Plan Panel ─────────────────────────────────────────────────────────

interface PlanPanelProps {
  project: Project;
  onStartDateSet: (projectId: number, date: string) => void;
}

const ProjectPlanPanel: React.FC<PlanPanelProps> = ({ project, onStartDateSet }) => {
  const [startDate, setStartDate] = useState(project.project_start_date || '');
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<WBSTask[]>([]);

  useEffect(() => {
    if (project.project_plan) {
      try { setTasks(JSON.parse(project.project_plan)); } catch { setTasks([]); }
    }
  }, [project.project_plan]);

  const sprints = tasks
    .map(t => t.sprint ?? -1)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);
  const isTentative = tasks.length > 0 && tasks[0]?.tentative;
  const totalDays = tasks[0]?.total_working_days || 30;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const overallPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleSetDate = async () => {
    if (!startDate) return;
    setSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${project.id}/set-start-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTasks(data.plan || []);
      onStartDateSet(project.id, startDate);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No project plan generated yet. Plan is created when intake is submitted.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Start date setter */}
      <div className={`rounded-2xl p-4 border ${isTentative ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isTentative ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            <svg className={`w-4 h-4 ${isTentative ? 'text-amber-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isTentative ? 'text-amber-800' : 'text-emerald-800'}`}>
              {isTentative ? 'Tentative Plan — Set Start Date to Lock In Dates' : `Plan active from ${new Date(project.project_start_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
            <p className={`text-xs mt-0.5 ${isTentative ? 'text-amber-600' : 'text-emerald-600'}`}>
              {tasks[0]?.total_working_days || 30} working days · {tasks[0]?.total_working_days === 45 ? 'Includes integration phase' : 'Standard plan'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleSetDate}
                disabled={!startDate || saving}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Set & Recalculate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Overall Progress</span>
          <span className="text-xs text-gray-500">{completedCount} / {tasks.length} tasks complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${overallPct === 100 ? 'bg-emerald-500' : inProgressCount > 0 ? 'bg-indigo-500' : 'bg-gray-400'}`}
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />{completedCount} done
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />{inProgressCount} in progress
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />{tasks.length - completedCount - inProgressCount} todo
          </span>
          <span className="text-[10px] font-bold text-gray-600 ml-auto">{overallPct}%</span>
        </div>
      </div>

      {/* WBS table grouped by sprint */}
      {sprints.map(sprintNum => {
        const sprintTasks = tasks.filter(t => (t.sprint ?? -1) === sprintNum);
        const firstTask = sprintTasks[0];
        const col = SPRINT_COLORS[sprintNum] ?? SPRINT_COLORS[0];
        const sprintLabel = firstTask?.sprint_label || `Sprint ${sprintNum}`;
        const sprintWeek = firstTask?.sprint_week || '';
        const deliverable = firstTask?.deliverable || '';
        const sprintDone = sprintTasks.filter(t => t.status === 'completed').length;
        const sprintPct = sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
        return (
          <div key={sprintNum} className={`border rounded-2xl overflow-hidden ${col.header.includes('border') ? col.header.split(' ').filter(c => c.startsWith('border-')).join(' ') : 'border-gray-200'}`}>
            {/* Sprint header */}
            <div className={`px-4 py-3 border-b ${col.header}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{col.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">{sprintLabel}</span>
                      {sprintWeek && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${col.badge}`}>{sprintWeek}</span>
                      )}
                    </div>
                    {deliverable && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-600">Deliverable:</span> {deliverable}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-500">{sprintDone}/{sprintTasks.length}</span>
                  <div className="w-16 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${sprintPct === 100 ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                      style={{ width: `${sprintPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Task rows */}
            <div className="divide-y divide-gray-50 bg-white">
              {sprintTasks.map(task => (
                <div key={task.id} className={`pl-4 pr-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-l-2 ${col.accent}`}>
                  <span className="text-[10px] font-mono text-gray-400 w-8 flex-shrink-0">{task.wbs}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.name}</p>
                    {task.planned_start ? (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(task.planned_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(task.planned_end!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        <span className="ml-1 text-gray-300">({task.duration_days}d)</span>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-400 mt-0.5">Day {task.day_start}–{task.day_end} · set start date to lock in</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      task.owner_role === 'CSM' ? 'bg-cyan-50 text-cyan-700' :
                      task.owner_role === 'PM' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{task.owner_role}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      task.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      task.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {task.status === 'completed' ? '✓ done' : task.status === 'in_progress' ? '⚡ active' : 'todo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Plan panel with generate-plan fallback ────────────────────────────────────

const ProjectPlanPanelWithGenerate: React.FC<{
  project: Project;
  onStartDateSet: (id: number, date: string) => void;
  onPlanGenerated: (p: Project) => void;
}> = ({ project, onStartDateSet, onPlanGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [localProject, setLocalProject] = useState(project);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${project.id}/generate-plan`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const updated = { ...localProject, project_plan: JSON.stringify(data.plan) };
      setLocalProject(updated);
      onPlanGenerated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  if (!localProject.project_plan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">No project plan yet</p>
          <p className="text-xs text-gray-400 mt-1">This project was created before plan generation was enabled.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {generating
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
            : <>Generate Sprint Plan</>
          }
        </button>
      </div>
    );
  }

  return <ProjectPlanPanel project={localProject} onStartDateSet={onStartDateSet} />;
};

// ── Project detail drawer ──────────────────────────────────────────────────────

interface DrawerProps {
  project: Project;
  userRole: string;
  onClose: () => void;
  onStartDateSet: (id: number, date: string) => void;
}

const ProjectDrawer: React.FC<DrawerProps> = ({ project, userRole, onClose, onStartDateSet }) => {
  const [tab, setTab] = useState<'info' | 'plan' | 'checklist'>('info');
  const [sowUploading, setSowUploading] = useState(false);
  const [sowMsg, setSowMsg] = useState('');
  const [localProject, setLocalProject] = useState(project);
  const fmt = (v?: string | null) => v || '—';
  const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const handleSowUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSowUploading(true);
    setSowMsg('');
    try {
      const fd = new FormData();
      fd.append('sow_file', file);
      const noSow = !localProject.sow_file_path;
      const url = `${process.env.REACT_APP_API_URL || ""}/api/projects/${project.id}/upload-sow${noSow ? '?resubmit=true' : ''}`;
      const res = await fetch(url, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLocalProject(data.project);
      setSowMsg(data.message);
      if (data.resubmitted) onStartDateSet(project.id, localProject.project_start_date || '');
    } catch (err: any) {
      setSowMsg(err.message);
    } finally {
      setSowUploading(false);
    }
  };

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
        className="w-full max-w-2xl bg-white h-full overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <StatusBadge status={project.status} />
                {project.priority && (
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    project.priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                    project.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    project.priority === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>{project.priority}</span>
                )}
                {project.project_type && (
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">{project.project_type}</span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{project.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{project.client_name}</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-gray-100 rounded-xl p-1">
            {([
              { key: 'info',      label: 'Project Info'     },
              { key: 'plan',      label: 'WBS Plan'         },
              { key: 'checklist', label: '✓ Checklist'      },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'info' && (
            <div className="space-y-5">
              {/* Business objective */}
              {project.business_objective && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Business Objective</p>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{project.business_objective}</p>
                  </div>
                </div>
              )}

              {/* Client info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Client</p>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                  {[
                    { label: 'Client Name',   value: fmt(project.client_name) },
                    { label: 'SPOC',          value: fmt(project.client_spoc_name) },
                    { label: 'SPOC Email',    value: fmt(project.client_spoc_email) },
                    { label: 'SPOC Mobile',   value: fmt(project.client_spoc_mobile) },
                    { label: 'Num. Users',    value: fmt(project.num_users) },
                    { label: 'Current Tools', value: fmt(project.current_tools) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800 text-right ml-4 max-w-xs break-all">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Team</p>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                  {[
                    { label: 'Sales Owner',  value: fmt(project.owner_name)             },
                    { label: 'CSM',          value: fmt(project.csm_name)               },
                    { label: 'PM',           value: fmt(project.pm_name)                },
                    { label: 'Product',      value: fmt(project.product_manager_name)   },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project details */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Project Details</p>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                  {[
                    { label: 'Type',              value: fmt(project.project_type)       },
                    { label: 'Deployment Region', value: fmt(project.deployment_region)  },
                    { label: 'Deployment Type',   value: fmt(project.deployment_type)    },
                    { label: 'SSO Required',      value: project.sso_required ? 'Yes' : 'No' },
                    { label: 'Expected Timeline', value: fmt(project.expected_timeline)  },
                    { label: 'Go-Live Deadline',  value: fmtDate(project.go_live_deadline) },
                    { label: 'Budget Range',      value: fmt(project.budget_range)       },
                    { label: 'Priority',          value: fmt(project.priority)           },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-medium text-gray-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              {(project.integrations_required || project.integration_details) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Integrations</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-2">
                    {project.integrations_required && <p className="text-sm text-gray-700">{project.integrations_required}</p>}
                    {project.integration_details && <p className="text-sm text-gray-600 text-xs">{project.integration_details}</p>}
                  </div>
                </div>
              )}

              {/* Success criteria */}
              {project.success_criteria && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Success Criteria</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-700">{project.success_criteria}</p>
                  </div>
                </div>
              )}

              {/* SOW */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Statement of Work (SOW)</p>
                {localProject.sow_file_path ? (
                  <div className="space-y-2">
                    <a
                      href={`${process.env.REACT_APP_API_URL || ""}/api/projects/${project.id}/download-sow`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-indigo-700 truncate">{localProject.sow_file_name || 'SOW Document'}</p>
                        <p className="text-xs text-indigo-400 mt-0.5">{localProject.sow_file_size || ''} · Click to download</p>
                      </div>
                      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors w-fit text-xs font-medium text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {sowUploading ? 'Uploading…' : 'Replace SOW'}
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={handleSowUpload} disabled={sowUploading} />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">⚠ SOW Missing</p>
                      <p className="text-xs text-amber-600">Upload the SOW to resubmit this project for admin approval. The project will be put on hold until approved.</p>
                    </div>
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${sowUploading ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'}`}>
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-sm font-semibold text-indigo-600">{sowUploading ? 'Uploading…' : 'Upload SOW & Resubmit for Approval'}</span>
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={handleSowUpload} disabled={sowUploading} />
                    </label>
                  </div>
                )}
                {sowMsg && (
                  <p className={`text-xs mt-2 font-medium ${sowMsg.includes('fail') || sowMsg.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>{sowMsg}</p>
                )}
              </div>

              {/* MOM */}
              {project.mom_text && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meeting Minutes (MoM)</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.mom_text}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'plan' && (
            <ProjectPlanPanelWithGenerate project={localProject} onStartDateSet={onStartDateSet} onPlanGenerated={p => setLocalProject(p)} />
          )}

          {tab === 'checklist' && (
            <div className="py-2">
              <p className="text-xs text-gray-400 px-1 mb-3">Track your delivery steps for <span className="font-semibold text-gray-600">{project.name}</span>. Progress is saved per project.</p>
              <RoleChecklist
                isCSM={userRole === 'CSM'}
                isProduct={userRole === 'Product'}
                userId={undefined}
                userRole={`proj_${project.id}`}
                hideHeader
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Interfaces for tasks / milestones ─────────────────────────────────────────

interface Task {
  id: number;
  title: string;
  status: string;
  due_date?: string;
  completion_date?: string;
  project_id?: number;
  project_name?: string;
}

interface Milestone {
  id: number;
  name: string;
  status: string;
  due_date?: string;
  project_id: number;
  project_name?: string;
}

// ── Tour steps ─────────────────────────────────────────────────────────────────
const CSM_TOUR_STEPS = [
  {
    id: 'sidebar',
    title: 'Your Navigation Hub',
    description: 'Switch between your dashboard and all projects. Your role and assignment info is always visible at the bottom.',
    position: 'right' as const,
    anchor: 'csm_sidebar',
  },
  {
    id: 'stats',
    title: 'Your Project Overview',
    description: 'See all projects assigned to you — incoming for review, approved and ready to start, and currently active.',
    position: 'bottom' as const,
    anchor: 'csm_stats',
  },
  {
    id: 'projects',
    title: 'Project Cards',
    description: 'Click any project to see full details, WBS plan, and documents. Set start dates directly from the card for approved projects.',
    position: 'bottom' as const,
    anchor: 'csm_projects',
  },
  {
    id: 'rightpanel',
    title: 'Your Action Panel',
    description: 'Incoming projects, overdue items, your tasks with click-to-update status, and upcoming milestones — all in one place.',
    position: 'left' as const,
    anchor: 'csm_rightpanel',
  },
];

// ── Welcome modal ──────────────────────────────────────────────────────────────
interface WelcomeModalProps {
  name: string;
  role: string;
  onDismiss: () => void;
  onStartTour: () => void;
}

const CSMWelcomeModal: React.FC<WelcomeModalProps> = ({ name, role, onDismiss, onStartTour }) => {
  const firstName = name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isCSM = role === 'CSM';
  const isProduct = role === 'Product';

  const gradientBar = isCSM
    ? 'bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500'
    : isProduct
    ? 'bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-600'
    : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600';

  const iconGradient = isCSM
    ? 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-200'
    : isProduct
    ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-fuchsia-200'
    : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200';

  const accentColor = isCSM ? 'text-teal-600' : isProduct ? 'text-fuchsia-600' : 'text-indigo-600';
  const btnColor = isCSM ? 'bg-teal-600 hover:bg-teal-700' : isProduct ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'bg-indigo-600 hover:bg-indigo-700';

  const dashboardName = isCSM ? 'Customer Success' : isProduct ? 'Product Management' : 'Project Management';
  const tagline = isCSM
    ? 'Manage your assigned projects, track UAT progress, and keep clients on track to go-live.'
    : isProduct
    ? 'Own requirements, define product specs, support UAT, and drive successful product launches.'
    : 'Configure, build, and deliver projects — track tasks, milestones, and WBS plans from one place.';

  const highlights = isCSM
    ? [
        { icon: '📦', label: 'See incoming projects assigned to you' },
        { icon: '📅', label: 'Set start dates to activate project plans' },
        { icon: '✅', label: 'Track tasks, milestones & UAT sign-offs' },
      ]
    : isProduct
    ? [
        { icon: '📝', label: 'Manage requirements and user stories per project' },
        { icon: '🎯', label: 'Define product specs and prioritise the backlog' },
        { icon: '🚀', label: 'Support UAT and drive launch readiness' },
      ]
    : [
        { icon: '⚙️', label: 'Configure systems and manage workflows' },
        { icon: '🔗', label: 'Handle integrations and technical setup' },
        { icon: '📊', label: 'Monitor WBS tasks and project progress' },
      ];

  const iconPath = isCSM
    ? 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
    : isProduct
    ? 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z'
    : 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';

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
        <div className={`h-2 ${gradientBar}`} />
        <div className="px-8 py-8">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${iconGradient}`}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={iconPath} />
            </svg>
          </div>
          <p className={`text-sm font-semibold mb-1 ${accentColor}`}>{greeting},</p>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">{firstName} 👋</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Welcome to your <span className="font-semibold text-gray-700">{dashboardName} Dashboard</span>. {tagline}
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-2.5">
            {highlights.map(item => (
              <div key={item.label} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={onStartTour} className={`flex-1 py-3 text-white text-sm font-semibold rounded-xl transition-colors ${btnColor}`}>
              Show me around
            </button>
            <button onClick={onDismiss} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">
              Let's go
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Tour tooltip ────────────────────────────────────────────────────────────────
interface TourTooltipProps {
  step: typeof CSM_TOUR_STEPS[number];
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const CSMTourTooltip: React.FC<TourTooltipProps> = ({ step, stepIndex, totalSteps, targetRect, onNext, onPrev, onSkip }) => {
  if (!targetRect) return null;
  const W = 280, H = 160, GAP = 16;
  let top = 0, left = 0;
  switch (step.position) {
    case 'right':  top = targetRect.top + targetRect.height / 2 - H / 2; left = targetRect.right + GAP; break;
    case 'left':   top = targetRect.top + targetRect.height / 2 - H / 2; left = targetRect.left - W - GAP; break;
    case 'bottom': top = targetRect.bottom + GAP; left = targetRect.left + targetRect.width / 2 - W / 2; break;
    default:       top = targetRect.top - H - GAP; left = targetRect.left + targetRect.width / 2 - W / 2;
  }
  top  = Math.max(12, Math.min(top,  window.innerHeight - H - 12));
  left = Math.max(12, Math.min(left, window.innerWidth  - W - 12));

  return (
    <>
      <div className="fixed inset-0 z-40 pointer-events-none bg-slate-900/40" />
      {targetRect && (
        <div className="fixed z-40 pointer-events-none rounded-2xl ring-4 ring-teal-500 ring-offset-2"
          style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8, boxShadow: '0 0 0 9999px rgba(15,23,42,0.45)' }}
        />
      )}
      <motion.div key={step.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }} className="fixed z-50 bg-white rounded-2xl shadow-2xl p-5" style={{ top, left, width: W }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === stepIndex ? 'w-5 bg-teal-500' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>
          <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Skip tour</button>
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1.5">{step.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.description}</p>
        <div className="flex items-center justify-between">
          <button onClick={onPrev} disabled={stepIndex === 0} className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-0 transition-colors">← Back</button>
          <button onClick={onNext} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors">
            {stepIndex === totalSteps - 1 ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </motion.div>
    </>
  );
};

// ── Role Checklist ────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = {
  CSM: [
    { id: 'start_date',   category: 'Setup',     label: 'Set project start date',                   icon: '📅', color: 'text-blue-600 bg-blue-50 border-blue-200'         },
    { id: 'uat_prep',     category: 'Testing',   label: 'Prepare UAT plan & user stories',          icon: '🧪', color: 'text-violet-600 bg-violet-50 border-violet-200'   },
    { id: 'uat_run',      category: 'Testing',   label: 'Execute UAT with business users',          icon: '✅', color: 'text-violet-600 bg-violet-50 border-violet-200'   },
    { id: 'training',     category: 'Delivery',  label: 'Schedule end-user training sessions',      icon: '🎓', color: 'text-teal-600 bg-teal-50 border-teal-200'           },
    { id: 'content',      category: 'Delivery',  label: 'Complete content transformation sign-off', icon: '📝', color: 'text-teal-600 bg-teal-50 border-teal-200'           },
    { id: 'mom',          category: 'Client',    label: 'Follow up on open MoM action items',       icon: '💬', color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    { id: 'golive',       category: 'Go-Live',   label: 'Confirm go-live readiness with client',    icon: '🚀', color: 'text-green-600 bg-green-50 border-green-200'       },
    { id: 'signoff',      category: 'Go-Live',   label: 'Get stakeholder sign-off',                 icon: '✍️', color: 'text-green-600 bg-green-50 border-green-200'       },
  ],
  PM: [
    { id: 'env_setup',    category: 'Setup',     label: 'Set up UAT & Prod environments',           icon: '🖥️', color: 'text-blue-600 bg-blue-50 border-blue-200'         },
    { id: 'sso',          category: 'Setup',     label: 'Configure SSO authentication',             icon: '🔐', color: 'text-blue-600 bg-blue-50 border-blue-200'           },
    { id: 'migration',    category: 'Migration', label: 'Develop & execute migration script',       icon: '🔄', color: 'text-indigo-600 bg-indigo-50 border-indigo-200'     },
    { id: 'roles',        category: 'Config',    label: 'Configure user roles & permissions',       icon: '👥', color: 'text-violet-600 bg-violet-50 border-violet-200'    },
    { id: 'workflow',     category: 'Config',    label: 'Complete workflow configuration',          icon: '⚙️', color: 'text-violet-600 bg-violet-50 border-violet-200'    },
    { id: 'sit',          category: 'Testing',   label: 'Execute System Integration Testing',       icon: '🧪', color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    { id: 'integration',  category: 'Testing',   label: 'Run end-to-end integration testing',       icon: '🔗', color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    { id: 'deploy',       category: 'Go-Live',   label: 'Deploy to production environment',         icon: '🚀', color: 'text-green-600 bg-green-50 border-green-200'       },
  ],
  Product: [
    { id: 'req_gather',   category: 'Discovery', label: 'Gather & document business requirements',  icon: '🔍', color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200' },
    { id: 'user_stories', category: 'Discovery', label: 'Write user stories with acceptance criteria',icon: '📝', color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200'},
    { id: 'req_signoff',  category: 'Discovery', label: 'Get requirement sign-off from client SPOC',icon: '✅', color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200' },
    { id: 'spec',         category: 'Spec',      label: 'Define product spec and feature scope',    icon: '📐', color: 'text-violet-600 bg-violet-50 border-violet-200'    },
    { id: 'backlog',      category: 'Spec',      label: 'Prioritise backlog with PM & CSM',         icon: '🎯', color: 'text-violet-600 bg-violet-50 border-violet-200'    },
    { id: 'uat_support',  category: 'Testing',   label: 'Attend UAT & validate feature behaviour',  icon: '🧪', color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    { id: 'defects',      category: 'Testing',   label: 'Triage defects and clarify product scope', icon: '🐛', color: 'text-amber-600 bg-amber-50 border-amber-200'       },
    { id: 'launch',       category: 'Launch',    label: 'Confirm product readiness & release notes',icon: '🚀', color: 'text-green-600 bg-green-50 border-green-200'       },
  ],
};

// Tiny progress pill shown in the collapsed header button
const RoleChecklistProgress: React.FC<{ isCSM: boolean; isProduct?: boolean; userId?: number; userRole?: string }> = ({ isCSM, isProduct, userId, userRole }) => {
  const key = `cc_checklist_${userId}_${userRole}`;
  const items = isCSM ? CHECKLIST_ITEMS.CSM : isProduct ? CHECKLIST_ITEMS.Product : CHECKLIST_ITEMS.PM;
  const [checked] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  });
  const done = items.filter(i => checked[i.id]).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <div className="flex items-center gap-2">
      {pct === 100
        ? <span className="text-xs font-bold text-white">🎉 All done!</span>
        : <span className="text-xs font-semibold text-white/80">{done}/{items.length} done</span>
      }
      <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const RoleChecklist: React.FC<{ isCSM: boolean; isProduct?: boolean; userId?: number; userRole?: string; hideHeader?: boolean }> = ({ isCSM, isProduct, userId, userRole, hideHeader }) => {
  const checklistKey = `cc_checklist_${userId}_${userRole}`;
  const items = isCSM ? CHECKLIST_ITEMS.CSM : isProduct ? CHECKLIST_ITEMS.Product : CHECKLIST_ITEMS.PM;

  const [checked, setChecked] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(checklistKey) || '{}'); } catch { return {}; }
  });

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(checklistKey, JSON.stringify(next));
  };

  const doneCount = items.filter(i => checked[i.id]).length;
  const pct = Math.round((doneCount / items.length) * 100);

  // When used inside the collapsible banner (hideHeader=true), render as a 2-column grid
  if (hideHeader) {
    return (
      <div className="px-5 py-4">
        {pct === 100 && (
          <p className="text-xs text-center text-emerald-600 font-semibold mb-3">🎉 All items complete — great delivery work!</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                checked[item.id]
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-100 hover:border-gray-200 hover:bg-white'
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                checked[item.id] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
              }`}>
                {checked[item.id] && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-snug truncate ${checked[item.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {item.label}
                </p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${item.color}`}>
                  {item.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Standalone version (not used currently but kept for flexibility)
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className={`px-4 py-3 ${isCSM ? 'bg-gradient-to-r from-teal-600 to-cyan-600' : isProduct ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-white uppercase tracking-wide">
            {isCSM ? 'CSM Delivery Checklist' : isProduct ? 'Product Checklist' : 'PM Build Checklist'}
          </p>
          <span className="text-xs font-bold text-white/80">{doneCount}/{items.length}</span>
        </div>
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <motion.div className="h-full bg-white rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
        {pct === 100 && <p className="text-[10px] text-white/80 mt-1.5 text-center">🎉 All done — great work!</p>}
      </div>
      <div className="divide-y divide-gray-50">
        {items.map(item => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${checked[item.id] ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked[item.id] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
              {checked[item.id] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium leading-snug ${checked[item.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5 inline-block ${item.color}`}>{item.category}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Standard Delivery Approach (reference guide — no checkboxes, no progress) ──

const STANDARD_APPROACH_CSM = [
  {
    key: 'kickoff',
    phase: '01',
    label: 'Project Kickoff',
    color: 'border-blue-200 bg-blue-50',
    headerColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700',
    steps: [
      { icon: '📅', text: 'Confirm project start date and align team calendar' },
      { icon: '👥', text: 'Introduce all stakeholders — client SPOC, PM, Product Manager' },
      { icon: '📋', text: 'Review and validate the SOW scope with the client' },
      { icon: '🎯', text: 'Set success criteria and go-live milestone dates' },
    ],
  },
  {
    key: 'config',
    phase: '02',
    label: 'Configuration & Setup',
    color: 'border-indigo-200 bg-indigo-50',
    headerColor: 'text-indigo-700',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    steps: [
      { icon: '🔧', text: 'Coordinate environment setup with PM (UAT + Prod)' },
      { icon: '📝', text: 'Review user role structure and permissions with client' },
      { icon: '🔗', text: 'Confirm integration requirements and third-party access' },
      { icon: '💬', text: 'Schedule weekly sync cadence with client stakeholders' },
    ],
  },
  {
    key: 'uat',
    phase: '03',
    label: 'Testing & UAT',
    color: 'border-violet-200 bg-violet-50',
    headerColor: 'text-violet-700',
    badgeColor: 'bg-violet-100 text-violet-700',
    steps: [
      { icon: '🧪', text: 'Prepare UAT plan with business user scenarios' },
      { icon: '📊', text: 'Track UAT defects and prioritise resolutions with PM' },
      { icon: '✅', text: 'Execute UAT sessions with business users' },
      { icon: '📝', text: 'Capture and circulate MoM after every session' },
    ],
  },
  {
    key: 'golive',
    phase: '04',
    label: 'Training & Go-Live',
    color: 'border-green-200 bg-green-50',
    headerColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-700',
    steps: [
      { icon: '🎓', text: 'Schedule and conduct end-user training sessions' },
      { icon: '📄', text: 'Complete content transformation sign-off with client' },
      { icon: '🚀', text: 'Confirm go-live readiness checklist with all parties' },
      { icon: '✍️', text: 'Obtain stakeholder sign-off and go-live approval' },
    ],
  },
];

const STANDARD_APPROACH_PM = [
  {
    key: 'setup',
    phase: '01',
    label: 'Environment Setup',
    color: 'border-blue-200 bg-blue-50',
    headerColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-700',
    steps: [
      { icon: '🖥️', text: 'Provision UAT and Production environments' },
      { icon: '🔐', text: 'Configure SSO authentication and access policies' },
      { icon: '🛡️', text: 'Set up monitoring, alerting, and backup policies' },
      { icon: '📋', text: 'Document environment credentials and share with team' },
    ],
  },
  {
    key: 'build',
    phase: '02',
    label: 'Build & Configuration',
    color: 'border-indigo-200 bg-indigo-50',
    headerColor: 'text-indigo-700',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    steps: [
      { icon: '🔄', text: 'Develop and validate data migration scripts' },
      { icon: '👥', text: 'Configure user roles, permissions, and workflows' },
      { icon: '⚙️', text: 'Complete module-level configuration per SOW scope' },
      { icon: '🔗', text: 'Build and test third-party integration endpoints' },
    ],
  },
  {
    key: 'testing',
    phase: '03',
    label: 'Integration Testing',
    color: 'border-amber-200 bg-amber-50',
    headerColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-700',
    steps: [
      { icon: '🧪', text: 'Execute System Integration Testing (SIT)' },
      { icon: '🔗', text: 'Run end-to-end integration and regression testing' },
      { icon: '🐛', text: 'Triage and resolve critical and high-priority defects' },
      { icon: '📊', text: 'Prepare SIT sign-off report for CSM and client' },
    ],
  },
  {
    key: 'deploy',
    phase: '04',
    label: 'Production Deployment',
    color: 'border-green-200 bg-green-50',
    headerColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-700',
    steps: [
      { icon: '🚀', text: 'Execute production deployment runbook' },
      { icon: '✅', text: 'Run smoke tests and post-deployment validation' },
      { icon: '📈', text: 'Monitor system health during hypercare period' },
      { icon: '📝', text: 'Hand over runbooks and documentation to client' },
    ],
  },
];

const STANDARD_APPROACH_PRODUCT = [
  {
    key: 'discovery',
    phase: '01',
    label: 'Discovery & Requirements',
    color: 'border-fuchsia-200 bg-fuchsia-50',
    headerColor: 'text-fuchsia-700',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-700',
    steps: [
      { icon: '🔍', text: 'Gather and document business requirements from stakeholders' },
      { icon: '📝', text: 'Write user stories and acceptance criteria for all features' },
      { icon: '🗺️', text: 'Map current workflows and identify gaps with new system' },
      { icon: '✅', text: 'Get requirement sign-off from client SPOC' },
    ],
  },
  {
    key: 'spec',
    phase: '02',
    label: 'Product Specification',
    color: 'border-violet-200 bg-violet-50',
    headerColor: 'text-violet-700',
    badgeColor: 'bg-violet-100 text-violet-700',
    steps: [
      { icon: '📐', text: 'Define detailed product specs and feature scope per SOW' },
      { icon: '🎯', text: 'Prioritise backlog items with PM and CSM' },
      { icon: '🔗', text: 'Specify integration requirements and data flows' },
      { icon: '🖼️', text: 'Review wireframes or flow designs with stakeholders' },
    ],
  },
  {
    key: 'review',
    phase: '03',
    label: 'Review & UAT Support',
    color: 'border-amber-200 bg-amber-50',
    headerColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-700',
    steps: [
      { icon: '🧪', text: 'Attend UAT sessions and validate feature behaviour' },
      { icon: '🐛', text: 'Triage defects and clarify expected product behaviour' },
      { icon: '📋', text: 'Review SIT results and confirm scope completion' },
      { icon: '✍️', text: 'Sign off on UAT completion with CSM and client' },
    ],
  },
  {
    key: 'launch',
    phase: '04',
    label: 'Launch Readiness',
    color: 'border-emerald-200 bg-emerald-50',
    headerColor: 'text-emerald-700',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    steps: [
      { icon: '📦', text: 'Confirm product readiness checklist with all teams' },
      { icon: '📢', text: 'Prepare product release notes and change summaries' },
      { icon: '🚀', text: 'Support go-live handover and hyper-care planning' },
      { icon: '🔁', text: 'Conduct post-launch retrospective and capture learnings' },
    ],
  },
];

const StandardApproachGuide: React.FC<{ role: 'CSM' | 'PM' | 'Product' }> = ({ role }) => {
  const phases = role === 'CSM' ? STANDARD_APPROACH_CSM : role === 'Product' ? STANDARD_APPROACH_PRODUCT : STANDARD_APPROACH_PM;
  const title = role === 'CSM' ? 'CSM Standard Delivery Approach' : role === 'Product' ? 'Product Standard Approach' : 'PM Standard Build Approach';
  const subtitle = role === 'CSM'
    ? 'Reference guide for every client engagement — follow these phases on all projects'
    : role === 'Product'
    ? 'Reference guide for every product engagement — requirements, specs, UAT support & launch'
    : 'Reference guide for every implementation build — follow these phases on all projects';

  return (
    <div className="mb-6">
      <div className="mb-3">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {phases.map((phase, phaseIdx) => (
          <div key={phase.key} className={`rounded-2xl border p-3 ${phase.color}`}>
            {/* Phase header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${phase.badgeColor}`}>
                Phase {phase.phase}
              </span>
              {phaseIdx < phases.length - 1 && (
                <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
            <p className={`text-[11px] font-bold uppercase tracking-wide mb-2.5 ${phase.headerColor}`}>
              {phase.label}
            </p>
            <div className="space-y-1.5">
              {phase.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[11px] flex-shrink-0 mt-0.5">{step.icon}</span>
                  <p className="text-[11px] text-gray-600 leading-snug">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main CSM/PM Dashboard ──────────────────────────────────────────────────────

const CSMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [quickDates, setQuickDates] = useState<Record<number, string>>({});
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // CR Requests state
  const [crRequests, setCrRequests]     = useState<any[]>([]);
  const [crReviewModal, setCrReviewModal] = useState<{ req: any; projectId: number } | null>(null);
  const [crRejectTarget, setCrRejectTarget] = useState<{ req: any; projectId: number } | null>(null);
  const [crForm, setCrForm] = useState({ csm_notes: '', mom_attendees: '', mom_file_path: '' });
  const [crSubmitting, setCrSubmitting] = useState(false);

  // Welcome + tour
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive,  setTourActive]  = useState(false);
  const [tourStep,    setTourStep]    = useState(0);
  const [tourRect,    setTourRect]    = useState<DOMRect | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarRef     = useRef<HTMLElement>(null);
  const statsRef       = useRef<HTMLDivElement>(null);
  const projectsRef    = useRef<HTMLDivElement>(null);
  const rightPanelRef  = useRef<HTMLElement>(null);

  const tourRefs: Record<string, React.RefObject<any>> = {
    csm_sidebar:    sidebarRef,
    csm_stats:      statsRef,
    csm_projects:   projectsRef,
    csm_rightpanel: rightPanelRef,
  };

  const isCSM            = user?.role === 'CSM';
  const isPM             = user?.role === 'PM';
  const isProductManager = isPM && user?.department === 'Product';
  const isProjectManager = isPM && user?.department === 'Project Management';
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() ?? 'U';

  const fetchAll = async () => {
    try {
      const [projRes, taskRes, msRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects`),
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/tasks?owner_id=${user?.id}`),
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/milestones`),
      ]);
      const [projData, taskData, msData] = await Promise.all([
        projRes.json(), taskRes.json(), msRes.json(),
      ]);
      setProjects(Array.isArray(projData) ? projData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setMilestones(Array.isArray(msData) ? msData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.id) fetchAll(); }, [user?.id]);

  // Show welcome on first visit (session)
  useEffect(() => {
    const seen = sessionStorage.getItem('cc_csm_welcome_shown');
    if (!seen) setShowWelcome(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => { document.body.classList.remove('sidebar-open'); };
  }, [sidebarOpen]);

  // Update tour target rect when step changes
  useEffect(() => {
    if (!tourActive) return;
    const step = CSM_TOUR_STEPS[tourStep];
    const ref = tourRefs[step.anchor];
    if (ref?.current) {
      setTourRect(ref.current.getBoundingClientRect());
    }
  }, [tourStep, tourActive]);

  const startTour = () => {
    setShowWelcome(false);
    sessionStorage.setItem('cc_csm_welcome_shown', '1');
    setTourActive(true);
    setTourStep(0);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    sessionStorage.setItem('cc_csm_welcome_shown', '1');
  };

  const nextTourStep = () => {
    if (tourStep < CSM_TOUR_STEPS.length - 1) {
      setTourStep(s => s + 1);
    } else {
      setTourActive(false);
    }
  };

  const prevTourStep = () => setTourStep(s => Math.max(0, s - 1));
  const skipTour = () => setTourActive(false);

  // Only show fully approved/active projects as real work items
  const myProjects = projects.filter(p => {
    const relevant = ['APPROVED', 'ACTIVE'].includes(p.status);
    if (!relevant) return false;
    if (isCSM) return p.csm_id === user?.id;
    if (isPM)  return p.pm_id === user?.id || p.product_manager_id === user?.id;
    return true;
  });

  // Fetch CR requests needing CSM review (declared after myProjects to avoid forward reference)
  const fetchCRRequests = useCallback(async () => {
    if (!isCSM) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/client-requests/all`);
      if (!res.ok) return;
      const all: any[] = await res.json();
      const myPids = new Set(myProjects.map((p: any) => p.id));
      const crReview = all.filter((r: any) =>
        myPids.has(r.project_id) &&
        (r.approval_stage === 'csm_review' || (!['change_request','new_requirement'].includes(r.request_type) && r.is_team_visible))
      );
      setCrRequests(crReview);
    } catch (e) { console.error(e); }
  }, [isCSM, myProjects]);

  useEffect(() => { if (myProjects.length > 0) fetchCRRequests(); }, [myProjects.length, fetchCRRequests]);

  // Pre-approval projects shown as "Coming Soon" — read-only, no actions
  const comingSoonProjects = projects.filter(p => {
    const relevant = ['INTAKE_CREATED', 'MEETING_SCHEDULED', 'MEETING_COMPLETED', 'HANDOVER_PENDING', 'AWAITING_APPROVAL'].includes(p.status);
    if (!relevant) return false;
    if (isCSM) return p.csm_id === user?.id;
    if (isPM)  return p.pm_id === user?.id || p.product_manager_id === user?.id;
    return true;
  });

  const filtered = activeFilter === 'ALL'
    ? myProjects
    : myProjects.filter(p => p.status === activeFilter);

  const stats = {
    total:    myProjects.length,
    approved: myProjects.filter(p => p.status === 'APPROVED').length,
    active:   myProjects.filter(p => p.status === 'ACTIVE').length,
    needPlan: myProjects.filter(p => p.status === 'APPROVED' && !p.project_start_date).length,
    comingSoon: comingSoonProjects.length,
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const tasksDueToday  = tasks.filter(t => t.due_date && t.due_date.startsWith(todayStr) && t.status !== 'completed').length;
  const tasksOverdue   = tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'completed').length;
  const upcomingMilestoneCount = milestones.filter(m => {
    const mypids = new Set(myProjects.map(p => p.id));
    return mypids.has(m.project_id) && m.status !== 'completed' && m.due_date &&
      (new Date(m.due_date).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 &&
      new Date(m.due_date).getTime() >= Date.now();
  }).length;

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function getWbsProgress(project: Project): { done: number; total: number; pct: number } {
    if (!project.project_plan) return { done: 0, total: 0, pct: 0 };
    try {
      const tasks: WBSTask[] = JSON.parse(project.project_plan);
      const trackable = tasks.filter(t => t.type === 'Task' || t.type === 'Deliverable' || t.type === 'Milestone');
      const done = trackable.filter(t => t.status === 'completed').length;
      const pct = trackable.length > 0 ? Math.round((done / trackable.length) * 100) : 0;
      return { done, total: trackable.length, pct };
    } catch { return { done: 0, total: 0, pct: 0 }; }
  }

  function getDaysUntilDeadline(deadline?: string): number | null {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  }

  const handleCsmApprove = async () => {
    if (!crReviewModal) return;
    const { req, projectId } = crReviewModal;
    setCrSubmitting(true);
    try {
      const attendeesArr = crForm.mom_attendees.split(',').map(s => s.trim()).filter(Boolean);
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${projectId}/client-requests/${req.id}/csm-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          csm_notes: crForm.csm_notes,
          mom_attendees: JSON.stringify(attendeesArr),
          mom_file_path: crForm.mom_file_path,
          csm_user_id: user?.id,
        }),
      });
      setCrReviewModal(null);
      setCrForm({ csm_notes: '', mom_attendees: '', mom_file_path: '' });
      fetchCRRequests();
    } finally { setCrSubmitting(false); }
  };

  const handleCsmReject = async (req: any, projectId: number) => {
    setCrSubmitting(true);
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${projectId}/client-requests/${req.id}/csm-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', csm_user_id: user?.id }),
      });
      setCrRejectTarget(null);
      fetchCRRequests();
    } finally { setCrSubmitting(false); }
  };

  const handleQuickStart = async (projectId: number) => {
    const date = quickDates[projectId];
    if (!date) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${projectId}/set-start-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: date }),
      });
      if (!res.ok) return;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, project_start_date: date, status: 'ACTIVE' } : p));
      setQuickDates(prev => { const n = {...prev}; delete n[projectId]; return n; });
    } catch (e) { console.error(e); }
  };

  const TASK_STATUS_CYCLE: Record<string, string> = {
    todo: 'in_progress',
    in_progress: 'completed',
    completed: 'todo',
  };

  const updateTaskStatus = async (taskId: number, currentStatus: string) => {
    const next = TASK_STATUS_CYCLE[currentStatus] ?? 'in_progress';
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: next,
          ...(next === 'completed' ? { completion_date: new Date().toISOString().split('T')[0] } : {}),
        }),
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
    } catch (e) { console.error(e); }
  };

  const NAV_ITEMS = [
    {
      label: 'Dashboard',
      path: isCSM ? '/csm-dashboard' : '/pm-dashboard',
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

  const FILTERS = [
    { key: 'ALL',      label: 'All'            },
    { key: 'APPROVED', label: 'Ready to Start' },
    { key: 'ACTIVE',   label: 'Active'         },
    { key: 'AT_RISK',  label: 'At Risk'        },
  ];

  // ── At-Risk helpers (CSM scope — only their projects) ──────────────────────
  function computeCSMRiskSignals(project: Project): { signals: { label: string; severity: string }[]; riskScore: number } {
    let wbsTasks: WBSTask[] = [];
    try { const p = JSON.parse((project as any).project_plan || '[]'); wbsTasks = Array.isArray(p) ? p : []; } catch {}
    const allT    = wbsTasks.filter(t => t.type === 'Task' || t.type === 'Deliverable');
    const blocked = allT.filter(t => t.status === 'blocked').length;
    const completed = allT.filter(t => t.status === 'completed').length;
    const progress  = allT.length > 0 ? Math.round((completed / allT.length) * 100) : 0;
    const clientPending = wbsTasks.filter(t =>
      (t.owner_role === 'Client' || t.type === 'Client Requirement') && t.status !== 'completed'
    ).length;

    const signals: { label: string; severity: string }[] = [];
    let riskScore = 0;
    if (blocked > 0)        { signals.push({ label: `${blocked} blocked`, severity: 'high' });   riskScore += blocked * 20; }
    if (!(project as any).project_start_date && project.status === 'ACTIVE')
                             { signals.push({ label: 'No start date', severity: 'high' });        riskScore += 30; }
    if (clientPending >= 3) { signals.push({ label: `${clientPending} client pending`, severity: 'medium' }); riskScore += clientPending * 5; }
    if (project.status === 'ACTIVE' && progress < 20 && allT.length > 0)
                             { signals.push({ label: `${progress}% done`, severity: 'medium' }); riskScore += 20; }
    if (project.go_live_deadline) {
      const days = Math.ceil((new Date(project.go_live_deadline).getTime() - Date.now()) / 86400000);
      if (days < 7 && progress < 80) { signals.push({ label: `Go-live in ${days}d`, severity: 'high' }); riskScore += 40; }
    }
    return { signals, riskScore: Math.min(riskScore, 100) };
  }

  const atRiskMyProjects = React.useMemo(() =>
    myProjects
      .filter(p => ['ACTIVE','APPROVED'].includes(p.status))
      .map(p => ({ project: p, ...computeCSMRiskSignals(p) }))
      .filter(r => r.signals.length > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
  , [myProjects]);

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <CSMWelcomeModal
            name={user?.name ?? ''}
            role={isCSM ? 'CSM' : isProductManager ? 'Product' : 'PM'}
            onDismiss={dismissWelcome}
            onStartTour={startTour}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tourActive && (
          <CSMTourTooltip
            step={CSM_TOUR_STEPS[tourStep]}
            stepIndex={tourStep}
            totalSteps={CSM_TOUR_STEPS.length}
            targetRect={tourRect}
            onNext={nextTourStep}
            onPrev={prevTourStep}
            onSkip={skipTour}
          />
        )}
      </AnimatePresence>

      {/* ── CSM Approve Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {crReviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setCrReviewModal(null)}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">CSM Review — Approve CR</p>
                  <p className="text-teal-200 text-xs mt-0.5 truncate max-w-xs">{crReviewModal.req.title}</p>
                </div>
                <button onClick={() => setCrReviewModal(null)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">CSM Notes</label>
                  <textarea value={crForm.csm_notes} onChange={e => setCrForm(f => ({ ...f, csm_notes: e.target.value }))}
                    rows={3} placeholder="Your review notes, concerns, or observations…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Meeting Attendees <span className="text-gray-400 font-normal">(comma-separated)</span>
                  </label>
                  <input value={crForm.mom_attendees} onChange={e => setCrForm(f => ({ ...f, mom_attendees: e.target.value }))}
                    placeholder="e.g. Alice Smith, Bob Jones, Client SPOC"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    MoM Summary <span className="text-red-400">*</span>
                  </label>
                  <textarea value={crForm.mom_file_path} onChange={e => setCrForm(f => ({ ...f, mom_file_path: e.target.value }))}
                    rows={4} placeholder="Summarise the meeting — key decisions, action items, client expectations…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
                  <p className="text-[10px] text-gray-400 mt-1">At least MoM summary or attendees required to approve.</p>
                </div>
              </div>
              <div className="px-6 pb-5 flex gap-3">
                <button onClick={() => setCrReviewModal(null)}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleCsmApprove}
                  disabled={crSubmitting || (!crForm.mom_file_path.trim() && !crForm.mom_attendees.trim())}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition-colors">
                  {crSubmitting ? 'Submitting…' : 'Approve & Forward to PM'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CSM Reject Confirm ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {crRejectTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setCrRejectTarget(null)}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6"
              onClick={e => e.stopPropagation()}>
              <p className="text-base font-bold text-gray-900 mb-1">Reject this CR?</p>
              <p className="text-sm text-gray-500 mb-5">"{crRejectTarget.req.title}" will be marked as rejected and the client notified.</p>
              <div className="flex gap-3">
                <button onClick={() => setCrRejectTarget(null)} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                <button onClick={() => handleCsmReject(crRejectTarget.req, crRejectTarget.projectId)}
                  disabled={crSubmitting}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl">
                  {crSubmitting ? 'Rejecting…' : 'Yes, Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-screen bg-[#F8F9FC] overflow-hidden">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={`sidebar-drawer fixed inset-y-0 left-0 z-30 w-72 flex flex-col bg-slate-900 text-white
            lg:relative lg:translate-x-0 lg:w-64 lg:flex-shrink-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
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

          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
            {NAV_ITEMS.map(item => {
              const active = window.location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => { setTourStep(0); setTourActive(true); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-normal text-white/20 hover:bg-white/5 hover:text-white/40 transition-all mt-3 border-t border-white/5 pt-3"
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Replay tour
            </button>

          </nav>

          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/50">{isCSM ? 'Customer Success Manager' : isProductManager ? 'Product Manager' : 'Project Manager'}</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                aria-label="Sign out"
                className="p-1.5 text-white/30 hover:text-red-400 rounded-md transition-colors"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <header className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0">
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
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                  {getGreeting()}, {user?.name?.split(' ')[0]}
                </h1>
                {(tasksOverdue > 0 || tasksDueToday > 0) && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    tasksOverdue > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}>
                    {tasksOverdue > 0 ? `${tasksOverdue} overdue` : `${tasksDueToday} due today`}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {stats.active > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                {stats.active > 0 && <span className="text-gray-500">{stats.active} active project{stats.active !== 1 ? 's' : ''}</span>}
                {upcomingMilestoneCount > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                {upcomingMilestoneCount > 0 && <span className="text-amber-600 font-medium">{upcomingMilestoneCount} milestone{upcomingMilestoneCount !== 1 ? 's' : ''} this week</span>}
              </p>
            </div>
            </div>
            <div className="flex items-center gap-3">
              {stats.needPlan > 0 && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-semibold text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {stats.needPlan} need start date
                </div>
              )}
              {user?.id && (
                <div className="bg-slate-800 rounded-lg">
                  <NotificationBell userId={user.id} />
                </div>
              )}
            </div>
          </header>

          {/* Two-column body */}
          <div className="flex-1 overflow-hidden flex gap-0">

            {/* ── LEFT: projects ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-6 min-w-0">

              {/* Stats */}
              <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {[
                  {
                    label: 'My Projects', value: stats.total, color: 'text-gray-900', accent: 'bg-indigo-500',
                    iconBg: 'bg-indigo-50', textAccent: 'text-indigo-600',
                    icon: <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
                    sub: stats.active > 0 ? `${stats.active} active` : 'none active',
                  },
                  {
                    label: 'Coming Soon', value: stats.comingSoon, color: 'text-violet-600', accent: 'bg-violet-500',
                    iconBg: 'bg-violet-50', textAccent: 'text-violet-500',
                    icon: <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                    sub: 'pending approval',
                  },
                  {
                    label: 'Ready to Start', value: stats.approved, color: 'text-emerald-600', accent: 'bg-emerald-500',
                    iconBg: 'bg-emerald-50', textAccent: 'text-emerald-500',
                    icon: <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                    sub: stats.needPlan > 0 ? `${stats.needPlan} need start date` : 'all dates set',
                    subAlert: stats.needPlan > 0,
                  },
                  {
                    label: 'Active', value: stats.active, color: 'text-blue-600', accent: 'bg-blue-500',
                    iconBg: 'bg-blue-50', textAccent: 'text-blue-500',
                    icon: <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
                    sub: `${atRiskMyProjects.length} at risk`,
                    subAlert: atRiskMyProjects.length > 0,
                  },
                  {
                    label: 'My Tasks Open', value: tasks.filter(t => t.status !== 'completed').length, color: tasksOverdue > 0 ? 'text-red-600' : 'text-gray-900',
                    accent: tasksOverdue > 0 ? 'bg-red-500' : 'bg-gray-400',
                    iconBg: tasksOverdue > 0 ? 'bg-red-50' : 'bg-gray-50', textAccent: tasksOverdue > 0 ? 'text-red-500' : 'text-gray-400',
                    icon: <svg className={`w-4 h-4 ${tasksOverdue > 0 ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
                    sub: tasksOverdue > 0 ? `${tasksOverdue} overdue` : tasksDueToday > 0 ? `${tasksDueToday} due today` : 'all on track',
                    subAlert: tasksOverdue > 0,
                  },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
                    {/* top accent stripe */}
                    <div className={`h-0.5 ${s.accent}`} />
                    <div className="px-4 py-3.5">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                          {s.icon}
                        </div>
                      </div>
                      <p className={`text-2xl font-extrabold leading-none mb-1 ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1.5">{s.label}</p>
                      {'sub' in s && (
                        <p className={`text-[10px] font-medium ${(s as any).subAlert ? 'text-amber-500' : s.textAccent}`}>
                          {(s as any).sub}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Delivery Tracker */}
              <StandardApproachGuide role={isCSM ? 'CSM' : isProductManager ? 'Product' : 'PM'} />

              {/* Filter tabs */}
              <div className="flex items-center gap-2 mb-4">
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setActiveFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      activeFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>
                    {f.label}
                    {f.key === 'AT_RISK' ? (
                      atRiskMyProjects.length > 0 && (
                        <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{atRiskMyProjects.length}</span>
                      )
                    ) : (
                      <span className="ml-1.5 opacity-70">
                        {f.key === 'ALL' ? myProjects.length : myProjects.filter(p => p.status === f.key).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* At-Risk view */}
              {activeFilter === 'AT_RISK' ? (
                loading ? (
                  <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
                ) : atRiskMyProjects.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-emerald-200 p-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">All your projects look healthy</p>
                    <p className="text-xs text-gray-400 mt-1">No risk signals detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs font-semibold text-amber-700">{atRiskMyProjects.length} project{atRiskMyProjects.length > 1 ? 's' : ''} need your attention</p>
                    </div>
                    {atRiskMyProjects.map(({ project, signals, riskScore }) => (
                      <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigate(`/project/${project.id}`)}
                        className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all ${signals.some(s => s.severity === 'high') ? 'border-red-200' : 'border-amber-200'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                            <p className="text-xs text-gray-500">{project.client_name}</p>
                          </div>
                          <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${riskScore >= 60 ? 'border-red-300' : 'border-amber-300'}`}>
                            <span className={`text-[11px] font-bold ${riskScore >= 60 ? 'text-red-600' : 'text-amber-600'}`}>{riskScore}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {signals.map((sig, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sig.severity === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sig.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                              {sig.label}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-indigo-500 font-semibold mt-2 text-right">View project →</p>
                      </motion.div>
                    ))}
                  </div>
                )
              ) : null}

              {/* Project list */}
              {activeFilter !== 'AT_RISK' && (loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                  <p className="text-sm text-gray-400">No projects in this category</p>
                </div>
              ) : (
                <div ref={projectsRef} className="space-y-3">
                  {filtered.map((project, i) => {
                    const sCfg = STATUS_CONFIG[project.status] ?? { bar: 'bg-gray-300', label: project.status };
                    const wbs  = getWbsProgress(project);
                    const daysLeft = getDaysUntilDeadline(project.go_live_deadline);
                    const deadlineUrgent = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
                    const deadlineOverdue = daysLeft !== null && daysLeft < 0;
                    return (
                      <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${
                          deadlineOverdue ? 'border-red-200 hover:border-red-300' :
                          deadlineUrgent  ? 'border-amber-200 hover:border-amber-300' :
                          'border-gray-100 hover:border-indigo-100'
                        }`}>
                        <div className="p-4" onClick={() => navigate(`/project/${project.id}`)}>
                          <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-1 h-10 rounded-full flex-shrink-0 ${sCfg.bar}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                                {project.priority && project.priority !== 'Medium' && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                                    project.priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' :
                                    'bg-orange-50 text-orange-600 border-orange-200'}`}>{project.priority}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{project.client_name}</p>
                              {project.go_live_deadline && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  Go-live: {new Date(project.go_live_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={project.status} />
                            {project.status === 'AWAITING_APPROVAL' && (
                              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg whitespace-nowrap">
                                Incoming →
                              </span>
                            )}
                            {project.status === 'ACTIVE' && (() => {
                              const overdue = tasks.filter(t => t.project_id === project.id && t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;
                              return overdue > 0 ? (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg whitespace-nowrap">
                                  {overdue} overdue
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>

                        {/* WBS progress bar */}
                        {project.status === 'ACTIVE' && wbs.total > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-gray-400 font-medium">WBS Progress</span>
                              <span className="text-[10px] font-bold text-gray-600">{wbs.done}/{wbs.total} tasks · {wbs.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${wbs.pct}%` }}
                                transition={{ duration: 0.6, delay: i * 0.04 + 0.2 }}
                                className={`h-full rounded-full ${wbs.pct >= 80 ? 'bg-emerald-500' : wbs.pct >= 40 ? 'bg-indigo-500' : 'bg-blue-400'}`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Deadline chip + team */}
                        {(daysLeft !== null || project.csm_name || project.pm_name) && (
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {daysLeft !== null && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  deadlineOverdue ? 'bg-red-50 text-red-600 border border-red-200' :
                                  deadlineUrgent  ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {deadlineOverdue
                                    ? `${Math.abs(daysLeft)}d past go-live`
                                    : daysLeft === 0 ? 'Go-live today'
                                    : `${daysLeft}d to go-live`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {[project.csm_name, project.pm_name].filter(Boolean).slice(0,2).map((name, ni) => (
                                <div key={ni} title={name ?? ''}
                                  className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[9px] font-bold ring-1 ring-white -ml-1 first:ml-0">
                                  {(name ?? '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                        {/* Inline start date for APPROVED projects */}
                        {project.status === 'APPROVED' && !project.project_start_date && (
                          <div className="px-4 pb-4 -mt-1" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                              <span className="text-[10px] font-semibold text-amber-600 flex-shrink-0">Set Start Date:</span>
                              <input
                                type="date"
                                value={quickDates[project.id] || ''}
                                onChange={e => setQuickDates(prev => ({ ...prev, [project.id]: e.target.value }))}
                                className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-0"
                              />
                              <button
                                onClick={() => handleQuickStart(project.id)}
                                disabled={!quickDates[project.id]}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                              >
                                Start
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}

              {/* ── Coming Soon — pre-approval projects (read-only) ───────── */}
              {comingSoonProjects.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Coming Soon</p>
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{comingSoonProjects.length}</span>
                    <span className="text-[10px] text-gray-400">· Pending admin approval · Read-only</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {comingSoonProjects.map((project, i) => {
                      const sCfg = STATUS_CONFIG[project.status] ?? { label: project.status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4 opacity-80 select-none"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-700 truncate">{project.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{project.client_name}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${sCfg.bg} ${sCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                              {sCfg.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                            {project.priority && <span>Priority: <span className="font-semibold text-gray-600">{project.priority}</span></span>}
                            {project.expected_timeline && <span>Timeline: <span className="font-semibold text-gray-600">{project.expected_timeline}</span></span>}
                            {project.project_type && <span>Type: <span className="font-semibold text-gray-600">{project.project_type}</span></span>}
                          </div>
                          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-violet-400 font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Awaiting admin approval to unlock
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: tasks, milestones, actions ────────────────────── */}
            <aside ref={rightPanelRef} className="hidden lg:block w-80 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto px-5 py-6 space-y-6">

              {/* Focus Today */}
              {(() => {
                const overdueTasksToday = tasks.filter(t => t.due_date && t.due_date <= todayStr && t.status !== 'completed');
                const nextMilestone = milestones
                  .filter(m => { const mypids = new Set(myProjects.map(p => p.id)); return mypids.has(m.project_id) && m.status !== 'completed' && m.due_date; })
                  .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];
                const noStartProjects = myProjects.filter(p => p.status === 'APPROVED' && !p.project_start_date);
                if (overdueTasksToday.length === 0 && !nextMilestone && noStartProjects.length === 0) return null;
                return (
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Focus Today</p>
                    </div>
                    <div className="space-y-2">
                      {overdueTasksToday.slice(0, 2).map(t => (
                        <div key={t.id} className="flex items-start gap-2 bg-white rounded-xl p-2.5 border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{t.title}</p>
                            <p className="text-[10px] text-red-500 font-medium">
                              {t.due_date === todayStr ? 'Due today' : 'Overdue'}
                              {t.project_name ? ` · ${t.project_name}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                      {nextMilestone && (
                        <div
                          onClick={() => navigate(`/project/${nextMilestone.project_id}`)}
                          className="flex items-start gap-2 bg-white rounded-xl p-2.5 border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                        >
                          <span className="text-amber-500 text-sm flex-shrink-0 leading-none mt-0.5">◆</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{nextMilestone.name}</p>
                            <p className="text-[10px] text-amber-600 font-medium">
                              {nextMilestone.due_date
                                ? new Date(nextMilestone.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : 'No date'}
                              {' · '}
                              {myProjects.find(p => p.id === nextMilestone.project_id)?.name ?? 'Milestone'}
                            </p>
                          </div>
                        </div>
                      )}
                      {noStartProjects.slice(0, 1).map(p => (
                        <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                          className="flex items-start gap-2 bg-white rounded-xl p-2.5 border border-emerald-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Set start date to activate</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Coming Soon Projects */}
              {comingSoonProjects.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Coming Soon</p>
                  <div className="space-y-2">
                    {comingSoonProjects.slice(0, 3).map(p => (
                      <div key={p.id}
                        className="flex items-start gap-2.5 p-3 bg-violet-50 border border-violet-100 rounded-xl">
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-violet-700 truncate">{p.name}</p>
                          <p className="text-[10px] text-violet-500">{p.client_name} · Pending approval</p>
                        </div>
                      </div>
                    ))}
                    {comingSoonProjects.length > 3 && (
                      <p className="text-[10px] text-gray-400 text-center">+{comingSoonProjects.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── CR Requests (CSM only) ──────────────────────────────── */}
              {isCSM && (() => {
                const crPending = crRequests.filter(r => r.approval_stage === 'csm_review');
                const actionItems = crRequests.filter(r => !['change_request','new_requirement'].includes(r.request_type));
                if (crPending.length === 0 && actionItems.length === 0) return null;
                return (
                  <div>
                    {crPending.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">CR Requests</p>
                          <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{crPending.length} pending</span>
                        </div>
                        <div className="space-y-2 mb-4">
                          {crPending.map((req: any) => (
                            <div key={req.id} className="p-3 bg-violet-50 border border-violet-100 rounded-xl">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 truncate">{req.title}</p>
                                  <p className="text-[10px] text-violet-600 font-medium">{req.request_type?.replace(/_/g,' ')} · {req.priority}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{req.client_name} · {req.project_name}</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-500 line-clamp-2 mb-2">{req.description}</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setCrReviewModal({ req, projectId: req.project_id }); setCrForm({ csm_notes: '', mom_attendees: '', mom_file_path: '' }); }}
                                  className="flex-1 py-1.5 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                                  Approve
                                </button>
                                <button
                                  onClick={() => setCrRejectTarget({ req, projectId: req.project_id })}
                                  className="flex-1 py-1.5 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {actionItems.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Action Items</p>
                        <div className="space-y-2 mb-4">
                          {actionItems.map((req: any) => (
                            <div key={req.id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                              <p className="text-xs font-semibold text-gray-800 truncate">{req.title}</p>
                              <p className="text-[10px] text-amber-600">{req.request_type?.replace(/_/g,' ')} · {req.client_name}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-2 mt-1">{req.description}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Action Required */}
              {(() => {
                const overdueTasks = tasks.filter(t =>
                  t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
                );
                const noStartDate = myProjects.filter(p => p.status === 'APPROVED' && !p.project_start_date);
                if (overdueTasks.length === 0 && noStartDate.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Action Required</p>
                    <div className="space-y-2">
                      {overdueTasks.slice(0, 3).map(t => (
                        <div key={t.id} className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-red-700 truncate">{t.title}</p>
                            <p className="text-[10px] text-red-400">Due {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>
                          </div>
                        </div>
                      ))}
                      {noStartDate.map(p => (
                        <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                          className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                          <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-amber-700 truncate">{p.name}</p>
                            <p className="text-[10px] text-amber-500">Set project start date</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* My Tasks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">My Tasks</p>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status !== 'completed').length} open
                  </span>
                </div>
                {(() => {
                  const openTasks = tasks.filter(t => t.status !== 'completed');
                  const doneTasks = tasks.filter(t => t.status === 'completed');
                  const visibleTasks = showCompletedTasks ? tasks.slice(0, 8) : openTasks.slice(0, 8);
                  if (tasks.length === 0) return <p className="text-xs text-gray-400 text-center py-4">No tasks assigned</p>;
                  return (
                    <div className="space-y-2">
                      {visibleTasks.map(t => {
                        const isOverdue = !!(t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
                        const isDone = t.status === 'completed';
                        return (
                          <div key={t.id}
                            onClick={() => updateTaskStatus(t.id, t.status)}
                            title={isDone ? 'Click to reopen' : 'Click to advance status'}
                            className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all ${
                              isDone ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-gray-50 hover:bg-gray-100'
                            }`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                              isDone             ? 'bg-emerald-500 border-emerald-500' :
                              t.status === 'in_progress' ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                            }`}>
                              {isDone && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {t.status === 'in_progress' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium leading-snug ${isDone ? 'text-emerald-700' : 'text-gray-800'}`}>{t.title}</p>
                              {t.completion_date && isDone ? (
                                <p className="text-[10px] mt-0.5 text-emerald-500">Completed {new Date(t.completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                              ) : t.due_date ? (
                                <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                  {isOverdue ? 'Overdue · ' : 'Due '}
                                  {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              ) : null}
                              {t.project_name && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t.project_name}</p>}
                            </div>
                          </div>
                        );
                      })}
                      {doneTasks.length > 0 && (
                        <button
                          onClick={() => setShowCompletedTasks(s => !s)}
                          className="w-full py-2 text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {showCompletedTasks
                            ? <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                Hide completed
                              </>
                            : <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                {doneTasks.length} completed — show
                              </>
                          }
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Upcoming Milestones */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Milestones</p>
                </div>
                {(() => {
                  const myProjectIds = new Set(myProjects.map(p => p.id));
                  const upcoming = milestones
                    .filter(m => myProjectIds.has(m.project_id) && m.status !== 'completed')
                    .sort((a, b) => {
                      if (!a.due_date) return 1;
                      if (!b.due_date) return -1;
                      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                    })
                    .slice(0, 5);
                  if (upcoming.length === 0) return <p className="text-xs text-gray-400 text-center py-4">No upcoming milestones</p>;
                  return (
                    <div className="space-y-2">
                      {upcoming.map(m => {
                        const isOverdue = m.due_date && new Date(m.due_date) < new Date();
                        const isDueSoon = m.due_date && !isOverdue &&
                          (new Date(m.due_date).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;
                        const projectName = myProjects.find(p => p.id === m.project_id)?.name
                          || projects.find(p => p.id === m.project_id)?.name
                          || 'Unknown Project';
                        return (
                          <div
                            key={m.id}
                            onClick={() => navigate(`/project/${m.project_id}`)}
                            className={`p-3 rounded-xl border cursor-pointer hover:opacity-90 transition-opacity ${
                              isOverdue  ? 'bg-red-50 border-red-100'    :
                              isDueSoon  ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'
                            }`}
                          >
                            <p className={`text-xs font-semibold truncate ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-gray-700'}`}>
                              {m.name}
                            </p>
                            <p className={`text-[10px] truncate mt-0.5 ${isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-gray-400'}`}>
                              {projectName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className={`text-[10px] ${isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : 'text-gray-400'}`}>
                                {m.due_date ? new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                                {isOverdue && ' · Overdue'}
                                {isDueSoon && ' · Due soon'}
                              </p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                                m.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                              }`}>{m.status.replace('_', ' ')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </aside>
          </div>
        </main>
      </div>
    </>
  );
};

export default CSMDashboard;
