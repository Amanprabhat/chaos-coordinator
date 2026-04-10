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

        {/* CTO Decision */}
        {canDecide && (
          <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CTO Decision</p>

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
            Approved by CTO
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [projects, setProjects]       = useState<Project[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Project | null>(null);
  const [approving, setApproving]     = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

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

  const FILTERS = [
    { key: 'ALL',              label: 'All' },
    { key: 'AWAITING_APPROVAL', label: 'Pending Approval' },
    { key: 'APPROVED',          label: 'Approved' },
    { key: 'ACTIVE',            label: 'Active' },
    { key: 'WBS_TRACKER',       label: '📋 WBS Tracker' },
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
                <p className="text-xs text-white/50">CTO / Admin</p>
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
              <h1 className="text-xl font-bold text-gray-900">CTO Approval Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm font-semibold text-violet-700">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  {pendingCount} project{pendingCount > 1 ? 's' : ''} awaiting your approval
                </div>
              )}
              {user?.id && (
                <div className="bg-slate-800 rounded-lg">
                  <NotificationBell userId={user.id} />
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-6">

            {/* Stats */}
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
                </button>
              ))}
            </div>

            {/* WBS Tracker view */}
            {activeFilter === 'WBS_TRACKER' ? (
              loading ? (
                <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading…</div>
              ) : (
                <WBSTrackerView projects={projects} />
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
