import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';
import DiscussionForum from '../components/DiscussionForum';

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface WBSTask {
  id: number; wbs: string; phase: string; sprint: number;
  sprint_label: string; sprint_week: string; deliverable: string;
  type?: string; // 'Phase' | 'Summary' | 'Task' | 'Milestone' | 'Deliverable' | 'Client Requirement' | 'Assumption' | 'Risk'
  name: string; day_start: number; day_end: number; duration_days: number;
  owner_role: string; status: string; tentative: boolean;
  total_working_days: number; planned_start?: string; planned_end?: string;
  depends_on?: string; // comma-separated WBS codes, e.g. "1.1.1, 1.1.2"
  notes?: string;
}

interface StartDateLog {
  id: number; project_id: number; action: string; created_at: string;
  details: { old_date?: string; new_date: string; reason: string; changed_by: string; is_initial?: boolean };
}

interface Project {
  id: number; name: string; client_name: string; status: string;
  priority: string; project_type: string; deployment_region: string;
  deployment_type: string; sso_required: boolean; csm_name: string;
  pm_name: string; product_manager_name: string; owner_name: string;
  expected_timeline: string; go_live_deadline: string;
  integrations_required: boolean; integration_details: string;
  client_spoc_name: string; client_spoc_email: string; client_spoc_mobile: string;
  business_objective: string; num_users: number; success_criteria: string;
  current_tools: string; budget_range: string; sow_file_path: string;
  sow_file_name: string; sow_file_size: number; project_plan: string;
  project_start_date: string; stage_name: string; meeting_date: string;
  mom_text: string; created_at: string;
}

interface Milestone {
  id: number; project_id: number; name: string; description?: string;
  status: string; due_date: string;
}

interface Risk {
  id: number; project_id: number; title: string; description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'mitigated' | 'resolved' | 'accepted';
  created_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  INTAKE_CREATED:    { label: 'Intake Created',    bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400'  },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  APPROVED:          { label: 'Approved',          bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500'},
  ACTIVE:            { label: 'Active',            bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
};

const SPRINT_COLORS: Record<number, { bg: string; text: string; border: string; bar: string }> = {
  0: { bg: 'bg-slate-50',  text: 'text-slate-700',  border: 'border-slate-200', bar: 'bg-slate-400'  },
  1: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200',bar: 'bg-indigo-500' },
  2: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  bar: 'bg-blue-500'   },
  3: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', bar: 'bg-amber-500'  },
  4: { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',bar: 'bg-emerald-500'},
  5: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200',bar: 'bg-violet-500' },
};

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string; icon?: string; labelBg: string; labelText: string }> = {
  'Phase':              { bg: 'bg-slate-800',    text: 'text-white',        border: 'border-slate-700',   labelBg: 'bg-slate-700',    labelText: 'text-slate-200' },
  'Summary':            { bg: 'bg-slate-100',    text: 'text-slate-700',    border: 'border-slate-300',   labelBg: 'bg-slate-200',    labelText: 'text-slate-700' },
  'Task':               { bg: 'bg-white',        text: 'text-gray-800',     border: 'border-gray-100',    labelBg: 'bg-blue-50',      labelText: 'text-blue-700' },
  'Milestone':          { bg: 'bg-amber-50',     text: 'text-amber-900',    border: 'border-amber-300',   icon: '◆', labelBg: 'bg-amber-100',    labelText: 'text-amber-700' },
  'Deliverable':        { bg: 'bg-emerald-50',   text: 'text-emerald-900',  border: 'border-emerald-200', labelBg: 'bg-emerald-100',  labelText: 'text-emerald-700' },
  'Client Requirement': { bg: 'bg-orange-50',    text: 'text-orange-900',   border: 'border-orange-200',  labelBg: 'bg-orange-100',   labelText: 'text-orange-700' },
  'Assumption':         { bg: 'bg-violet-50',    text: 'text-violet-900',   border: 'border-violet-200',  labelBg: 'bg-violet-100',   labelText: 'text-violet-700' },
  'Risk':               { bg: 'bg-red-50',       text: 'text-red-900',      border: 'border-red-200',     labelBg: 'bg-red-100',      labelText: 'text-red-700' },
};

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  low:      { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Low'      },
  medium:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Medium'   },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High'     },
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Critical' },
};

const RISK_STATUS_LABELS: Record<string, string> = {
  open: 'Open', mitigated: 'Mitigated', resolved: 'Resolved', accepted: 'Accepted',
};

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  High:   { bg: 'bg-red-100',    text: 'text-red-700'    },
  Medium: { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  Low:    { bg: 'bg-emerald-100',text: 'text-emerald-700'},
};

const TASK_STATUS_CYCLE = ['not_started', 'in_progress', 'completed', 'blocked', 'not_required'] as const;
const OWNER_ROLES = ['CSM', 'PM', 'Dev', 'QA', 'Client', 'Sales', 'Admin'];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function addWorkingDays(startDate: string, days: number): string {
  if (days <= 0) return startDate;
  const date = new Date(startDate + 'T00:00:00');
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const d = date.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return date.toISOString().split('T')[0];
}

function recalcDates(tasks: WBSTask[], startDate: string): WBSTask[] {
  return tasks.map(t => ({
    ...t,
    planned_start: addWorkingDays(startDate, t.day_start - 1),
    planned_end:   addWorkingDays(startDate, t.day_end - 1),
    tentative:     false,
  }));
}

function toXLSXBlob(headers: string[], rows: (string | number)[][], sheetName: string): Blob {
  const esc = (v: string | number) => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const xmlRows = [headers, ...rows].map(row =>
    `<Row>${row.map(c => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`
  ).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${esc(sheetName)}"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-xs font-medium text-gray-800 flex-1">{value}</dd>
    </div>
  );
};

const MetaRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <dt className="text-xs text-gray-400">{label}</dt>
    <dd className="text-xs font-semibold text-gray-700">{value}</dd>
  </div>
);

const TeamMember: React.FC<{ role: string; name?: string | null }> = ({ role, name }) => {
  if (!name) return null;
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-600 text-[11px] font-bold">{name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
        <p className="text-[10px] text-gray-400">{role}</p>
      </div>
    </div>
  );
};

