import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';

interface Project {
  id: number;
  name: string;
  client_name: string;
  description?: string;
  status: string;
  project_type?: string;
  owner_name?: string;
  owner_id?: number;
  csm_id?: number;
  csm_name?: string;
  pm_id?: number;
  pm_name?: string;
  product_manager_id?: number;
  product_manager_name?: string;
  mom_text?: string;
  deployment_region?: string;
  deployment_type?: string;
  sso_required?: boolean;
  meeting_done?: boolean;
  meeting_date?: string;
  expected_timeline?: string;
  integrations_required?: string;
  integration_details?: string;
  client_spoc_name?: string;
  client_spoc_email?: string;
  client_spoc_mobile?: string;
  priority?: string;
  business_objective?: string;
  go_live_deadline?: string;
  num_users?: string;
  current_tools?: string;
  success_criteria?: string;
  budget_range?: string;
  sow_file_path?: string;
  sow_file_name?: string;
  sow_file_size?: string;
  stage_name?: string;
  start_date?: string;
  target_go_live_date?: string;
  project_plan?: string;
  project_start_date?: string;
  created_at: string;
  updated_at: string;
}

// ── WBS Tracker ───────────────────────────────────────────────────────────────

interface WBSTask {
  id: number;
  wbs: string;
  name: string;
  type?: string;
  sprint: number;
  sprint_label?: string;
  status: string;
  owner_role?: string;
  planned_start?: string;
  planned_end?: string;
}