const StatusChip: React.FC<{ status: string; onClick?: () => void; editable?: boolean }> = ({ status, onClick, editable }) => {
  const cfg: Record<string, string> = {
    not_started:   'bg-gray-100 text-gray-500',
    in_progress:   'bg-blue-50 text-blue-600',
    completed:     'bg-emerald-50 text-emerald-600',
    blocked:       'bg-red-50 text-red-600',
    tentative:     'bg-amber-50 text-amber-600',
    not_required:  'bg-slate-100 text-slate-400 line-through',
  };
  return (
    <span
      onClick={onClick}
      title={editable ? 'Click to change status' : undefined}
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${cfg[status] || 'bg-gray-100 text-gray-500'} ${editable ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition-all' : ''}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const ProjectDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [project, setProject]       = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [risks, setRisks]           = useState<Risk[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState<'overview' | 'wbs' | 'gantt' | 'discussion'>(() => {
    const t = new URLSearchParams(location.search).get('tab');
    return (t === 'wbs' || t === 'gantt' || t === 'discussion') ? t : 'overview';
  });

  // ── WBS edit state ─────────────────────────────────────────────────────────
  const [editMode, setEditMode]       = useState(false);
  const [localTasks, setLocalTasks]   = useState<WBSTask[]>([]);
  const [savingPlan, setSavingPlan]   = useState(false);
  // Add-task form: keyed by sprint number
  const [addTaskSprint, setAddTaskSprint] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState({ name: '', ownerRole: 'CSM', duration: 2 });
  // Add-sprint form
  const [showAddSprint, setShowAddSprint] = useState(false);
  const [sprintForm, setSprintForm] = useState({ label: '', week: '', deliverable: '' });

  // ── Milestone edit state ───────────────────────────────────────────────────
  const [newMilestone, setNewMilestone] = useState({ name: '', due_date: '', sprint: '', dependency: '' });
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);

  // ── Risk state ─────────────────────────────────────────────────────────────
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskForm, setRiskForm] = useState({ title: '', description: '', severity: 'medium', status: 'open' });
  const [savingRisk, setSavingRisk] = useState(false);

  // ── Start date state ───────────────────────────────────────────────────────
  const [startDateLogs, setStartDateLogs] = useState<StartDateLog[]>([]);
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showStartDateEdit, setShowStartDateEdit] = useState(false);
  const [startDateForm, setStartDateForm] = useState({ date: '', reason: '', total_days: '' });
  const [savingStartDate, setSavingStartDate] = useState(false);
  const [startDateError, setStartDateError] = useState('');

  // ── WBS collapse state ─────────────────────────────────────────────────────
  const [collapsedSprints, setCollapsedSprints] = useState<Set<number>>(new Set());
  // ── Sprint inline edit state ───────────────────────────────────────────────
  const [editingSprintNum, setEditingSprintNum] = useState<number | null>(null);
  const [editingSprintLabel, setEditingSprintLabel] = useState('');

  // ── Role-based permissions ─────────────────────────────────────────────────
  const canEdit = user?.role === 'CSM'
    || (user?.role === 'PM' && user?.department === 'Project Management')
    || user?.role === 'Admin';

  // All PMs, CSMs, Admins can manage start date (not just Project Management dept PMs)
  const canEditStartDate = user?.role === 'CSM' || user?.role === 'PM' || user?.role === 'Admin';

  const dashboardPath =
    user?.role === 'CSM'   ? '/csm-dashboard'  :
    user?.role === 'PM'    ? '/pm-dashboard'    :
    user?.role === 'Admin' ? '/admin-dashboard' : '/sales-dashboard';

  // ── Sidebar scroll lock ────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => { document.body.classList.remove('sidebar-open'); };
  }, [sidebarOpen]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    if (!id) return;
    setLoading(true); setError(null);
    Promise.all([
      fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}`).then(r => { if (!r.ok) throw new Error('Project not found'); return r.json(); }),
      fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/milestones`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/risks`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/start-date-logs`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([proj, mils, rsks, logs]) => {
      setProject(proj);
      setMilestones(Array.isArray(mils) ? mils : []);
      setRisks(Array.isArray(rsks) ? rsks : []);
      setStartDateLogs(Array.isArray(logs) ? logs : []);
      // Prompt CSM/PM if no start date is set yet
      if (!proj.project_start_date && (user?.role === 'CSM' || (user?.role === 'PM' && user?.department === 'Project Management') || user?.role === 'Admin')) {
        setShowStartDateModal(true);
      }
    }).catch(err => setError(err.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Parsed / derived ───────────────────────────────────────────────────────
  const tasks: WBSTask[] = React.useMemo(() => {
    if (!project?.project_plan) return [];
    try { const p = JSON.parse(project.project_plan); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [project?.project_plan]);

  const totalDays = tasks.length > 0
    ? Math.max(...tasks.map(t => t.day_end), tasks[0]?.total_working_days || 30)
    : 30;

  const displayTasks = editMode ? localTasks : tasks;
  const tasksBySprint = React.useMemo(() => {
    const map = new Map<number, WBSTask[]>();
    displayTasks.forEach(t => { if (!map.has(t.sprint)) map.set(t.sprint, []); map.get(t.sprint)!.push(t); });
    return map;
  }, [displayTasks]);

  // ── WBS handlers ──────────────────────────────────────────────────────────
  const enterEditMode = () => { setLocalTasks([...tasks]); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setAddTaskSprint(null); setShowAddSprint(false); setEditingSprintNum(null); };

  const deleteTask = (taskId: number) => {
    setLocalTasks(prev => {
      const deleted = prev.find(t => t.id === taskId);
      if (!deleted) return prev;
      const shift = deleted.duration_days;
      const cutoff = deleted.day_end; // tasks starting after deleted.day_end shift back
      const remaining = prev
        .filter(t => t.id !== taskId)
        .map(t => {
          if (t.day_start > cutoff) {
            const newStart = t.day_start - shift;
            const newEnd   = t.day_end   - shift;
            return {
              ...t,
              day_start: newStart,
              day_end:   newEnd,
              planned_start: project?.project_start_date ? addWorkingDays(project.project_start_date, newStart - 1) : t.planned_start,
              planned_end:   project?.project_start_date ? addWorkingDays(project.project_start_date, newEnd   - 1) : t.planned_end,
            };
          }
          return t;
        });
      const newMax = Math.max(...remaining.map(t => t.day_end), 0);
      return remaining.map(t => ({ ...t, total_working_days: newMax }));
    });
  };

  const addTaskToSprint = (sprintNum: number) => {
    if (!taskForm.name.trim()) return;
    const sprintTasks = localTasks.filter(t => t.sprint === sprintNum);
    const lastTask = sprintTasks[sprintTasks.length - 1];
    const dayStart = lastTask ? lastTask.day_end + 1 : 1;
    const dayEnd = dayStart + taskForm.duration - 1;
    const sprintRef = localTasks.find(t => t.sprint === sprintNum);
    const newTask: WBSTask = {
      id: Date.now(),
      wbs: `${sprintNum}.${sprintTasks.length + 1}`,
      phase: sprintRef?.phase || `Sprint ${sprintNum}`,
      sprint: sprintNum,
      sprint_label: sprintRef?.sprint_label || `Sprint ${sprintNum}`,
      sprint_week: sprintRef?.sprint_week || '',
      deliverable: sprintRef?.deliverable || '',
      name: taskForm.name.trim(),
      day_start: dayStart,
      day_end: dayEnd,
      duration_days: taskForm.duration,
      owner_role: taskForm.ownerRole,
      status: 'not_started',
      tentative: !project?.project_start_date,
      total_working_days: 0, // will be updated below
      planned_start: project?.project_start_date ? addWorkingDays(project.project_start_date, dayStart - 1) : undefined,
      planned_end:   project?.project_start_date ? addWorkingDays(project.project_start_date, dayEnd - 1)   : undefined,
    };
    // Tasks that start after this sprint's last task must shift forward
    const shift = taskForm.duration;
    const insertAfterDay = lastTask ? lastTask.day_end : 0;
    const updatedExisting = localTasks.map(t => {
      if (t.day_start > insertAfterDay) {
        const newStart = t.day_start + shift;
        const newEnd   = t.day_end   + shift;
        return {
          ...t,
          day_start: newStart,
          day_end:   newEnd,
          planned_start: project?.project_start_date ? addWorkingDays(project.project_start_date, newStart - 1) : t.planned_start,
          planned_end:   project?.project_start_date ? addWorkingDays(project.project_start_date, newEnd   - 1) : t.planned_end,
        };
      }
      return t;
    });
    const allTasks = [...updatedExisting, newTask];
    const newTotalWD = Math.max(...allTasks.map(t => t.day_end));
    const finalTasks = allTasks.map(t => ({ ...t, total_working_days: newTotalWD }));
    setLocalTasks(finalTasks);
    setTaskForm({ name: '', ownerRole: 'CSM', duration: 2 });
    setAddTaskSprint(null);
  };

  const addNewSprint = () => {
    if (!sprintForm.label.trim()) return;
    const maxSprint = localTasks.length > 0 ? Math.max(...localTasks.map(t => t.sprint)) : 0;
    const newSprintNum = maxSprint + 1;
    const lastTask = localTasks[localTasks.length - 1];
    const dayStart = lastTask ? lastTask.day_end + 1 : 1;
    const newTask: WBSTask = {
      id: Date.now(),
      wbs: `${newSprintNum}.1`,
      phase: sprintForm.label,
      sprint: newSprintNum,
      sprint_label: sprintForm.label,
      sprint_week: sprintForm.week,
      deliverable: sprintForm.deliverable,
      name: `${sprintForm.label} — Planning`,
      day_start: dayStart,
      day_end: dayStart + 1,
      duration_days: 2,
      owner_role: 'CSM',
      status: 'not_started',
      tentative: true,
      total_working_days: tasks[0]?.total_working_days || 50,
    };
    setLocalTasks(prev => [...prev, newTask]);
    setSprintForm({ label: '', week: '', deliverable: '' });
    setShowAddSprint(false);
  };

  const savePlan = async () => {
    if (!id) return;
    setSavingPlan(true);
    try {
      // Save WBS plan
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_plan: localTasks,
          changed_by_id: user?.id,
          changed_by_name: user?.name,
          changed_by_role: user?.role,
        }),
      });
      if (!res.ok) throw new Error('Save failed');

      // Auto-update go_live_deadline if we have a project start date
      if (project?.project_start_date && localTasks.length > 0) {
        const maxDayEnd = Math.max(...localTasks.map(t => t.day_end));
        const newGoLive = addWorkingDays(project.project_start_date, maxDayEnd - 1);
        try {
          await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ go_live_deadline: newGoLive }),
          });
          setProject(prev => prev ? { ...prev, project_plan: JSON.stringify(localTasks), go_live_deadline: newGoLive } : prev);
        } catch {
          setProject(prev => prev ? { ...prev, project_plan: JSON.stringify(localTasks) } : prev);
        }
      } else {
        setProject(prev => prev ? { ...prev, project_plan: JSON.stringify(localTasks) } : prev);
      }

      setEditMode(false);
    } catch (e) { alert('Failed to save plan. Please try again.'); }
    finally { setSavingPlan(false); }
  };

  // Direct status set for WBS dropdown (works in and out of edit mode)
  const setTaskStatus = async (task: WBSTask, newStatus: string) => {
    if (!canEdit) return;
    if (editMode) {
      setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      return;
    }

    const prevStatus = task.status;
    const wasNotRequired = prevStatus === 'not_required';
    const isNowNotRequired = newStatus === 'not_required';

    // Start with the status change applied
    let updated = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);

    // Shift subsequent tasks when toggling not_required
    if (project?.project_start_date && wasNotRequired !== isNowNotRequired) {
      const shift = isNowNotRequired ? -task.duration_days : task.duration_days;
      // When marking not_required: shift tasks starting after this task ends
      // When restoring: shift tasks starting after this task's start (to reclaim the gap)
      const threshold = isNowNotRequired ? task.day_end : task.day_start;

      updated = updated.map(t => {
        if (t.id === task.id) return t;
        if (t.day_start > threshold) {
          const newDayStart = Math.max(1, t.day_start + shift);
          const newDayEnd   = Math.max(newDayStart, t.day_end + shift);
          return {
            ...t,
            day_start:     newDayStart,
            day_end:       newDayEnd,
            planned_start: addWorkingDays(project.project_start_date!, newDayStart - 1),
            planned_end:   addWorkingDays(project.project_start_date!, newDayEnd   - 1),
          };
        }
        return t;
      });
    }

    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_plan: updated,
          changed_by_id: user?.id,
          changed_by_name: user?.name,
          changed_by_role: user?.role,
        }),
      });

      // Recalculate go_live_deadline excluding not_required tasks
      if (project?.project_start_date) {
        const activeTasks = updated.filter(t => t.status !== 'not_required' && t.day_end != null);
        const maxDayEnd = activeTasks.length > 0 ? Math.max(...activeTasks.map(t => t.day_end)) : 0;
        if (maxDayEnd > 0) {
          const newGoLive = addWorkingDays(project.project_start_date, maxDayEnd - 1);
          await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ go_live_deadline: newGoLive }),
          });
          setProject(prev => prev ? { ...prev, project_plan: JSON.stringify(updated), go_live_deadline: newGoLive } : prev);
          return;
        }
      }

      setProject(prev => prev ? { ...prev, project_plan: JSON.stringify(updated) } : prev);
    } catch { /* silent */ }
  };

  // ── Sprint collapse toggle ────────────────────────────────────────────────
  const toggleSprint = (sprintNum: number) => {
    setCollapsedSprints(prev => {
      const next = new Set(prev);
      next.has(sprintNum) ? next.delete(sprintNum) : next.add(sprintNum);
      return next;
    });
  };

  // ── Sprint label edit ─────────────────────────────────────────────────────
  const startSprintEdit = (sprintNum: number, currentName: string) => {
    setEditingSprintNum(sprintNum);
    setEditingSprintLabel(currentName);
  };

  const commitSprintLabel = (sprintNum: number, newName: string) => {
    if (newName.trim()) {
      setLocalTasks(prev => prev.map(t =>
        t.sprint === sprintNum
          ? { ...t, sprint_label: newName.trim(), name: t.type === 'Summary' ? newName.trim() : t.name }
          : t
      ));
    }
    setEditingSprintNum(null);
  };

  // ── Start date handlers ───────────────────────────────────────────────────
  const saveStartDate = async (isInitial: boolean) => {
    setStartDateError('');
    if (!startDateForm.date) { setStartDateError('Please select a date.'); return; }
    if (!isInitial && startDateForm.reason.trim().length < 5) {
      setStartDateError('Please provide a clear reason (min 5 characters).');
      return;
    }
    setSavingStartDate(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/start-date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDateForm.date,
          reason: startDateForm.reason || 'Initial project start date',
          changed_by_name: user?.name || 'Unknown',
          is_initial: isInitial,
          total_days: startDateForm.total_days ? parseInt(startDateForm.total_days) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setStartDateError(d.error || 'Failed to save.');
        return;
      }
      // Refetch the full joined project + logs in parallel
      const [projRes, logsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}`),
        fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/start-date-logs`),
      ]);
      if (projRes.ok) setProject(await projRes.json());
      if (logsRes.ok) setStartDateLogs(await logsRes.json());
      setShowStartDateModal(false);
      setShowStartDateEdit(false);
      setStartDateForm({ date: '', reason: '', total_days: '' });
    } catch { setStartDateError('Network error. Please try again.'); }
    finally { setSavingStartDate(false); }
  };

  // ── Milestone handlers ─────────────────────────────────────────────────────
  const addMilestone = async () => {
    if (!newMilestone.name.trim() || !id) return;
    setSavingMilestone(true);
    const descMeta = (newMilestone.sprint || newMilestone.dependency)
      ? JSON.stringify({ sprint: newMilestone.sprint, dependency: newMilestone.dependency })
      : undefined;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: Number(id),
          name: newMilestone.name.trim(),
          due_date: newMilestone.due_date || null,
          status: 'pending',
          description: descMeta,
          created_by: user?.id,
        }),
      });
      if (!res.ok) throw new Error();
      const m: Milestone = await res.json();
      setMilestones(prev => [...prev, m]);
      setNewMilestone({ name: '', due_date: '', sprint: '', dependency: '' });
      setShowMilestoneForm(false);
    } catch { alert('Failed to add milestone'); }
    finally { setSavingMilestone(false); }
  };

  const deleteMilestone = async (milestoneId: number) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/milestones/${milestoneId}`, { method: 'DELETE' });
      setMilestones(prev => prev.filter(m => m.id !== milestoneId));
    } catch { /* silent */ }
  };

  const toggleMilestoneStatus = async (m: Milestone) => {
    const next = m.status === 'completed' ? 'pending' : m.status === 'pending' ? 'in_progress' : 'completed';
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/milestones/${m.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, status: next } : x));
    } catch { /* silent */ }
  };

  // ── Risk handlers ──────────────────────────────────────────────────────────
  const addRisk = async () => {
    if (!riskForm.title.trim() || !id) return;
    setSavingRisk(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/risks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskForm),
      });
      if (!res.ok) throw new Error();
      const r: Risk = await res.json();
      setRisks(prev => [r, ...prev]);
      setRiskForm({ title: '', description: '', severity: 'medium', status: 'open' });
      setShowRiskForm(false);
    } catch { alert('Failed to add risk'); }
    finally { setSavingRisk(false); }
  };

  const deleteRisk = async (riskId: number) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/risks/${riskId}`, { method: 'DELETE' });
      setRisks(prev => prev.filter(r => r.id !== riskId));
    } catch { /* silent */ }
  };

  const updateRiskStatus = async (risk: Risk, newStatus: string) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/risks/${risk.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setRisks(prev => prev.map(r => r.id === risk.id ? { ...r, status: newStatus as Risk['status'] } : r));
    } catch { /* silent */ }
  };

  // ── Export handlers ────────────────────────────────────────────────────────
  const downloadWBSCsv = () => {
    const headers = ['WBS #','Phase','Sprint','Type','Task/Deliverable','Owner','Start Date','End Date','Duration','Status','Dependencies','Notes'];
    const rows: (string|number)[][] = displayTasks.map(t => [
      t.wbs,
      t.phase || '',
      t.sprint >= 0 ? t.sprint_label || `Sprint ${t.sprint}` : '',
      t.type || 'Task',
      t.name,
      t.owner_role || '',
      t.planned_start || `Day ${t.day_start}`,
      t.planned_end   || `Day ${t.day_end}`,
      t.duration_days,
      t.status,
      t.depends_on || '',
      t.notes || '',
    ]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv],{type:'text/csv'}), `${project?.name}_WBS.csv`);
  };

  const downloadWBSXlsx = () => {
    const headers = ['WBS #','Phase','Sprint','Type','Task/Deliverable','Owner','Start Date','End Date','Duration','Status','Dependencies','Notes'];
    const rows: (string|number)[][] = displayTasks.map(t => [
      t.wbs,
      t.phase || '',
      t.sprint >= 0 ? t.sprint_label || `Sprint ${t.sprint}` : '',
      t.type || 'Task',
      t.name,
      t.owner_role || '',
      t.planned_start || `Day ${t.day_start}`,
      t.planned_end   || `Day ${t.day_end}`,
      t.duration_days,
      t.status,
      t.depends_on || '',
      t.notes || '',
    ]);
    downloadBlob(toXLSXBlob(headers, rows, 'WBS'), `${project?.name}_WBS.xls`);
  };

  const downloadGanttCsv = () => {
    const headers = ['Task','Sprint','Day Start','Day End','Duration','Planned Start','Planned End','Owner','Status'];
    const rows = tasks.map(t => [t.name, t.sprint_label||`Sprint ${t.sprint}`, t.day_start, t.day_end, t.duration_days, t.planned_start||'', t.planned_end||'', t.owner_role, t.status]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv],{type:'text/csv'}), `${project?.name}_Gantt.csv`);
  };

  const printGantt = () => {
    const style = document.createElement('style');
    style.id = '__gantt_print';
    style.textContent = `@media print { body > * { display:none!important; } #gantt-printable { display:block!important; position:fixed; top:0; left:0; width:100%; z-index:99999; background:white; padding:16px; } @page { size:landscape; margin:10mm; } }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById('__gantt_print')?.remove(), 500);
  };

  // ── Render: loading / error ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading project…</p>
      </div>
    </div>
  );

  if (error || !project) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-xl font-semibold text-gray-700 mb-2">Project not found</p>
        <p className="text-sm text-gray-400 mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">← Go Back</button>
      </div>
    </div>
  );

  const statusCfg  = STATUS_CONFIG[project.status] || { label: project.status, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };
  const priorityCfg = PRIORITY_CONFIG[project.priority] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className={`sidebar-drawer fixed inset-y-0 left-0 z-30 w-72 bg-slate-900 flex flex-col flex-shrink-0
        lg:relative lg:translate-x-0 lg:w-64 lg:h-screen lg:sticky lg:top-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo — consistent with other dashboards */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo192.png" alt="Chaos Coordinator" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg" />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Chaos Coordinator</p>
              <p className="text-slate-400 text-[10px]">Project OS</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} aria-label="Close navigation"
            className="lg:hidden p-1.5 text-white/40 hover:text-white rounded-md transition-colors flex-shrink-0">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button onClick={() => navigate(dashboardPath)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </button>
          <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            All Projects
          </button>

          {/* Current project indicator */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">Current Project</p>
            <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/60">
              <p className="text-xs font-semibold text-white truncate">{project.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{project.client_name}</p>
            </div>
          </div>
        </nav>

        {/* User info + bell */}
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{user?.name?.charAt(0).toUpperCase() || '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.role || ''}</p>
            </div>
            {user && <NotificationBell userId={user.id} theme="dark" />}
            <button onClick={logout} title="Logout" className="text-slate-400 hover:text-white transition-colors ml-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">

        {/* Header bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-start gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open navigation"
            className="lg:hidden mt-0.5 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => navigate(-1)} className="mt-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />{statusCfg.label}
              </span>
              {project.priority && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${priorityCfg.bg} ${priorityCfg.text}`}>{project.priority} Priority</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{project.client_name}</span>
              {project.sow_file_path
                ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>SOW Attached</span>
                : <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>SOW Missing</span>
              }
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">

          {/* ── CENTER PANEL ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-auto">

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 flex-shrink-0 overflow-x-auto">
              <div className="flex gap-0 min-w-max">
                {([
                  { id: 'overview',    label: 'Overview'    },
                  { id: 'wbs',         label: 'WBS Plan'    },
                  { id: 'gantt',       label: 'Gantt Chart' },
                  { id: 'discussion',  label: 'Discussion'  },
                ] as const).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab===tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-6">

              {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="max-w-5xl space-y-5">
                  {project.business_objective && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Business Objective</h3>
                      <p className="text-sm text-indigo-900 leading-relaxed">{project.business_objective}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Client Info</h3>
                      <dl className="space-y-2.5">
                        <InfoRow label="Client"       value={project.client_name} />
                        <InfoRow label="SPOC"         value={project.client_spoc_name} />
                        <InfoRow label="Email"        value={project.client_spoc_email} />
                        <InfoRow label="Mobile"       value={project.client_spoc_mobile} />
                        <InfoRow label="No. of Users" value={project.num_users?.toString()} />
                        <InfoRow label="Current Tools"value={project.current_tools} />
                      </dl>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Team</h3>
                      <dl className="space-y-2.5">
                        <InfoRow label="Sales Owner"      value={project.owner_name} />
                        <InfoRow label="CSM"              value={project.csm_name} />
                        <InfoRow label="PM"               value={project.pm_name} />
                        <InfoRow label="Product Manager"  value={project.product_manager_name} />
                      </dl>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Project Details</h3>
                      <dl className="space-y-2.5">
                        <InfoRow label="Type"        value={project.project_type} />
                        <InfoRow label="Region"      value={project.deployment_region} />
                        <InfoRow label="Deployment"  value={project.deployment_type} />
                        <InfoRow label="SSO"         value={project.sso_required ? 'Required' : 'Not Required'} />
                        <InfoRow label="Timeline"    value={project.expected_timeline} />
                        <InfoRow label="Go-Live"     value={fmtDate(project.go_live_deadline)} />
                        <InfoRow label="Budget"      value={project.budget_range} />
                        <InfoRow label="Priority"    value={project.priority} />
                      </dl>
                    </div>
                    {project.integrations_required && project.integration_details && (
                      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
                        <h3 className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-2">Integrations</h3>
                        <p className="text-sm text-violet-900 leading-relaxed">{project.integration_details}</p>
                      </div>
                    )}
                  </div>
                  {project.success_criteria && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Success Criteria</h3>
                      <p className="text-sm text-emerald-900 leading-relaxed">{project.success_criteria}</p>
                    </div>
                  )}
                  {project.mom_text && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Meeting Minutes</h3>
                      {project.meeting_date && <p className="text-[11px] text-amber-500 mb-2">{fmtDate(project.meeting_date)}</p>}
                      <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{project.mom_text}</p>
                    </div>
                  )}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Statement of Work</h3>
                    {project.sow_file_path ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{project.sow_file_name || 'SOW Document'}</p>
                          {project.sow_file_size && <p className="text-xs text-gray-400">{(project.sow_file_size / 1024).toFixed(1)} KB</p>}
                        </div>
                        <a href={`${process.env.REACT_APP_API_URL || ""}/api/projects/${id}/download-sow`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-sm font-medium text-amber-700">SOW Missing — no document has been attached.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── WBS TAB ─────────────────────────────────────────────────── */}
              {activeTab === 'wbs' && (
                <div className="max-w-5xl">
                  {tasks.length === 0 && !editMode ? (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-lg font-semibold mb-1">No WBS Plan</p>
                      <p className="text-sm">No project plan has been generated yet.</p>
                    </div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                        <div>
                          <h2 className="text-sm font-bold text-gray-800">Work Breakdown Structure</h2>
                          <p className="text-xs text-gray-400 mt-0.5">{displayTasks.length} rows
                            {canEdit && !editMode && <span className="ml-2 text-indigo-500">· Use status dropdown to update tasks</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {editMode ? (
                            <>
                              <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                              <button onClick={savePlan} disabled={savingPlan} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                                {savingPlan ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                Save Changes
                              </button>
                            </>
                          ) : (
                            <>
                              {canEdit && (
                                <button onClick={enterEditMode} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  Edit WBS
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                <button onClick={downloadWBSCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  CSV
                                </button>
                                <button onClick={downloadWBSXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  Excel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Legend bar */}
                      <div className="flex items-center gap-2 flex-wrap mb-4 px-1">
                        {Object.entries(TYPE_CONFIG).map(([typeName, cfg]) => (
                          <span key={typeName} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.labelBg} ${cfg.labelText} border-transparent`}>
                            {cfg.icon && <span>{cfg.icon}</span>}
                            {typeName}
                          </span>
                        ))}
                      </div>

                      {/* Column header + rows — horizontally scrollable so no columns are hidden */}
                      <div style={{overflowX:'auto'}}>
                      <div style={{minWidth:'920px'}}>

                      {/* Column header strip — pl matches row indent: pl-4(16) + w-4(16) + gap(8) + w-3(12) + gap(8) = 60px */}
                      <div className="overflow-x-auto -mx-1">
                      <div className="min-w-[700px]">
                      <div className="flex items-center gap-2 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg mb-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider" style={{paddingLeft:'60px'}}>
                        <span className="w-16 flex-shrink-0">WBS #</span>
                        <span className="w-24 flex-shrink-0">Type</span>
                        <span className="flex-1 min-w-0">Task / Deliverable</span>
                        <span className="w-16 flex-shrink-0 text-center">Owner</span>
                        <span className="w-10 flex-shrink-0 text-center">Dur.</span>
                        <span className="w-28 flex-shrink-0 text-center">Status</span>
                        <span className="w-28 flex-shrink-0">Dependencies</span>
                        <span className="w-36 flex-shrink-0 text-right">Dates</span>
                      </div>

                      {/* WBS rows — grouped by phase, then sprint */}
                      {(() => {
                        // Group tasks by phase
                        const phases = new Map<string, WBSTask[]>();
                        displayTasks.forEach(t => {
                          const ph = t.phase || 'Phase 1';
                          if (!phases.has(ph)) phases.set(ph, []);
                          phases.get(ph)!.push(t);
                        });

                        return (
                          <div className="space-y-4">
                            {Array.from(phases.entries()).map(([phaseName, phaseTasks]) => {
                              // Find the Phase header row if present
                              const phaseRow = phaseTasks.find(t => t.type === 'Phase');
                              // Group remaining tasks by sprint
                              const sprintMap = new Map<number, WBSTask[]>();
                              phaseTasks.forEach(t => {
                                if (t.type === 'Phase') return; // rendered separately as header
                                if (!sprintMap.has(t.sprint)) sprintMap.set(t.sprint, []);
                                sprintMap.get(t.sprint)!.push(t);
                              });

                              return (
                                <div key={phaseName} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                  {/* Phase header row */}
                                  <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-slate-400 w-8 flex-shrink-0">{phaseRow?.wbs || ''}</span>
                                    <span className="text-xs font-bold text-white flex-1 min-w-0 truncate">{phaseRow?.name || phaseName}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 flex-shrink-0">Phase</span>
                                  </div>

                                  {/* Sprint groups within this phase */}
                                  <div className="divide-y divide-slate-100">
                                    {Array.from(sprintMap.entries()).sort(([a],[b])=>a-b).map(([sprintNum, sprintTasks]) => {
                                      const summaryRow = sprintTasks.find(t => t.type === 'Summary');
                                      const childRows  = sprintTasks.filter(t => t.type !== 'Summary');
                                      const colors     = SPRINT_COLORS[sprintNum >= 0 ? sprintNum % 6 : 0] || SPRINT_COLORS[0];
                                      const isCollapsed = collapsedSprints.has(sprintNum);
                                      const taskOnlyRows = childRows.filter(t => t.type === 'Task');
                                      const doneCount  = taskOnlyRows.filter(t => t.status === 'completed').length;
                                      const progressPct = taskOnlyRows.length > 0 ? Math.round((doneCount / taskOnlyRows.length) * 100) : 0;

                                      return (
                                        <div key={sprintNum}>
                                          {/* Sprint Summary row — collapsible header */}
                                          <div className={`w-full ${colors.bg} px-4 py-2.5 flex items-center gap-3 border-t border-b ${colors.border} group`}>
                                            <button onClick={() => toggleSprint(sprintNum)} className="flex items-center gap-3 flex-shrink-0">
                                              <svg className={`w-3.5 h-3.5 ${colors.text} flex-shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </button>
                                            <span className={`text-[10px] font-mono font-bold ${colors.text} opacity-60 w-10 flex-shrink-0`}>{summaryRow?.wbs || sprintNum}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bar} text-white flex-shrink-0 whitespace-nowrap`}>
                                              {summaryRow?.sprint_label || (sprintNum != null && !isNaN(Number(sprintNum)) && Number(sprintNum) >= 0 ? `Sprint ${sprintNum}` : phaseName)}
                                            </span>
                                            {/* Sprint title — editable in edit mode */}
                                            {editMode && editingSprintNum === sprintNum ? (
                                              <input
                                                className="flex-1 text-xs border border-current/30 bg-white/20 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/50 min-w-0"
                                                value={editingSprintLabel}
                                                autoFocus
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => setEditingSprintLabel(e.target.value)}
                                                onBlur={() => commitSprintLabel(sprintNum, editingSprintLabel)}
                                                onKeyDown={e => {
                                                  e.stopPropagation();
                                                  if (e.key === 'Enter') commitSprintLabel(sprintNum, editingSprintLabel);
                                                  if (e.key === 'Escape') setEditingSprintNum(null);
                                                }}
                                              />
                                            ) : (
                                              <button
                                                onClick={() => toggleSprint(sprintNum)}
                                                className={`text-xs font-semibold ${colors.text} flex-1 min-w-0 truncate text-left`}
                                              >
                                                {summaryRow?.name || (sprintNum != null && !isNaN(Number(sprintNum)) ? `Sprint ${sprintNum}` : 'Tasks')}
                                              </button>
                                            )}
                                            {/* Edit pencil — visible on hover in edit mode */}
                                            {editMode && editingSprintNum !== sprintNum && (
                                              <button
                                                onClick={() => startSprintEdit(sprintNum, summaryRow?.name || (sprintNum != null && !isNaN(Number(sprintNum)) ? `Sprint ${sprintNum}` : 'Tasks'))}
                                                className={`flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 ${colors.text} transition-opacity`}
                                                title="Edit sprint title"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                              </button>
                                            )}
                                            {summaryRow?.sprint_week && editingSprintNum !== sprintNum && (
                                              <span className={`text-[10px] ${colors.text} opacity-60 flex-shrink-0`}>{summaryRow.sprint_week}</span>
                                            )}
                                            {taskOnlyRows.length > 0 && (
                                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <div className="w-14 h-1.5 bg-white/40 rounded-full overflow-hidden">
                                                  <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${progressPct}%` }} />
                                                </div>
                                                <span className={`text-[10px] font-bold ${colors.text} opacity-70`}>{doneCount}/{taskOnlyRows.length}</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Child rows */}
                                          {!isCollapsed && (
                                            <div className="bg-white divide-y divide-gray-50">
                                              {childRows.map((task, taskIdx) => {
                                                const isLast  = taskIdx === childRows.length - 1;
                                                const typeCfg = TYPE_CONFIG[task.type || 'Task'] || TYPE_CONFIG['Task'];
                                                const effectiveType = task.type || 'Task';
                                                const isStatusRow = effectiveType === 'Task' || effectiveType === 'Deliverable' || effectiveType === 'Client Requirement';
                                                const isMilestone = effectiveType === 'Milestone';
                                                const isNoAction  = effectiveType === 'Assumption' || effectiveType === 'Risk';

                                                return (
                                                  <div
                                                    key={task.id}
                                                    className={`flex items-center gap-2 pl-4 pr-4 py-2 hover:opacity-95 transition-colors group ${typeCfg.bg} border-l-2 ${typeCfg.border}`}
                                                  >
                                                    {/* Tree connector */}
                                                    <div className="flex flex-col items-center w-4 flex-shrink-0 self-stretch">
                                                      <div className="w-px flex-1 bg-gray-200" />
                                                      <div className={`w-px ${isLast ? 'flex-none h-1/2' : 'flex-1'} bg-gray-200`} />
                                                    </div>
                                                    <div className="w-3 h-px bg-gray-200 flex-shrink-0" />

                                                    {/* WBS code */}
                                                    <span className={`text-[10px] font-mono font-semibold text-gray-400 w-16 flex-shrink-0`}>{task.wbs}</span>

                                                    {/* Type badge */}
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 w-24 text-center truncate ${typeCfg.labelBg} ${typeCfg.labelText}`}>
                                                      {typeCfg.icon && <span className="mr-0.5">{typeCfg.icon}</span>}
                                                      {task.type || 'Task'}
                                                    </span>

                                                    {/* Task name */}
                                                    {editMode && isStatusRow ? (
                                                      <input
                                                        className="flex-1 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-0"
                                                        value={task.name}
                                                        onChange={e => setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, name: e.target.value } : t))}
                                                      />
                                                    ) : (
                                                      <p
                                                        className={`flex-1 text-xs min-w-0 truncate ${isMilestone ? 'font-semibold' : 'font-normal'} ${typeCfg.text} ${task.status === 'not_required' ? 'line-through opacity-40' : ''}`}
                                                        title={task.notes ? `${task.name}\n\nNotes: ${task.notes}` : task.name}
                                                      >
                                                        {task.name}
                                                        {task.notes && <span className="ml-1 text-[9px] text-gray-300 font-normal" title={task.notes}>[note]</span>}
                                                      </p>
                                                    )}

                                                    {/* Owner badge — skip for Milestone/Assumption/Risk */}
                                                    {!isNoAction && !isMilestone && task.owner_role ? (
                                                      editMode && isStatusRow ? (
                                                        <select
                                                          className="text-[10px] font-semibold px-1 py-0.5 rounded border border-gray-200 bg-white focus:outline-none flex-shrink-0 w-16"
                                                          value={task.owner_role}
                                                          onChange={e => setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, owner_role: e.target.value } : t))}
                                                        >
                                                          {OWNER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                      ) : (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 w-16 text-center truncate ${colors.bg} ${colors.text}`}>{task.owner_role}</span>
                                                      )
                                                    ) : <span className="w-16 flex-shrink-0" />}

                                                    {/* Duration — skip for Milestone/Assumption/Risk */}
                                                    {!isNoAction && !isMilestone ? (
                                                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0 w-10 text-center">{task.duration_days}d</span>
                                                    ) : <span className="w-10 flex-shrink-0" />}

                                                    {/* Status — only for Task/Deliverable/Client Requirement */}
                                                    {isStatusRow ? (
                                                      canEdit ? (
                                                        <select
                                                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 flex-shrink-0 w-28 cursor-pointer"
                                                          value={task.status}
                                                          onChange={e => setTaskStatus(task, e.target.value)}
                                                        >
                                                          {TASK_STATUS_CYCLE.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                                                        </select>
                                                      ) : (
                                                        <span className="w-28 flex-shrink-0"><StatusChip status={task.status} /></span>
                                                      )
                                                    ) : <span className="w-28 flex-shrink-0" />}

                                                    {/* Dependencies */}
                                                    {editMode ? (
                                                      <input
                                                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28 flex-shrink-0 bg-white"
                                                        placeholder="—"
                                                        value={task.depends_on || ''}
                                                        onChange={e => setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, depends_on: e.target.value } : t))}
                                                        title="Dependencies — comma-separated WBS codes (e.g. 1.1.1, 1.1.2)"
                                                      />
                                                    ) : (
                                                      <div className="w-28 flex-shrink-0 flex flex-wrap gap-0.5 items-center">
                                                        {task.depends_on
                                                          ? task.depends_on.split(',').map(d => d.trim()).filter(Boolean).map(dep => (
                                                              <span key={dep} className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap" title={`Depends on: ${dep}`}>
                                                                {dep}
                                                              </span>
                                                            ))
                                                          : <span className="text-[10px] text-gray-300 font-mono">—</span>
                                                        }
                                                      </div>
                                                    )}

                                                    {/* Date range */}
                                                    {!isNoAction && (
                                                      <span className="text-[10px] text-gray-400 flex-shrink-0 w-36 text-right tabular-nums">
                                                        {task.planned_start
                                                          ? `${fmtDate(task.planned_start)} – ${fmtDate(task.planned_end)}`
                                                          : `Day ${task.day_start}–${task.day_end}${task.tentative ? ' *' : ''}`}
                                                      </span>
                                                    )}

                                                    {/* Delete (edit mode only) */}
                                                    {editMode && (
                                                      <button onClick={() => deleteTask(task.id)} className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                      </button>
                                                    )}
                                                  </div>
                                                );
                                              })}

                                              {/* Add task row (edit mode) */}
                                              {editMode && (
                                                addTaskSprint === sprintNum ? (
                                                  <div className="pl-12 pr-4 py-3 bg-indigo-50 border-t border-indigo-100">
                                                    <div className="flex items-center gap-2">
                                                      <input
                                                        className="flex-1 text-sm border border-indigo-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                                        placeholder="New task name…"
                                                        value={taskForm.name}
                                                        onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))}
                                                        onKeyDown={e => e.key === 'Enter' && addTaskToSprint(sprintNum)}
                                                        autoFocus
                                                      />
                                                      <select className="text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                                        value={taskForm.ownerRole} onChange={e => setTaskForm(f => ({ ...f, ownerRole: e.target.value }))}>
                                                        {OWNER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                      </select>
                                                      <input type="number" min={1} max={30} className="w-14 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                                        value={taskForm.duration} onChange={e => setTaskForm(f => ({ ...f, duration: Number(e.target.value) }))} />
                                                      <span className="text-xs text-indigo-400 flex-shrink-0">d</span>
                                                      <button onClick={() => addTaskToSprint(sprintNum)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">Add</button>
                                                      <button onClick={() => setAddTaskSprint(null)} className="px-2 py-1.5 text-gray-400 text-xs hover:text-gray-600">✕</button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <button onClick={() => { setAddTaskSprint(sprintNum); setTaskForm({ name: '', ownerRole: 'CSM', duration: 2 }); }}
                                                    className="w-full pl-12 pr-4 py-2 flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors border-t border-gray-50">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    Add task to Sprint {sprintNum}
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Add new sprint (edit mode) */}
                            {editMode && (
                              showAddSprint ? (
                                <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-5">
                                  <h4 className="text-xs font-bold text-indigo-600 mb-3">New Sprint</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                    <div>
                                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Sprint Label *</label>
                                      <input className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        placeholder="e.g. Sprint 6 — Rollout" value={sprintForm.label}
                                        onChange={e => setSprintForm(f => ({ ...f, label: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Week Range</label>
                                      <input className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        placeholder="e.g. Weeks 11-12" value={sprintForm.week}
                                        onChange={e => setSprintForm(f => ({ ...f, week: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-gray-500 font-semibold uppercase">Deliverable</label>
                                      <input className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        placeholder="Sprint deliverable" value={sprintForm.deliverable}
                                        onChange={e => setSprintForm(f => ({ ...f, deliverable: e.target.value }))} />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={addNewSprint} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">Add Sprint</button>
                                    <button onClick={() => setShowAddSprint(false)} className="px-3 py-1.5 text-gray-500 text-xs hover:text-gray-700">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setShowAddSprint(true)}
                                  className="w-full py-4 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                  Add New Sprint
                                </button>
                              )
                            )}
                          </div>
                        );
                      })()}
                      </div>{/* /min-w */}
                      </div>{/* /overflow-x-auto */}
                    </>
                  )}
                </div>
              )}

              {/* ── GANTT TAB ──────────────────────────────────────────────── */}
              {activeTab === 'gantt' && (() => {
                // Pre-compute milestone positions (day numbers from start)
                const milestonePositions = milestones
                  .filter(m => m.due_date && project.project_start_date)
                  .map(m => {
                    const startMs = new Date(project.project_start_date + 'T00:00:00').getTime();
                    const endMs   = new Date(m.due_date + 'T00:00:00').getTime();
                    const calDays = Math.round((endMs - startMs) / 86400000);
                    // approx working days (×5/7)
                    const approxDay = Math.round(calDays * 5 / 7) + 1;
                    return { ...m, approxDay };
                  });

                // Risks with open/high status get a flag on the timeline
                const openRisks = risks.filter(r => r.status === 'open' && (r.severity === 'high' || r.severity === 'critical'));

                // Status → bar color override
                const statusBarColor: Record<string, string> = {
                  completed:    'bg-emerald-500',
                  in_progress:  'bg-blue-500',
                  blocked:      'bg-red-500',
                  not_started:  '',  // use sprint color
                  not_required: 'bg-slate-300',
                };

                return (
                  <div className="max-w-full">
                    {tasks.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <p className="text-lg font-semibold mb-1">No Gantt Data</p>
                        <p className="text-sm">No project plan has been generated yet.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h2 className="text-sm font-bold text-gray-800">Gantt Chart</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{totalDays} working days · {project.project_start_date ? `Starts ${fmtDate(project.project_start_date)}` : 'No start date set'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Legend */}
                            <div className="flex items-center gap-3 text-[10px] font-semibold mr-2">
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />Done</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />In Progress</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" />Blocked</span>
                              <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block" style={{background:'none',borderLeft:'8px solid transparent',borderRight:'8px solid transparent',borderBottom:'14px solid #f59e0b',display:'inline-block',verticalAlign:'middle'}} />Milestone</span>
                              {openRisks.length > 0 && <span className="flex items-center gap-1 text-red-500"><span>⚑</span>Risk</span>}
                            </div>
                            <button onClick={downloadGanttCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              CSV
                            </button>
                            <button onClick={printGantt} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                              Print / PDF
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto -mx-1">
                        <div id="gantt-printable" className="bg-white rounded-2xl border border-gray-200 overflow-hidden min-w-[640px]">
                          {/* Sprint band header */}
                          <div className="flex border-b border-gray-200">
                            <div className="w-56 flex-shrink-0 border-r border-gray-200 px-4 py-2 bg-gray-50 flex items-center">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Task</span>
                            </div>
                            <div className="flex-1 relative h-8 bg-gray-50 overflow-hidden">
                              {Array.from(tasksBySprint.entries()).sort(([a],[b])=>a-b).map(([sprintNum, sprintTasks]) => {
                                const minDay = Math.min(...sprintTasks.map(t => t.day_start));
                                const maxDay = Math.max(...sprintTasks.map(t => t.day_end));
                                const leftPct = ((minDay - 1) / totalDays) * 100;
                                const widPct  = ((maxDay - minDay + 1) / totalDays) * 100;
                                const colors  = SPRINT_COLORS[sprintNum % 6] || SPRINT_COLORS[0];
                                const first   = sprintTasks[0];
                                return (
                                  <div key={sprintNum}
                                    className={`absolute top-1 bottom-1 rounded ${colors.bg} ${colors.text} flex items-center justify-center text-[9px] font-bold border ${colors.border}`}
                                    style={{ left: `${leftPct}%`, width: `max(${widPct}%, 10px)` }}>
                                    <span className="truncate px-1">{first?.sprint_week || `S${sprintNum}`}</span>
                                  </div>
                                );
                              })}
                              {/* Milestone diamonds on header */}
                              {milestonePositions.map(m => {
                                const pct = ((m.approxDay - 1) / totalDays) * 100;
                                const isDone = m.status === 'completed';
                                return (
                                  <div key={m.id} title={`Milestone: ${m.name} (${fmtDate(m.due_date)})`}
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                                    style={{ left: `${pct}%` }}>
                                    <div className={`w-3 h-3 rotate-45 ${isDone ? 'bg-emerald-500' : 'bg-amber-400'} border-2 ${isDone ? 'border-emerald-700' : 'border-amber-600'} shadow`} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Task rows */}
                          {Array.from(tasksBySprint.entries()).sort(([a],[b])=>a-b).map(([sprintNum, sprintTasks]) => {
                            const colors = SPRINT_COLORS[sprintNum % 6] || SPRINT_COLORS[0];
                            return (
                              <React.Fragment key={sprintNum}>
                                {/* Sprint label row */}
                                <div className={`flex border-b border-t-2 ${colors.border}`}>
                                  <div className={`w-56 flex-shrink-0 border-r border-gray-100 px-4 py-1.5 flex items-center gap-2 ${colors.bg}`}>
                                    <span className={`text-[10px] font-bold ${colors.text}`}>{sprintTasks[0]?.sprint_label || (sprintNum != null && !isNaN(Number(sprintNum)) ? `Sprint ${sprintNum}` : 'Tasks')}</span>
                                  </div>
                                  <div className={`flex-1 h-6 ${colors.bg} opacity-40`} />
                                </div>
                                {sprintTasks.filter(t => !['Phase','Summary'].includes(t.type || '')).map((task) => {
                                  const effectiveStatus = task.status || 'not_started';
                                  const barColor = statusBarColor[effectiveStatus] || colors.bar || 'bg-indigo-400';
                                  return (
                                    <div key={task.id} className="flex border-b border-gray-100 hover:bg-gray-50/50">
                                      <div className="w-56 flex-shrink-0 border-r border-gray-100 px-4 py-1.5 flex items-center gap-1.5">
                                        <span className={`text-[9px] font-mono ${colors.text} opacity-70 flex-shrink-0 w-8`}>{task.wbs}</span>
                                        <p className="text-xs text-gray-700 truncate leading-tight flex-1" title={task.name}>{task.name}</p>
                                        <StatusChip status={task.status || 'not_started'} />
                                      </div>
                                      <div className="flex-1 relative h-8 bg-white">
                                        {/* Grid lines every 5 days */}
                                        {Array.from({ length: Math.floor(totalDays / 5) }, (_, i) => (
                                          <div key={i} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: `${((i + 1) * 5 / totalDays) * 100}%` }} />
                                        ))}
                                        {/* Task bar */}
                                        <div
                                          className={`absolute top-1.5 bottom-1.5 rounded ${barColor || 'bg-indigo-400'} flex items-center overflow-hidden ${effectiveStatus === 'not_required' ? 'opacity-30' : 'opacity-90'}`}
                                          style={{ left: `${((task.day_start - 1) / totalDays) * 100}%`, width: `${(task.duration_days / totalDays) * 100}%`, minWidth: '3px' }}
                                        >
                                          <span className="text-[9px] text-white font-medium px-1.5 truncate">{task.name}</span>
                                        </div>
                                        {/* Milestone diamonds on task rows */}
                                        {milestonePositions.map(m => {
                                          const pct = ((m.approxDay - 1) / totalDays) * 100;
                                          return (
                                            <div key={m.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 pointer-events-none"
                                              style={{ left: `${pct}%` }}>
                                              <div className="w-0.5 h-8 bg-amber-400/40 absolute -top-4 left-0" />
                                            </div>
                                          );
                                        })}
                                        {/* Risk flag if this task is blocked/has open risks */}
                                        {task.status === 'blocked' && (
                                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[9px] text-red-500 font-bold" title="Blocked">⚑</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}

                          {/* Milestone row */}
                          {milestonePositions.length > 0 && (
                            <div className="flex border-t-2 border-amber-200">
                              <div className="w-56 flex-shrink-0 border-r border-gray-200 px-4 py-1.5 bg-amber-50 flex items-center">
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Milestones</span>
                              </div>
                              <div className="flex-1 relative h-8 bg-amber-50/40">
                                {milestonePositions.map(m => {
                                  const pct = ((m.approxDay - 1) / totalDays) * 100;
                                  const isDone = m.status === 'completed';
                                  return (
                                    <div key={m.id} title={`${m.name} — ${fmtDate(m.due_date)}`}
                                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center cursor-default"
                                      style={{ left: `${pct}%` }}>
                                      <div className={`w-4 h-4 rotate-45 ${isDone ? 'bg-emerald-500' : 'bg-amber-400'} border-2 ${isDone ? 'border-emerald-700' : 'border-amber-600'} shadow-sm`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Risk indicator row */}
                          {openRisks.length > 0 && (
                            <div className="flex border-t border-red-100">
                              <div className="w-56 flex-shrink-0 border-r border-gray-200 px-4 py-1.5 bg-red-50 flex items-center">
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Open Risks ({openRisks.length})</span>
                              </div>
                              <div className="flex-1 bg-red-50/40 px-3 py-1.5 flex items-center gap-2 flex-wrap">
                                {openRisks.map(r => (
                                  <span key={r.id} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_CONFIG[r.severity]?.bg} ${SEVERITY_CONFIG[r.severity]?.text}`}>⚑ {r.title}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Day labels footer */}
                          <div className="flex border-t border-gray-200">
                            <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50" />
                            <div className="flex-1 relative h-6 bg-gray-50">
                              {[1,5,10,15,20,25,30,35,40,45,50].filter(d => d <= totalDays).map(d => (
                                <span key={d} className="absolute text-[9px] text-gray-400 -translate-x-1/2" style={{ left: `${((d-1)/totalDays)*100}%`, top: '4px' }}>D{d}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        </div>{/* end overflow-x-auto */}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── DISCUSSION TAB ─────────────────────────────────────────── */}
              {activeTab === 'discussion' && (
                <div className="max-w-4xl">
                  <DiscussionForum projectId={project.id} projectName={project.name} />
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
          <aside className="hidden lg:block w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-auto">
            <div className="p-5 space-y-6">

              {/* Team */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Team</h3>
                <div className="space-y-2">
                  <TeamMember role="Sales Owner"     name={project.owner_name} />
                  <TeamMember role="CSM"             name={project.csm_name} />
                  <TeamMember role="PM"              name={project.pm_name} />
                  <TeamMember role="Product Manager" name={project.product_manager_name} />
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Milestones</h3>
                  {canEdit && !showMilestoneForm && (
                    <button onClick={() => setShowMilestoneForm(true)} className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">+ Add</button>
                  )}
                </div>
                {showMilestoneForm && (
                  <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      placeholder="Milestone name…" value={newMilestone.name}
                      onChange={e => setNewMilestone(f => ({ ...f, name: e.target.value }))} />
                    <input type="date" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      value={newMilestone.due_date} onChange={e => setNewMilestone(f => ({ ...f, due_date: e.target.value }))} />
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      placeholder="Sprint name (e.g. Sprint 3 — UAT)" value={newMilestone.sprint}
                      onChange={e => setNewMilestone(f => ({ ...f, sprint: e.target.value }))} />
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                      placeholder="Dependency / blocker (optional)" value={newMilestone.dependency}
                      onChange={e => setNewMilestone(f => ({ ...f, dependency: e.target.value }))} />
                    <div className="flex gap-2">
                      <button onClick={addMilestone} disabled={savingMilestone || !newMilestone.name.trim()} className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {savingMilestone ? 'Saving…' : 'Add Milestone'}
                      </button>
                      <button onClick={() => setShowMilestoneForm(false)} className="px-2 py-1.5 text-gray-500 text-[10px] hover:text-gray-700">✕</button>
                    </div>
                  </div>
                )}
                {milestones.length === 0 ? (
                  <div className="text-center py-4 text-gray-400">
                    <p className="text-xs">No milestones set</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {milestones.map(m => {
                      const isOverdue = m.due_date && new Date(m.due_date) < new Date() && m.status !== 'completed';
                      const isDone    = m.status === 'completed';
                      let meta: { sprint?: string; dependency?: string } = {};
                      try { if (m.description) meta = JSON.parse(m.description); } catch { /* not JSON */ }
                      return (
                        <div key={m.id} className={`p-3 rounded-xl border ${isDone ? 'bg-emerald-50 border-emerald-100' : isOverdue ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                          <p className={`text-xs font-semibold truncate ${isDone ? 'text-emerald-700' : isOverdue ? 'text-red-700' : 'text-gray-700'}`}>{m.name}</p>
                          {meta.sprint && (
                            <p className="text-[10px] text-indigo-500 mt-0.5 truncate">Sprint: {meta.sprint}</p>
                          )}
                          {meta.dependency && (
                            <p className="text-[10px] text-amber-500 mt-0.5 truncate" title={meta.dependency}>Blocker: {meta.dependency}</p>
                          )}
                          <div className="flex items-center justify-between mt-1 gap-1">
                            <span className={`text-[10px] ${isDone ? 'text-emerald-500' : isOverdue ? 'text-red-500' : 'text-gray-400'}`}>{m.due_date ? fmtDate(m.due_date) : 'No date'}{isOverdue && ' · Overdue'}</span>
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <button onClick={() => toggleMilestoneStatus(m)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize cursor-pointer hover:opacity-80 transition-opacity ${isDone ? 'bg-emerald-100 text-emerald-700' : m.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                  {m.status.replace('_',' ')}
                                </button>
                              )}
                              {canEdit && (
                                <button onClick={() => deleteMilestone(m.id)} className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Risks & Challenges */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Risks & Challenges</h3>
                  {canEdit && !showRiskForm && (
                    <button onClick={() => setShowRiskForm(true)} className="text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors">+ Add Risk</button>
                  )}
                </div>

                {showRiskForm && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl space-y-2">
                    <input className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                      placeholder="Risk / challenge title…" value={riskForm.title}
                      onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))} />
                    <textarea className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white resize-none h-16"
                      placeholder="Description (optional)…" value={riskForm.description}
                      onChange={e => setRiskForm(f => ({ ...f, description: e.target.value }))} />
                    <div className="flex gap-2">
                      <select className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        value={riskForm.severity} onChange={e => setRiskForm(f => ({ ...f, severity: e.target.value }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <select className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        value={riskForm.status} onChange={e => setRiskForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="open">Open</option>
                        <option value="mitigated">Mitigated</option>
                        <option value="accepted">Accepted</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addRisk} disabled={savingRisk || !riskForm.title.trim()} className="flex-1 px-3 py-1.5 bg-red-600 text-white text-[10px] font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                        {savingRisk ? 'Saving…' : 'Add Risk'}
                      </button>
                      <button onClick={() => setShowRiskForm(false)} className="px-2 py-1.5 text-gray-500 text-[10px] hover:text-gray-700">✕</button>
                    </div>
                  </div>
                )}

                {risks.length === 0 ? (
                  <div className="text-center py-4 text-gray-400">
                    <p className="text-xs">{canEdit ? 'No risks logged yet' : 'No risks or challenges identified'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {risks.map(r => {
                      const sev = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.medium;
                      return (
                        <div key={r.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-xs font-semibold text-gray-800 leading-snug flex-1">{r.title}</p>
                            {canEdit && (
                              <button onClick={() => deleteRisk(r.id)} className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors mt-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                          {r.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>{sev.label}</span>
                            {canEdit ? (
                              <select
                                className="text-[9px] font-semibold bg-white border border-gray-200 rounded-full px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                value={r.status}
                                onChange={e => updateRiskStatus(r, e.target.value)}
                              >
                                {Object.entries(RISK_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            ) : (
                              <span className="text-[9px] font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">{RISK_STATUS_LABELS[r.status]}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Project Start Date */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Project Start Date</h3>
                  {canEditStartDate && !showStartDateEdit && (
                    <button
                      onClick={() => { setShowStartDateEdit(true); setStartDateForm({ date: (project.project_start_date || '').split('T')[0], reason: '', total_days: '' }); setStartDateError(''); }}
                      className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      {project.project_start_date ? 'Change' : '+ Set Date'}
                    </button>
                  )}
                </div>

                {showStartDateEdit ? (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                    <input type="date"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={startDateForm.date}
                      onChange={e => setStartDateForm(f => ({ ...f, date: e.target.value }))} />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-semibold text-gray-600 flex-shrink-0 w-28">Working Days</label>
                      <input
                        type="number"
                        min={10}
                        max={365}
                        step={1}
                        placeholder={String(tasks[0]?.total_working_days || totalDays || 30)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={startDateForm.total_days}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v)) setStartDateForm(f => ({ ...f, total_days: v }));
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400">Currently {tasks[0]?.total_working_days || totalDays || 30} days. Change to rescale all WBS task durations proportionally.</p>
                    {project.project_start_date && (
                      <>
                        <textarea
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none h-14"
                          placeholder="Reason for changing start date (required)…"
                          value={startDateForm.reason}
                          onChange={e => setStartDateForm(f => ({ ...f, reason: e.target.value }))} />
                        <p className="text-[9px] text-amber-600 font-medium">⚠ Changing start date will recalculate all WBS & Gantt dates</p>
                      </>
                    )}
                    {startDateError && <p className="text-[10px] text-red-500 font-medium">{startDateError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveStartDate(!project.project_start_date)}
                        disabled={savingStartDate || !startDateForm.date}
                        className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {savingStartDate ? 'Saving…' : project.project_start_date ? 'Update & Recalculate' : 'Set Start Date'}
                      </button>
                      <button onClick={() => { setShowStartDateEdit(false); setStartDateError(''); }} className="px-2 py-1.5 text-gray-500 text-[10px] hover:text-gray-700">✕</button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl ${project.project_start_date ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                    {project.project_start_date ? (
                      <p className="text-sm font-bold text-emerald-700">{fmtDate(project.project_start_date)}</p>
                    ) : (
                      <p className="text-xs text-amber-600 font-medium">Not set — WBS dates are tentative</p>
                    )}
                  </div>
                )}

                {/* Start date change history */}
                {startDateLogs.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Change History</p>
                    {startDateLogs.slice(0, 4).map(log => (
                      <div key={log.id} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-semibold text-gray-700">
                            {log.details?.old_date ? `${fmtDate(log.details.old_date)} → ` : ''}{fmtDate(log.details?.new_date)}
                          </span>
                          <span className="text-[9px] text-gray-400 flex-shrink-0">{log.details?.changed_by}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 italic line-clamp-2">"{log.details?.reason}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100" />

              {/* Project Info */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Project Info</h3>
                <dl className="space-y-2.5">
                  <MetaRow label="Created"   value={fmtDate(project.created_at)} />
                  <MetaRow label="Status"    value={statusCfg.label} />
                  {project.stage_name        && <MetaRow label="Stage"    value={project.stage_name} />}
                  {project.expected_timeline && <MetaRow label="Timeline" value={project.expected_timeline} />}
                </dl>
              </div>

            </div>
          </aside>
        </div>
      </div>

      {/* ── START DATE REQUIRED MODAL ─────────────────────────────────────── */}
      {showStartDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Set Project Start Date</h2>
                  <p className="text-white/70 text-xs mt-0.5">Required before WBS & Gantt dates can be calculated</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">
                  <strong>{project.name}</strong> has been approved but no start date has been set. Set it now to convert all tentative WBS dates to actual planned dates.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Project Start Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={startDateForm.date}
                  onChange={e => setStartDateForm(f => ({ ...f, date: e.target.value }))}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Total Working Days</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={365}
                    step={1}
                    placeholder={String(tasks[0]?.total_working_days || 30)}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={startDateForm.total_days}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) setStartDateForm(f => ({ ...f, total_days: v }));
                    }}
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">days</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Default: {tasks[0]?.total_working_days || 30} days ({tasks[0]?.total_working_days === 45 ? 'includes integration phase' : 'standard plan'}).
                  Enter a custom value to rescale the WBS proportionally.
                </p>
              </div>

              {startDateError && (
                <p className="text-xs text-red-500 font-medium">{startDateError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => saveStartDate(true)}
                disabled={savingStartDate || !startDateForm.date}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {savingStartDate && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {savingStartDate ? 'Setting up…' : 'Confirm Start Date'}
              </button>
              <button
                onClick={() => setShowStartDateModal(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