const WBS_STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  completed:   { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  in_progress: { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'    },
  blocked:     { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
  not_started: { bg: 'bg-gray-50',     text: 'text-gray-500',    dot: 'bg-gray-300'    },
};

const WBSTrackerView: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const activeProjects = projects.filter(p => ['ACTIVE', 'APPROVED'].includes(p.status) && p.project_plan);

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (activeProjects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
        <p className="text-sm text-gray-400">No active projects with WBS plans yet</p>
        <p className="text-xs text-gray-300 mt-1">Projects must be ACTIVE or APPROVED and have a project plan</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all',         label: 'All Tasks' },
          { key: 'blocked',     label: 'Blocked' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'not_started', label: 'Not Started' },
          { key: 'completed',   label: 'Completed' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === f.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activeProjects.map((project, pi) => {
        let tasks: WBSTask[] = [];
        try { tasks = JSON.parse(project.project_plan!); } catch { tasks = []; }

        // Only include tasks with a trackable status (exclude Phase/Summary header rows with no owner)
        const trackable = tasks.filter(t => t.owner_role !== '' || t.type === 'Task' || t.type === 'Deliverable' || t.type === 'Client Requirement');
        const visible = statusFilter === 'all' ? trackable : trackable.filter(t => t.status === statusFilter);

        const total     = trackable.length;
        const done      = trackable.filter(t => t.status === 'completed').length;
        const active    = trackable.filter(t => t.status === 'in_progress').length;
        const blocked   = trackable.filter(t => t.status === 'blocked').length;
        const notStart  = trackable.filter(t => t.status === 'not_started' || t.status === 'pending').length;
        const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
        const isExpanded = expanded.has(project.id);

        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.04 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Project header row */}
            <div
              className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggle(project.id)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                    <p className="text-xs text-gray-400">{project.client_name} · {project.csm_name || '—'} (CSM) · {project.pm_name || '—'} (PM)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Stats pills */}
                  <div className="flex items-center gap-2">
                    {done > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{done} done</span>
                    )}
                    {active > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{active} active</span>
                    )}
                    {blocked > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{blocked} blocked</span>
                    )}
                    {notStart > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{notStart} todo</span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : active > 0 ? 'bg-indigo-500' : 'bg-gray-300'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-8 text-right">{pct}%</span>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
              </div>
            </div>

            {/* Task list (expanded) */}
            {isExpanded && (
              <div className="border-t border-gray-100">
                {visible.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No tasks match this filter</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {visible.map(task => {
                      const sc = WBS_STATUS_COLOR[task.status] ?? WBS_STATUS_COLOR.not_started;
                      return (
                        <div key={task.id} className={`flex items-center gap-3 px-5 py-2.5 ${sc.bg}`}>
                          <span className="text-[10px] font-mono text-gray-300 w-10 flex-shrink-0">{task.wbs}</span>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                          <p className="flex-1 text-xs text-gray-700 truncate">{task.name}</p>
                          {task.type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 text-gray-500 border border-gray-100 flex-shrink-0">{task.type}</span>
                          )}
                          {task.owner_role && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-gray-600 border border-gray-100 flex-shrink-0">{task.owner_role}</span>
                          )}
                          {task.planned_start && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {new Date(task.planned_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' – '}
                              {task.planned_end ? new Date(task.planned_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?'}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

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

// ── Project detail drawer ──────────────────────────────────────────────────────

interface DrawerProps {
  project: Project;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  approving: boolean;
}

const ProjectDrawer: React.FC<DrawerProps> = ({ project, onClose, onApprove, onReject, approving }) => {
  const canDecide = project.status === 'AWAITING_APPROVAL';
  const [sowAcknowledged, setSowAcknowledged] = useState(false);
  const hasSow = !!project.sow_file_path;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" />

      {/* Drawer */}
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
          <div>
            <h2 className="text-lg font-bold text-gray-900">{project.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{project.client_name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Status badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={project.status} />
            {project.project_type && (
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                {project.project_type}
              </span>
            )}
          </div>

          {/* Client info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Client Information</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Client Name',   value: project.client_name },
                { label: 'Client SPOC',   value: project.client_spoc_name },
                { label: 'SPOC Email',    value: project.client_spoc_email },
                { label: 'SPOC Mobile',   value: project.client_spoc_mobile },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500 flex-shrink-0">{row.label}</span>
                  <span className="font-medium text-gray-800 text-right ml-4 break-all">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Team</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Sales Owner',     value: project.owner_name },
                { label: 'CSM Assigned',    value: project.csm_name },
                { label: 'PM Assigned',     value: project.pm_name },
                { label: 'Product Manager', value: project.product_manager_name },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-800">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Business Objective */}
          {project.business_objective && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Business Objective</p>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 leading-relaxed">{project.business_objective}</p>
              </div>
            </div>
          )}

          {/* Project details */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Project Details</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Priority',          value: project.priority },
                { label: 'Project Type',      value: project.project_type },
                { label: 'Deployment Region', value: project.deployment_region },
                { label: 'Deployment Type',   value: project.deployment_type },
                { label: 'SSO Required',      value: project.sso_required ? 'Yes' : 'No' },
                { label: 'Expected Timeline', value: project.expected_timeline },
                { label: 'Go-Live Deadline',  value: project.go_live_deadline ? new Date(project.go_live_deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined },
                { label: 'No. of Users',      value: project.num_users },
                { label: 'Current Tools',     value: project.current_tools },
                { label: 'Budget Range',      value: project.budget_range },
                { label: 'Date Submitted',    value: new Date(project.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500 flex-shrink-0">{row.label}</span>
                  <span className="font-medium text-gray-800 text-right ml-4 max-w-xs break-words">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Success Criteria */}
          {project.success_criteria && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Success Criteria</p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 leading-relaxed">{project.success_criteria}</p>
              </div>
            </div>
          )}

          {/* Meeting */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Kickoff Meeting</p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Meeting Done',  value: project.meeting_done ? 'Yes ✓' : 'No', highlight: project.meeting_done },
                { label: 'Meeting Date',  value: project.meeting_date ? new Date(project.meeting_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-medium ${'highlight' in row && row.highlight ? 'text-emerald-600' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Integrations */}
          {project.integrations_required && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Integrations Required</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700">{project.integrations_required}</p>
              </div>
            </div>
          )}

          {/* MOM */}
          {project.mom_text && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Meeting Minutes (MoM)</p>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.mom_text}</p>
              </div>
            </div>
          )}

          {/* SOW */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Statement of Work (SOW)</p>
            {hasSow ? (
              <a
                href={`http://localhost:3001/api/projects/${project.id}/download-sow`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-700 truncate">{project.sow_file_name || 'SOW Document'}</p>
                  <p className="text-xs text-indigo-400 mt-0.5">{project.sow_file_size || ''} · Click to download</p>
                </div>
                <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3">
                <svg className="w-8 h-8 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-500">No SOW attached</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sales team has not uploaded a SOW document yet</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Decision */}
        {canDecide && (
          <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Decision</p>

            {/* SOW acknowledgement */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              sowAcknowledged ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:border-indigo-200'
            }`}>
              <input
                type="checkbox"
                checked={sowAcknowledged}
                onChange={e => setSowAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 flex-shrink-0"
              />
              <span className={`text-sm leading-snug ${sowAcknowledged ? 'text-emerald-700 font-medium' : 'text-gray-600'}`}>
                I confirm I have reviewed the Statement of Work{hasSow ? ' (SOW document attached above)' : ''} and all intake details before approving this project.
              </span>
            </label>

            {!sowAcknowledged && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Please acknowledge the SOW review to enable approval
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => onApprove(project.id)}
                disabled={approving || !sowAcknowledged}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Approve Project
              </button>
              <button
                onClick={() => onReject(project.id)}
                disabled={approving}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {project.status === 'APPROVED' && (
          <div className="px-6 py-4 border-t border-emerald-100 bg-emerald-50 flex items-center gap-2 text-emerald-700 text-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Approved by Admin
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── At-Risk Intelligence Panel ────────────────────────────────────────────────

interface RiskSignal {
  type: 'blocked_task' | 'overdue_milestone' | 'low_progress' | 'client_pending' | 'no_start_date';
  label: string;
  severity: 'high' | 'medium' | 'low';
}

interface AtRiskProject {
  project: Project;
  signals: RiskSignal[];
  riskScore: number; // 0-100, higher = more at risk
  taskStats: { total: number; completed: number; blocked: number; in_progress: number };
}

function computeRiskSignals(project: Project): AtRiskProject {
  let tasks: WBSTask[] = [];
  try { const p = JSON.parse(project.project_plan || '[]'); tasks = Array.isArray(p) ? p : []; } catch {}

  const allTasks  = tasks.filter(t => t.type === 'Task' || t.type === 'Deliverable');
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const blocked   = allTasks.filter(t => t.status === 'blocked').length;
  const inProg    = allTasks.filter(t => t.status === 'in_progress').length;
  const progress  = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
  const clientPending = tasks.filter(t =>
    (t.owner_role === 'Client' || t.type === 'Client Requirement') && t.status !== 'completed'
  ).length;

  const signals: RiskSignal[] = [];
  let riskScore = 0;

  if (blocked > 0) {
    signals.push({ type: 'blocked_task', label: `${blocked} task${blocked > 1 ? 's' : ''} blocked`, severity: 'high' });
    riskScore += blocked * 20;
  }
  if (!project.project_start_date && project.status === 'ACTIVE') {
    signals.push({ type: 'no_start_date', label: 'No start date set', severity: 'high' });
    riskScore += 30;
  }
  if (clientPending >= 3) {
    signals.push({ type: 'client_pending', label: `${clientPending} client actions pending`, severity: 'medium' });
    riskScore += clientPending * 5;
  }
  if (project.status === 'ACTIVE' && progress < 20 && allTasks.length > 0) {
    signals.push({ type: 'low_progress', label: `Only ${progress}% complete`, severity: 'medium' });
    riskScore += 20;
  }
  if (project.go_live_deadline) {
    const days = Math.ceil((new Date(project.go_live_deadline).getTime() - Date.now()) / 86400000);
    if (days < 7 && progress < 80) {
      signals.push({ type: 'overdue_milestone', label: `Go-live in ${days}d — only ${progress}% done`, severity: 'high' });
      riskScore += 40;
    }
  }

  return {
    project,
    signals,
    riskScore: Math.min(riskScore, 100),
    taskStats: { total: allTasks.length, completed, blocked, in_progress: inProg },
  };
}

const SEVERITY_COLORS = {
  high:   { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200'    },
  medium: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  border: 'border-amber-200'  },
  low:    { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400',   border: 'border-blue-200'   },
};

const AtRiskView: React.FC<{ projects: Project[]; onSelectProject: (p: Project) => void }> = ({ projects, onSelectProject }) => {
  const atRiskProjects: AtRiskProject[] = React.useMemo(() => {
    return projects
      .filter(p => ['ACTIVE', 'APPROVED'].includes(p.status))
      .map(computeRiskSignals)
      .filter(r => r.signals.length > 0)
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [projects]);

  if (atRiskProjects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-emerald-200 p-16 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p className="text-sm font-semibold text-emerald-700">All projects look healthy</p>
        <p className="text-xs text-gray-400 mt-1">No risk signals detected across active projects</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs font-semibold text-red-700">
          {atRiskProjects.length} project{atRiskProjects.length > 1 ? 's' : ''} need attention —{' '}
          {atRiskProjects.filter(r => r.signals.some(s => s.severity === 'high')).length} high risk,{' '}
          {atRiskProjects.filter(r => r.signals.every(s => s.severity !== 'high')).length} medium risk
        </p>
      </div>

      {atRiskProjects.map(({ project, signals, riskScore, taskStats }) => {
        const highestSeverity = signals.some(s => s.severity === 'high') ? 'high'
          : signals.some(s => s.severity === 'medium') ? 'medium' : 'low';
        const sev = SEVERITY_COLORS[highestSeverity];
        const progress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

        return (
          <div key={project.id} className={`bg-white rounded-2xl border ${sev.border} p-5 hover:shadow-md transition-all cursor-pointer`} onClick={() => onSelectProject(project)}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                  <h3 className="text-sm font-bold text-gray-900 truncate">{project.name}</h3>
                </div>
                <p className="text-xs text-gray-500 ml-4">{project.client_name} · {project.stage_name}</p>
              </div>
              {/* Risk score gauge */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-10 h-10 rounded-full border-2 ${riskScore >= 60 ? 'border-red-300' : riskScore >= 30 ? 'border-amber-300' : 'border-blue-300'} flex items-center justify-center`}>
                  <span className={`text-xs font-bold ${riskScore >= 60 ? 'text-red-600' : riskScore >= 30 ? 'text-amber-600' : 'text-blue-600'}`}>{riskScore}</span>
                </div>
                <span className="text-[9px] text-gray-400 mt-0.5">risk</span>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>{progress}% complete</span>
                <span>{taskStats.completed}/{taskStats.total} tasks</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${taskStats.blocked > 0 ? 'bg-red-400' : 'bg-indigo-400'}`} style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Signals */}
            <div className="flex flex-wrap gap-1.5">
              {signals.map((sig, i) => {
                const c = SEVERITY_COLORS[sig.severity];
                return (
                  <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {sig.label}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                {project.csm_name && <span>CSM: {project.csm_name}</span>}
                {project.pm_name  && <span>PM: {project.pm_name}</span>}
              </div>
              <span className="text-[10px] text-indigo-500 font-semibold">View project →</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

// ── User Management ────────────────────────────────────────────────────────────

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  is_active: boolean;
  created_at: string;
}

interface ClientRequest {
  id: number;
  project_id: number;
  project_name: string;
  project_client: string;
  client_user_id?: number;
  client_name: string;
  client_email: string;
  request_type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  response_comments?: string;
  responded_by?: number;
  responded_at?: string;
  approved_at?: string;
  due_date?: string;
  closed_at?: string;
  mom_document_id?: number;
  created_at: string;
}

const CR_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  change_request:    { label: 'Change Request',    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  new_requirement:   { label: 'New Requirement',   color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  additional_help:   { label: 'Additional Help',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'     },
  bug_report:        { label: 'Bug Report',        color: 'text-red-700',    bg: 'bg-red-50 border-red-200'        },
  other:             { label: 'Other',             color: 'text-gray-700',   bg: 'bg-gray-100 border-gray-200'    },
};

const CR_STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:      { label: 'Pending',      color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-400'  },
  under_review: { label: 'Under Review', color: 'text-blue-700',    bg: 'bg-blue-50',    dot: 'bg-blue-400'   },
  approved:     { label: 'Approved',     color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-400'},
  rejected:     { label: 'Rejected',     color: 'text-red-700',     bg: 'bg-red-50',     dot: 'bg-red-400'    },
  closed:       { label: 'Closed',       color: 'text-gray-500',    bg: 'bg-gray-100',   dot: 'bg-gray-400'   },
};

const PRIORITY_META: Record<string, { color: string; bg: string }> = {
  High:   { color: 'text-red-700',    bg: 'bg-red-50'   },
  Medium: { color: 'text-amber-700',  bg: 'bg-amber-50' },
  Low:    { color: 'text-gray-600',   bg: 'bg-gray-100' },
};

const ROLES = ['Admin', 'CSM', 'PM', 'Product Manager', 'Sales', 'Client'];

const USER_DRAWER_ANIM = `
  @keyframes drawer-slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .user-drawer  { animation: drawer-slide-in 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
  .user-backdrop { animation: backdrop-fade-in 0.2s ease forwards; }
`;

const ROLE_COLORS: Record<string, { pill: string; icon: string; gradient: string }> = {
  Admin:           { pill: 'bg-violet-100 text-violet-700 border-violet-200',  icon: 'bg-violet-500',  gradient: 'from-violet-500 to-purple-600'  },
  CSM:             { pill: 'bg-blue-100 text-blue-700 border-blue-200',         icon: 'bg-blue-500',    gradient: 'from-blue-500 to-cyan-500'        },
  PM:              { pill: 'bg-indigo-100 text-indigo-700 border-indigo-200',   icon: 'bg-indigo-500',  gradient: 'from-indigo-500 to-blue-600'      },
  'Product Manager':{ pill: 'bg-sky-100 text-sky-700 border-sky-200',           icon: 'bg-sky-500',     gradient: 'from-sky-500 to-indigo-500'       },
  Sales:           { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',icon: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-500'     },
  Client:          { pill: 'bg-orange-100 text-orange-700 border-orange-200',   icon: 'bg-orange-400',  gradient: 'from-orange-400 to-amber-500'     },
};

const UserManagementView: React.FC = () => {
  const [users, setUsers]               = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<AppUser | null>(null);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState('');
  const [form, setForm]                 = useState({ name: '', email: '', role: 'CSM', department: '', password: '' });
  const firstInputRef                   = React.useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [availableProjects, setAvailableProjects] = useState<{ id: number; name: string; client_name: string; status: string; client_spoc_email?: string }[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<number[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const r = await fetch('http://localhost:3001/api/users/all');
      if (r.ok) setUsers(await r.json());
    } finally { setLoadingUsers(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Focus first field when drawer opens
  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [showForm]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    if (showForm) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showForm]);

  const fetchProjectsForAssignment = async (clientEmail?: string) => {
    setLoadingProjects(true);
    try {
      const r = await fetch('http://localhost:3001/api/projects');
      const data: { id: number; name: string; client_name: string; status: string; client_spoc_email?: string }[] = r.ok ? await r.json() : [];
      setAvailableProjects(data);
      if (clientEmail) {
        const preAssigned = data.filter(p => (p.client_spoc_email || '').toLowerCase() === clientEmail.toLowerCase()).map(p => p.id);
        setAssignedProjectIds(preAssigned);
      } else {
        setAssignedProjectIds([]);
      }
    } finally { setLoadingProjects(false); }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', email: '', role: 'CSM', department: '', password: '' });
    setAssignedProjectIds([]);
    setAvailableProjects([]);
    setShowForm(true);
  };

  const openEdit = (u: AppUser) => {
    setEditTarget(u);
    setForm({ name: u.name, email: u.email, role: u.role, department: u.department || '', password: '' });
    setShowForm(true);
    if (u.role === 'Client') {
      fetchProjectsForAssignment(u.email);
    } else {
      setAssignedProjectIds([]);
      setAvailableProjects([]);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      let savedId: number | null = null;
      if (editTarget) {
        await fetch(`http://localhost:3001/api/users/${editTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, password: form.password || undefined }),
        });
        savedId = editTarget.id;
      } else {
        const r = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (r.ok) { const created = await r.json(); savedId = created.id; }
      }
      // Sync project assignments for Client users
      if (form.role === 'Client' && savedId) {
        await fetch(`http://localhost:3001/api/users/${savedId}/assign-projects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_ids: assignedProjectIds, email: form.email.trim(), name: form.name.trim() }),
        });
      }
      setShowForm(false);
      await fetchUsers();
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u: AppUser) => {
    await fetch(`http://localhost:3001/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    await fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`http://localhost:3001/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await fetchUsers();
    } finally { setDeleting(false); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const isCreate = !editTarget;
  const roleStyle = ROLE_COLORS[form.role] || ROLE_COLORS['CSM'];

  return (
    <>
      <style>{USER_DRAWER_ANIM}</style>

      {/* ── Slide-in Drawer ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="user-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          {/* Drawer panel */}
          <div className="user-drawer absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">

            {/* Drawer header */}
            <div className={`relative overflow-hidden px-6 py-6 flex-shrink-0 bg-gradient-to-br ${isCreate ? 'from-indigo-600 to-violet-600' : roleStyle.gradient}`}>
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-black/10 pointer-events-none" />

              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                    {isCreate ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    ) : (
                      <span className="text-xl font-black text-white">
                        {editTarget?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-lg leading-tight">
                      {isCreate ? 'Add New User' : editTarget?.name}
                    </p>
                    <p className="text-white/70 text-xs mt-0.5">
                      {isCreate ? 'Fill in the details below to create the account' : `Editing · ${editTarget?.role}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Edit: show current role pill */}
              {!isCreate && (
                <div className="relative mt-4 flex items-center gap-2">
                  <span className="text-[10px] text-white/60 uppercase tracking-wide font-bold">Current Role</span>
                  <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">{editTarget?.role}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ml-auto ${editTarget?.is_active ? 'bg-emerald-400/30 text-emerald-100' : 'bg-gray-400/30 text-gray-100'}`}>
                    {editTarget?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Full Name <span className="text-red-400 normal-case font-normal tracking-normal">required</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Email Address <span className="text-red-400 normal-case font-normal tracking-normal">required</span>
                </label>
                <input
                  type="email"
                  placeholder="jane@yourcompany.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => {
                    const rc = ROLE_COLORS[r] || ROLE_COLORS['CSM'];
                    const selected = form.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, role: r }));
                          if (r === 'Client') {
                            fetchProjectsForAssignment(form.email.trim() || undefined);
                          } else {
                            setAssignedProjectIds([]);
                            setAvailableProjects([]);
                          }
                        }}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                          selected
                            ? `border-transparent bg-gradient-to-br ${rc.gradient} text-white shadow-md scale-[1.03]`
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Department <span className="normal-case font-normal tracking-normal text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Engineering, Customer Success…"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {isCreate ? 'Password' : 'New Password'}
                  <span className="normal-case font-normal tracking-normal text-gray-400 ml-1">
                    {isCreate ? '(leave blank for default: changeme123)' : '(leave blank to keep current)'}
                  </span>
                </label>
                <input
                  type="password"
                  placeholder={isCreate ? 'Optional — uses default if blank' : 'Enter new password to change…'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Project Assignment — Client role only */}
              {form.role === 'Client' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Assign Projects
                  </label>
                  <p className="text-[11px] text-gray-400 mb-2">Client will see only these projects in their dashboard.</p>
                  {loadingProjects ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
                      <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                      Loading projects…
                    </div>
                  ) : availableProjects.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No projects found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2.5 bg-gray-50/50">
                      {availableProjects.map(p => {
                        const checked = assignedProjectIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              checked ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-white border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => setAssignedProjectIds(prev =>
                                e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                              )}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-semibold truncate ${checked ? 'text-indigo-700' : 'text-gray-800'}`}>{p.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{p.client_name} · {p.status}</p>
                            </div>
                            {checked && (
                              <span className="text-[10px] font-bold text-indigo-500 flex-shrink-0">✓</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {assignedProjectIds.length > 0 && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-1.5">
                      {assignedProjectIds.length} project{assignedProjectIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}

              {/* Preview card */}
              {form.name.trim() && (
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/80">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleStyle.gradient} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
                      {form.name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{form.name.trim()}</p>
                      <p className="text-xs text-gray-400">{form.email.trim() || 'email@…'} · {form.role}</p>
                    </div>
                    <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border ${roleStyle.pill}`}>{form.role}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.email.trim()}
                className={`flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 bg-gradient-to-r ${isCreate ? 'from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700' : `${roleStyle.gradient} hover:opacity-90`}`}
              >
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : isCreate ? 'Create User' : 'Save Changes'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-3 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <span className="text-xs text-gray-400">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add User
        </button>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center">Delete User?</h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This will deactivate their account. This action cannot be easily undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User table ───────────────────────────────────────────────────── */}
      {loadingUsers ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-500">{search ? 'No users match your search' : 'No users yet'}</p>
          {!search && <p className="text-xs text-gray-400 mt-1">Click "Add User" to create the first account.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS['CSM'];
                return (
                  <tr key={u.id} className={`hover:bg-gray-50/60 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rc.gradient} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
                          {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-none">{u.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${rc.pill}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {u.role === 'Client' ? (
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium underline-offset-2 hover:underline"
                          title="Click to manage project assignments"
                        >
                          Assign projects →
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">{u.department || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        title={u.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
                          title="Delete user"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ── Client Requests View ───────────────────────────────────────────────────────

const ClientRequestsView: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests]     = useState<ClientRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState('all');
  const [reviewTarget, setReview]   = useState<ClientRequest | null>(null);
  const [action, setAction]         = useState<'approved' | 'rejected' | 'under_review' | 'closed' | null>(null);
  const [comments, setComments]     = useState('');
  const [saving, setSaving]         = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const r = await fetch('http://localhost:3001/api/client-requests/all');
      if (r.ok) setRequests(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, []);

  // Close review panel on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setReview(null); setAction(null); setComments(''); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleAction = async () => {
    if (!reviewTarget || !action) return;
    setSaving(true);
    try {
      await fetch(`http://localhost:3001/api/projects/${reviewTarget.project_id}/client-requests/${reviewTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action,
          response_comments: comments.trim() || undefined,
          responded_by: user?.id,
        }),
      });
      setReview(null);
      setAction(null);
      setComments('');
      await fetch_();
    } finally { setSaving(false); }
  };

  const daysLeft = (due: string) => {
    const diff = new Date(due).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const visible = statusFilter === 'all' ? requests : requests.filter(r => r.status === statusFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const overdueCount = requests.filter(r => r.status === 'approved' && r.due_date && daysLeft(r.due_date) < 0).length;

  const STATUS_TABS = [
    { key: 'all',          label: 'All',          count: requests.length },
    { key: 'pending',      label: 'Pending',       count: requests.filter(r => r.status === 'pending').length },
    { key: 'under_review', label: 'Under Review',  count: requests.filter(r => r.status === 'under_review').length },
    { key: 'approved',     label: 'Approved',      count: requests.filter(r => r.status === 'approved').length },
    { key: 'rejected',     label: 'Rejected',      count: requests.filter(r => r.status === 'rejected').length },
    { key: 'closed',       label: 'Closed',        count: requests.filter(r => r.status === 'closed').length },
  ];

  return (
    <>
      {/* Review modal */}
      <AnimatePresence>
        {reviewTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setReview(null); setAction(null); setComments(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const tm = CR_TYPE_META[reviewTarget.request_type] || CR_TYPE_META.other;
                        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tm.bg} ${tm.color}`}>{tm.label}</span>;
                      })()}
                      {(() => {
                        const pm = PRIORITY_META[reviewTarget.priority] || PRIORITY_META.Medium;
                        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pm.bg} ${pm.color}`}>{reviewTarget.priority}</span>;
                      })()}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight">{reviewTarget.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{reviewTarget.project_name} · {reviewTarget.client_name} ({reviewTarget.client_email})</p>
                  </div>
                  <button onClick={() => { setReview(null); setAction(null); setComments(''); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4 space-y-4 max-h-80 overflow-y-auto">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{reviewTarget.description}</p>
                </div>
                {reviewTarget.response_comments && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Previous Response</p>
                    <p className="text-sm text-gray-600">{reviewTarget.response_comments}</p>
                  </div>
                )}

                {/* Action picker */}
                {reviewTarget.status !== 'closed' && reviewTarget.status !== 'rejected' && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Take Action</p>
                    <div className="flex gap-2 flex-wrap">
                      {reviewTarget.status === 'pending' && (
                        <button onClick={() => setAction('under_review')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            action === 'under_review' ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                          }`}>Mark Under Review</button>
                      )}
                      {(reviewTarget.status === 'pending' || reviewTarget.status === 'under_review') && (
                        <>
                          <button onClick={() => setAction('approved')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              action === 'approved' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}>Approve</button>
                          <button onClick={() => setAction('rejected')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              action === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-700 hover:bg-red-50'
                            }`}>Reject</button>
                        </>
                      )}
                      {reviewTarget.status === 'approved' && (
                        <button onClick={() => setAction('closed')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            action === 'closed' ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}>Mark Closed</button>
                      )}
                    </div>
                  </div>
                )}

                {action && (
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">
                      Comments {action === 'rejected' ? '(required)' : '(optional)'}
                    </label>
                    <textarea
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      rows={3}
                      placeholder={action === 'approved' ? 'e.g. We will schedule a call within 3 business days.' : action === 'rejected' ? 'Reason for rejection…' : ''}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 placeholder-gray-400"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button onClick={() => { setReview(null); setAction(null); setComments(''); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button
                  disabled={!action || saving || (action === 'rejected' && !comments.trim())}
                  onClick={handleAction}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    action === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                    action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {saving ? 'Saving…' : action === 'approved' ? 'Approve & Notify' : action === 'rejected' ? 'Reject & Notify' : action === 'closed' ? 'Close Request' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Requests',   value: requests.length,  color: 'text-gray-900' },
          { label: 'Pending Review',   value: pendingCount,     color: 'text-amber-600' },
          { label: 'Overdue Closure',  value: overdueCount,     color: 'text-red-600'   },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              statusFilter === t.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                statusFilter === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading requests…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No requests in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((cr, i) => {
            const tm = CR_TYPE_META[cr.request_type] || CR_TYPE_META.other;
            const sm = CR_STATUS_META[cr.status] || CR_STATUS_META.pending;
            const pm = PRIORITY_META[cr.priority] || PRIORITY_META.Medium;
            const isApproved = cr.status === 'approved';
            const dl = isApproved && cr.due_date ? daysLeft(cr.due_date) : null;
            const overdue = dl !== null && dl < 0;
            return (
              <motion.div key={cr.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  overdue ? 'border-red-200 shadow-red-50' : 'border-gray-100 hover:border-indigo-100 hover:shadow-md'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tm.bg} ${tm.color}`}>{tm.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pm.bg} ${pm.color}`}>{cr.priority}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          {sm.label}
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Overdue {Math.abs(dl!)}d
                          </span>
                        )}
                        {!overdue && dl !== null && dl <= 3 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {dl === 0 ? 'Due today' : `${dl}d left`}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-gray-900 leading-snug mb-0.5">{cr.title}</h3>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{cr.description}</p>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                        <span className="font-semibold text-gray-600">{cr.project_name}</span>
                        <span>·</span>
                        <span>{cr.client_name}</span>
                        <span>·</span>
                        <span>{new Date(cr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>

                      {/* Response comment */}
                      {cr.response_comments && (
                        <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 border border-gray-100">
                          <span className="font-semibold text-gray-400">Response: </span>{cr.response_comments}
                        </div>
                      )}

                      {/* Approved deadline */}
                      {isApproved && cr.due_date && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 ${
                          overdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          CSM closure deadline: {new Date(cr.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {overdue ? ` (${Math.abs(dl!)} day${Math.abs(dl!) !== 1 ? 's' : ''} overdue)` : dl !== null ? ` (${dl} day${dl !== 1 ? 's' : ''} left)` : ''}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    {cr.status !== 'closed' && cr.status !== 'rejected' && (
                      <button
                        onClick={() => { setReview(cr); setAction(null); setComments(''); }}
                        className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                      >
                        Review →
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Project | null>(null);
  const [approving, setApproving]     = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('filter') || 'ALL';
  });

  // Sync filter when navigating here with ?filter=... (e.g. from bell notification)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const f = params.get('filter');
    if (f) setActiveFilter(f);
  }, [location.search]);

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'A';

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/projects');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleApprove = async (id: number) => {
    setApproving(true);
    try {
      await fetch(`http://localhost:3001/api/projects/${id}/approve`, { method: 'POST' });
      await fetchProjects();
      setSelected(prev => prev ? { ...prev, status: 'APPROVED' } : null);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: number) => {
    setApproving(true);
    try {
      await fetch(`http://localhost:3001/api/projects/${id}/reject`, { method: 'POST' });
      await fetchProjects();
      setSelected(null);
    } finally {
      setApproving(false);
    }
  };

  const atRiskCount = React.useMemo(() =>
    projects.filter(p => ['ACTIVE','APPROVED'].includes(p.status)).filter(p => computeRiskSignals(p).signals.length > 0).length
  , [projects]);

  const FILTERS = [
    { key: 'ALL',               label: 'All' },
    { key: 'AWAITING_APPROVAL', label: 'Pending Approval' },
    { key: 'APPROVED',          label: 'Approved' },
    { key: 'ACTIVE',            label: 'Active' },
    { key: 'AT_RISK',           label: 'At Risk' },
    { key: 'WBS_TRACKER',       label: 'WBS Tracker' },
  ];

  const filtered = activeFilter === 'ALL' ? projects : projects.filter(p => p.status === activeFilter);
  const pendingCount = projects.filter(p => p.status === 'AWAITING_APPROVAL').length;

  return (
    <>
      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <ProjectDrawer
            project={selected}
            onClose={() => setSelected(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            approving={approving}
          />
        )}
      </AnimatePresence>

      <div className="flex h-screen bg-[#F8F9FC] overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">Chaos</p>
              <p className="text-sm font-bold text-indigo-400 leading-tight">Coordinator</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Menu</p>
            <button
              onClick={() => navigate('/admin-dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                window.location.pathname === '/admin-dashboard'
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
              {pendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/projects')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                window.location.pathname === '/projects'
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              All Projects
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                window.location.pathname === '/analytics'
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </button>
            <button
              onClick={() => setActiveFilter('CLIENT_REQUESTS')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'CLIENT_REQUESTS'
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Client Requests
            </button>
            <button
              onClick={() => setActiveFilter('USER_MANAGEMENT')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'USER_MANAGEMENT'
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User Management
            </button>

            <div className="my-3 border-t border-white/10" />
            <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Overview</p>
            {[
              { label: 'Pending Approval', count: projects.filter(p => p.status === 'AWAITING_APPROVAL').length, color: 'bg-violet-500' },
              { label: 'Approved',          count: projects.filter(p => p.status === 'APPROVED').length,          color: 'bg-emerald-500' },
              { label: 'Total Projects',    count: projects.length,                                                color: 'bg-blue-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  {item.label}
                </div>
                <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">{item.count}</span>
              </div>
            ))}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'Admin'}</p>
                <p className="text-xs text-white/50">Admin</p>
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

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
              {activeFilter === 'USER_MANAGEMENT' ? 'User Management' : activeFilter === 'CLIENT_REQUESTS' ? 'Client Requests' : 'Admin Approval Dashboard'}
            </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user?.id && (
                <div className="bg-slate-800 rounded-lg">
                  <NotificationBell userId={user.id} pendingApprovals={pendingCount} />
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-6">

            {/* Stats + filter tabs — hidden on User Management / Client Requests views */}
            {activeFilter !== 'USER_MANAGEMENT' && activeFilter !== 'CLIENT_REQUESTS' && (
              <>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Projects',    value: projects.length,                                                color: 'text-gray-900'   },
                    { label: 'Pending Approval',  value: projects.filter(p => p.status === 'AWAITING_APPROVAL').length, color: 'text-violet-600' },
                    { label: 'Approved',          value: projects.filter(p => p.status === 'APPROVED').length,          color: 'text-emerald-600'},
                    { label: 'Active',            value: projects.filter(p => p.status === 'ACTIVE').length,            color: 'text-blue-600'   },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm"
                    >
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{s.label}</p>
                      <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-2 mb-5">
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        activeFilter === f.key
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {f.label}
                      {f.key === 'AWAITING_APPROVAL' && pendingCount > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                      )}
                      {f.key === 'AT_RISK' && atRiskCount > 0 && (
                        <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{atRiskCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Client Requests view */}
            {activeFilter === 'CLIENT_REQUESTS' ? (
              <ClientRequestsView />
            ) : activeFilter === 'USER_MANAGEMENT' ? (
              <UserManagementView />
            ) : activeFilter === 'WBS_TRACKER' ? (
              loading ? (
                <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading…</div>
              ) : (
                <WBSTrackerView projects={projects} />
              )
            ) : activeFilter === 'AT_RISK' ? (
              loading ? (
                <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading…</div>
              ) : (
                <AtRiskView projects={projects} onSelectProject={p => setSelected(p)} />
              )
            ) : (

            /* Project list */
            loading ? (
              <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading projects…</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
                <p className="text-sm text-gray-400">No projects in this category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((project, i) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelected(project)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-1 h-12 rounded-full flex-shrink-0 ${
                          project.status === 'AWAITING_APPROVAL' ? 'bg-violet-400' :
                          project.status === 'APPROVED'          ? 'bg-emerald-400' :
                          project.status === 'ACTIVE'            ? 'bg-green-400' :
                          'bg-gray-200'
                        }`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{project.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{project.client_name}</p>
                          <p className="text-xs text-gray-400 mt-1">Submitted by {project.owner_name} · {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {project.project_type && (
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{project.project_type}</span>
                        )}
                        <StatusBadge status={project.status} />
                        {project.status === 'AWAITING_APPROVAL' && (
                          <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg">Review →</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
