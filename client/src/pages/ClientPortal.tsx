import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from '../components/NotificationBell';
import DiscussionForum from '../components/DiscussionForum';

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface WBSTask {
  id: number; wbs: string; name: string; type?: string;
  sprint: number; sprint_label?: string; status: string;
  owner_role?: string; planned_start?: string; planned_end?: string;
  day_start: number; day_end: number; duration_days: number;
  depends_on?: string; notes?: string;
}

interface Milestone {
  id: number; project_id: number; name: string;
  status: string; due_date: string; description?: string;
}

interface Project {
  id: number; name: string; client_name: string; status: string;
  priority?: string; project_type?: string;
  csm_name?: string; pm_name?: string; owner_name?: string;
  expected_timeline?: string; go_live_deadline?: string;
  project_start_date?: string; project_plan?: string;
  stage_name?: string; integrations_required?: boolean;
  business_objective?: string; success_criteria?: string;
  sow_file_path?: string; sow_file_name?: string;
  client_spoc_name?: string; client_spoc_email?: string;
  created_at: string;
}

interface ClientRequest {
  id: number;
  project_id: number;
  client_name: string;
  client_email: string;
  request_type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  response_comments?: string;
  approved_at?: string;
  due_date?: string;
  closed_at?: string;
  created_at: string;
}

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  change_request:    { label: 'Change Request',     color: 'text-violet-700', bg: 'bg-violet-50',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  new_requirement:   { label: 'New Requirement',    color: 'text-blue-700',   bg: 'bg-blue-50',    icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  additional_help:   { label: 'Additional Help',    color: 'text-emerald-700',bg: 'bg-emerald-50', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' },
  bug_report:        { label: 'Bug / Issue',         color: 'text-red-700',    bg: 'bg-red-50',     icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  other:             { label: 'Other',               color: 'text-gray-700',   bg: 'bg-gray-50',    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
};

const REQUEST_STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:      { label: 'Pending Review',  color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-400'   },
  under_review: { label: 'Under Review',    color: 'text-blue-700',    bg: 'bg-blue-50',    dot: 'bg-blue-500'    },
  approved:     { label: 'Approved',        color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  rejected:     { label: 'Rejected',        color: 'text-red-700',     bg: 'bg-red-50',     dot: 'bg-red-500'     },
  closed:       { label: 'Closed',          color: 'text-gray-700',    bg: 'bg-gray-100',   dot: 'bg-gray-400'    },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function getDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; gradient: string; text: string; dot: string; glow: string }> = {
  INTAKE_CREATED:    { label: 'Getting Started', gradient: 'from-slate-400 to-slate-500',   text: 'text-slate-700',  dot: 'bg-slate-400',   glow: 'shadow-slate-200'  },
  AWAITING_APPROVAL: { label: 'Under Review',    gradient: 'from-violet-500 to-purple-600', text: 'text-violet-700', dot: 'bg-violet-500',  glow: 'shadow-violet-200' },
  APPROVED:          { label: 'Approved',         gradient: 'from-emerald-500 to-teal-500',  text: 'text-emerald-700',dot: 'bg-emerald-500', glow: 'shadow-emerald-200'},
  ACTIVE:            { label: 'In Progress',      gradient: 'from-blue-500 to-indigo-600',   text: 'text-blue-700',   dot: 'bg-blue-500',    glow: 'shadow-blue-200'   },
};

const TASK_STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-gray-100',     text: 'text-gray-500',    dot: 'bg-gray-300'    },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50',      text: 'text-blue-600',    dot: 'bg-blue-500'    },
  completed:   { label: 'Completed',   bg: 'bg-emerald-50',   text: 'text-emerald-600', dot: 'bg-emerald-500' },
  blocked:     { label: 'Blocked',     bg: 'bg-red-50',       text: 'text-red-600',     dot: 'bg-red-500'     },
};

// ─── Animated counter ──────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) { setDisplay(0); return; }
    const duration = 800;
    const step = Math.ceil(duration / end);
    const timer = setInterval(() => {
      start += 1;
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
};

// ─── Project Card ──────────────────────────────────────────────────────────────
const ProjectCard: React.FC<{ project: Project; onClick: () => void; index: number }> = ({ project, onClick, index }) => {
  const [hovered, setHovered] = useState(false);
  const [hoveredEl, setHoveredEl] = useState<string | null>(null);
  const tasks: WBSTask[] = React.useMemo(() => {
    if (!project.project_plan) return [];
    try { const p = JSON.parse(project.project_plan); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [project.project_plan]);

  const allTasks = tasks.filter(t => t.type === 'Task' || t.type === 'Deliverable');
  const clientTasks = tasks.filter(t => t.owner_role === 'Client' || t.type === 'Client Requirement');
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const progress = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
  const clientPending = clientTasks.filter(t => t.status !== 'completed').length;
  const statusCfg = STATUS_CONFIG[project.status] || { label: project.status, gradient: 'from-gray-400 to-gray-500', text: 'text-gray-700', dot: 'bg-gray-400', glow: 'shadow-gray-200' };
  const daysToGoLive = getDaysUntil(project.go_live_deadline);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredEl(null); }}
      className="w-full text-left rounded-2xl transition-all duration-300 client-card-enter group"
      style={{
        animationDelay: `${index * 100}ms`,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 60px -10px rgba(99,102,241,0.25), 0 8px 20px -5px rgba(0,0,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Gradient top bar */}
      <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${statusCfg.gradient}`} />

      <div className="bg-white border border-gray-100 border-t-0 rounded-b-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-bold text-gray-900 truncate transition-colors ${hovered ? 'text-indigo-600' : ''}`}>
              {project.name}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {project.client_name}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 bg-gradient-to-r ${statusCfg.gradient} text-white shadow-sm`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />{statusCfg.label}
          </span>
        </div>

        {/* Progress bar with tooltip */}
        <div
          className="mb-5 relative"
          onMouseEnter={e => { e.stopPropagation(); setHoveredEl('progress'); }}
          onMouseLeave={e => { e.stopPropagation(); setHoveredEl(null); }}
        >
          {hoveredEl === 'progress' && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
              <div className="bg-gray-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl w-max max-w-[240px] whitespace-normal leading-snug">
                {completed} of {allTasks.length} tasks completed
              </div>
              <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Overall Progress</span>
            <span className="text-sm font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: progress >= 80
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : progress >= 50
                  ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                  : 'linear-gradient(90deg, #6366f1, #a5b4fc)',
              }}
            />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-3 text-xs">
          {clientPending > 0 && (
            <span
              className="relative flex items-center gap-1.5 font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-xl"
              onMouseEnter={e => { e.stopPropagation(); setHoveredEl('actions'); }}
              onMouseLeave={e => { e.stopPropagation(); setHoveredEl(null); }}
            >
              {hoveredEl === 'actions' && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                  <span className="block bg-gray-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl w-max max-w-[240px] whitespace-normal leading-snug">
                    Tasks assigned to you pending completion
                  </span>
                  <span className="block w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                </span>
              )}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {clientPending} action{clientPending > 1 ? 's' : ''} needed
            </span>
          )}
          {daysToGoLive !== null && (
            <span
              className={`relative flex items-center gap-1 ${daysToGoLive < 7 ? 'text-red-500' : daysToGoLive < 14 ? 'text-amber-500' : 'text-gray-400'}`}
              onMouseEnter={e => { e.stopPropagation(); setHoveredEl('golive'); }}
              onMouseLeave={e => { e.stopPropagation(); setHoveredEl(null); }}
            >
              {hoveredEl === 'golive' && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                  <span className="block bg-gray-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl w-max max-w-[240px] whitespace-normal leading-snug">
                    Target go-live: {fmtDate(project.go_live_deadline)}
                  </span>
                  <span className="block w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                </span>
              )}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {daysToGoLive > 0 ? `Go-live in ${daysToGoLive}d` : 'Go-live overdue'}
            </span>
          )}
          <span className={`ml-auto flex items-center gap-1 font-semibold transition-colors ${hovered ? 'text-indigo-500' : 'text-gray-300'}`}>
            View details
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${hovered ? 'translate-x-1' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
};

// ─── Project Detail View ───────────────────────────────────────────────────────
const NOTIF_TAB_MAP: Record<string, 'overview' | 'tasks' | 'milestones' | 'discussion' | 'requests' | 'analytics'> = {
  discussion_message:    'discussion',
  task_overdue:          'tasks',
  task_nudge_manager:    'tasks',
  client_request_raised: 'requests',
  project_approved:      'overview',
  project_rejected:      'overview',
};

const ProjectDetail: React.FC<{ project: Project; milestones: Milestone[]; onBack: () => void; initialTab?: string }> = ({ project, milestones, onBack, initialTab }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'milestones' | 'discussion' | 'requests' | 'analytics'>(
    (initialTab as any) || 'overview'
  );

  // ── Client requests state ────────────────────────────────────────────────
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [reqForm, setReqForm] = useState({
    request_type: 'new_requirement',
    title: '',
    description: '',
    priority: 'Medium',
    // Bug-specific
    steps_to_replicate: '',
    evidence_url: '',
    // New requirement-specific
    use_case: '',
    brd_notes: '',
    // Change request-specific
    change_reason: '',
    impact_areas: '',
  });
  const formTitleRef = useRef<HTMLInputElement>(null);

  const fetchRequests = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const r = await fetch(`http://localhost:3001/api/projects/${project.id}/client-requests`);
      if (r.ok) setRequests(await r.json());
    } finally { setLoadingReqs(false); }
  }, [project.id]);

  useEffect(() => {
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab, fetchRequests]);

  // Focus title when raise form opens
  useEffect(() => {
    if (showRaiseForm) setTimeout(() => formTitleRef.current?.focus(), 80);
  }, [showRaiseForm]);

  const handleRaiseRequest = async () => {
    if (!reqForm.title.trim() || !reqForm.description.trim()) return;
    setSubmitting(true);
    try {
      // Build enriched description based on type
      let fullDescription = reqForm.description.trim();
      if (reqForm.request_type === 'bug_report') {
        if (reqForm.steps_to_replicate.trim()) fullDescription += `\n\n**Steps to Replicate:**\n${reqForm.steps_to_replicate.trim()}`;
        if (reqForm.evidence_url.trim()) fullDescription += `\n\n**Evidence / URL:**\n${reqForm.evidence_url.trim()}`;
      } else if (reqForm.request_type === 'new_requirement') {
        if (reqForm.use_case.trim()) fullDescription += `\n\n**Use Case:**\n${reqForm.use_case.trim()}`;
        if (reqForm.brd_notes.trim()) fullDescription += `\n\n**BRD / Requirements Notes:**\n${reqForm.brd_notes.trim()}`;
      } else if (reqForm.request_type === 'change_request') {
        if (reqForm.change_reason.trim()) fullDescription += `\n\n**Reason for Change:**\n${reqForm.change_reason.trim()}`;
        if (reqForm.impact_areas.trim()) fullDescription += `\n\n**Impacted Areas:**\n${reqForm.impact_areas.trim()}`;
      }

      await fetch(`http://localhost:3001/api/projects/${project.id}/client-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_user_id: user?.id,
          client_name: user?.name || 'Client',
          client_email: user?.email || '',
          request_type: reqForm.request_type,
          title: reqForm.title,
          description: fullDescription,
          priority: reqForm.priority,
        }),
      });
      setSubmitSuccess(true);
      setReqForm({ request_type: 'new_requirement', title: '', description: '', priority: 'Medium', steps_to_replicate: '', evidence_url: '', use_case: '', brd_notes: '', change_reason: '', impact_areas: '' });
      await fetchRequests();
      setTimeout(() => { setShowRaiseForm(false); setSubmitSuccess(false); }, 1800);
    } finally { setSubmitting(false); }
  };

  const tasks: WBSTask[] = React.useMemo(() => {
    if (!project.project_plan) return [];
    try { const p = JSON.parse(project.project_plan); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [project.project_plan]);

  const clientTasks = tasks.filter(t => t.owner_role === 'Client' || t.type === 'Client Requirement');
  const allTasks = tasks.filter(t => t.type === 'Task' || t.type === 'Deliverable');
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const progress = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
  const upcomingMilestones = milestones
    .filter(m => m.status !== 'completed')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const statusCfg = STATUS_CONFIG[project.status] || { label: project.status, gradient: 'from-gray-400 to-gray-500', text: 'text-gray-700', dot: 'bg-gray-400', glow: '' };
  const blockedCount = clientTasks.filter(t => t.status === 'blocked').length;
  const pendingCount = clientTasks.filter(t => t.status !== 'completed').length;

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'tasks',       label: 'My Actions',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'milestones',  label: 'Milestones',  icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { id: 'discussion',  label: 'Discussion',  icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'requests',    label: 'My Requests', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', badge: requests.filter(r => r.status === 'approved').length },
    { id: 'analytics',   label: 'Analytics',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ] as const;

  return (
    <div className="client-detail-enter">

      {/* ── Raise Request Slide-over ────────────────────────────────────────── */}
      {showRaiseForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRaiseForm(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-base">Raise a Request</p>
                  <p className="text-indigo-200 text-xs mt-0.5">{project.name}</p>
                </div>
                <button onClick={() => setShowRaiseForm(false)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {submitSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-base font-bold text-gray-800">Request Submitted!</p>
                <p className="text-sm text-gray-500 text-center">Your team will review it and respond shortly.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Request type selector */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Request Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(REQUEST_TYPE_LABELS).map(([val, meta]) => (
                      <button key={val} onClick={() => setReqForm(f => ({ ...f, request_type: val }))}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                          reqForm.request_type === val
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.icon} />
                        </svg>
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input ref={formTitleRef} value={reqForm.title}
                    onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief summary…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-800 placeholder-gray-300" />
                </div>

                {/* ── Bug Report fields ── */}
                {reqForm.request_type === 'bug_report' && (
                  <div className="space-y-4 bg-red-50 border border-red-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Bug Report Details
                    </p>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        What happened? <span className="text-red-400">*</span>
                      </label>
                      <textarea value={reqForm.description}
                        onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
                        rows={3} placeholder="Describe the bug — what did you expect vs. what actually happened…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-800 placeholder-gray-300 resize-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Steps to Replicate
                      </label>
                      <textarea value={reqForm.steps_to_replicate}
                        onChange={e => setReqForm(f => ({ ...f, steps_to_replicate: e.target.value }))}
                        rows={3} placeholder={"1. Go to...\n2. Click on...\n3. See error"}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-800 placeholder-gray-300 resize-none bg-white font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Evidence (video URL, screenshot link, document URL)
                      </label>
                      <input value={reqForm.evidence_url}
                        onChange={e => setReqForm(f => ({ ...f, evidence_url: e.target.value }))}
                        placeholder="https://drive.google.com/… or Loom link…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-800 placeholder-gray-300 bg-white" />
                      <p className="text-[10px] text-gray-400 mt-1">Paste a shareable link to a screen recording, screenshot, or document</p>
                    </div>
                  </div>
                )}

                {/* ── New Requirement fields ── */}
                {reqForm.request_type === 'new_requirement' && (
                  <div className="space-y-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      New Requirement Details
                    </p>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        What do you need? <span className="text-red-400">*</span>
                      </label>
                      <textarea value={reqForm.description}
                        onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
                        rows={3} placeholder="Describe the requirement clearly — what functionality or change you need…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-800 placeholder-gray-300 resize-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Use Case</label>
                      <textarea value={reqForm.use_case}
                        onChange={e => setReqForm(f => ({ ...f, use_case: e.target.value }))}
                        rows={2} placeholder="As a [user], I want to [action] so that [outcome]…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-800 placeholder-gray-300 resize-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">BRD / Requirements Document (link)</label>
                      <input value={reqForm.brd_notes}
                        onChange={e => setReqForm(f => ({ ...f, brd_notes: e.target.value }))}
                        placeholder="https://docs.google.com/… or Confluence link…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-800 placeholder-gray-300 bg-white" />
                      <p className="text-[10px] text-gray-400 mt-1">Link to any supporting BRD, spec doc, or reference material</p>
                    </div>
                  </div>
                )}

                {/* ── Change Request fields ── */}
                {reqForm.request_type === 'change_request' && (
                  <div className="space-y-4 bg-violet-50 border border-violet-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Change Request Details
                    </p>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        What needs to change? <span className="text-red-400">*</span>
                      </label>
                      <textarea value={reqForm.description}
                        onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
                        rows={3} placeholder="Describe the change clearly — what is currently in scope and what you'd like modified…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-800 placeholder-gray-300 resize-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Reason for Change</label>
                      <textarea value={reqForm.change_reason}
                        onChange={e => setReqForm(f => ({ ...f, change_reason: e.target.value }))}
                        rows={2} placeholder="Why is this change needed? What business driver or constraint requires it?"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-800 placeholder-gray-300 resize-none bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Impacted Areas / Modules</label>
                      <input value={reqForm.impact_areas}
                        onChange={e => setReqForm(f => ({ ...f, impact_areas: e.target.value }))}
                        placeholder="e.g. Login flow, Reporting module, API integration…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-800 placeholder-gray-300 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Supporting Document (link)</label>
                      <input value={reqForm.brd_notes}
                        onChange={e => setReqForm(f => ({ ...f, brd_notes: e.target.value }))}
                        placeholder="https://drive.google.com/… spec sheet, mock-up, or approval email…"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 text-gray-800 placeholder-gray-300 bg-white" />
                    </div>
                  </div>
                )}

                {/* ── Other / Additional Help — generic description ── */}
                {(reqForm.request_type === 'additional_help' || reqForm.request_type === 'other') && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea value={reqForm.description}
                      onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
                      rows={5} placeholder="Describe your request in detail — what you need, why it matters, any deadlines…"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-800 placeholder-gray-300 resize-none" />
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Priority</label>
                  <div className="flex gap-2">
                    {['Low', 'Medium', 'High', 'Critical'].map(p => (
                      <button key={p} onClick={() => setReqForm(f => ({ ...f, priority: p }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                          reqForm.priority === p
                            ? p === 'Critical' ? 'bg-red-500 text-white border-red-500'
                              : p === 'High'     ? 'bg-orange-400 text-white border-orange-400'
                              : p === 'Medium'   ? 'bg-amber-400 text-white border-amber-400'
                              :                    'bg-emerald-400 text-white border-emerald-400'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!submitSuccess && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-white">
                <button onClick={() => setShowRaiseForm(false)} className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleRaiseRequest} disabled={submitting || !reqForm.title.trim() || !reqForm.description.trim()}
                  className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl transition-all disabled:opacity-50 shadow-sm">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Back header */}
      <div className={`relative bg-gradient-to-r ${statusCfg.gradient} rounded-2xl p-6 mb-6 overflow-hidden`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-black/5 rounded-full translate-y-1/2 pointer-events-none" />
        <div className="relative">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to projects
          </button>
          <h2 className="text-2xl font-bold text-white mb-1">{project.name}</h2>
          <p className="text-white/70 text-sm">{project.client_name}</p>

          {/* Mini stats */}
          <div className="flex flex-wrap items-center gap-4 mt-5">
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">Progress</p>
              <p className="text-white font-bold text-lg">{progress}%</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2">
              <p className="text-white/60 text-[10px] uppercase tracking-wider">Milestones</p>
              <p className="text-white font-bold text-lg">{completedMilestones}/{milestones.length}</p>
            </div>
            {project.go_live_deadline && (
              <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-2">
                <p className="text-white/60 text-[10px] uppercase tracking-wider">Go-Live</p>
                <p className="text-white font-bold text-sm">{fmtDate(project.go_live_deadline)}</p>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="bg-amber-400/30 backdrop-blur rounded-xl px-4 py-2 border border-amber-300/30">
                <p className="text-amber-100 text-[10px] uppercase tracking-wider">Actions Needed</p>
                <p className="text-white font-bold text-lg">{pendingCount}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Raise Request CTA */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex gap-1 bg-gray-100/80 rounded-2xl p-1.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 relative flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="hidden sm:inline">{tab.label}</span>
              {'badge' in tab && (tab as any).badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {(tab as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowRaiseForm(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Raise Request</span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">Implementation Progress</h3>
              <span className="text-sm font-bold text-indigo-600">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5 text-xs text-gray-400">
              <span>Started {fmtDate(project.project_start_date)}</span>
              <span>{completed} of {allTasks.length} tasks complete</span>
              <span>Target: {fmtDate(project.go_live_deadline)}</span>
            </div>
          </div>

          {blockedCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">{blockedCount} task{blockedCount > 1 ? 's are' : ' is'} blocked</p>
                <p className="text-xs text-red-600 mt-0.5">Please reach out to your CSM or PM to resolve blockers as soon as possible.</p>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Project Details</h3>
              <dl className="space-y-3">
                {[
                  { label: 'CSM', value: project.csm_name },
                  { label: 'Project Manager', value: project.pm_name },
                  { label: 'Type', value: project.project_type },
                  { label: 'Timeline', value: project.expected_timeline },
                  { label: 'Start Date', value: fmtDate(project.project_start_date) },
                  { label: 'Go-Live Target', value: fmtDate(project.go_live_deadline) },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start gap-3">
                    <dt className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{row.label}</dt>
                    <dd className="text-xs font-semibold text-gray-800 flex-1">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Documents</h3>
              {project.sow_file_path ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-800 truncate">{project.sow_file_name || 'Statement of Work'}</p>
                    <p className="text-[10px] text-indigo-500">Signed SOW document</p>
                  </div>
                  <a href={`http://localhost:3001/api/projects/${project.id}/download-sow`} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    Download
                  </a>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-300">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs text-gray-400">No SOW uploaded yet</p>
                </div>
              )}
              {project.business_objective && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Business Objective</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{project.business_objective}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-800">Actions Required From You</h3>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {pendingCount} pending
              </span>
            )}
          </div>
          {clientTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600">No actions required right now</p>
              <p className="text-xs text-gray-400 mt-1">Your team is handling everything — check back later.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {clientTasks.map((task, i) => {
                const st = TASK_STATUS_DISPLAY[task.status] || TASK_STATUS_DISPLAY.not_started;
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${st.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {task.name}
                      </p>
                      {task.notes && <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-mono text-gray-300">{task.wbs}</span>
                        {task.sprint_label && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{task.sprint_label}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 border ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-800">Project Milestones</h3>
            <span className="text-xs text-gray-400">{completedMilestones}/{milestones.length} completed</span>
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No milestones defined yet</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-4 pl-10">
                {[...upcomingMilestones, ...milestones.filter(m => m.status === 'completed')].map((m, i) => {
                  const days = getDaysUntil(m.due_date);
                  const isOverdue = days !== null && days < 0 && m.status !== 'completed';
                  const isSoon = days !== null && days >= 0 && days <= 7 && m.status !== 'completed';
                  const isDone = m.status === 'completed';
                  return (
                    <div key={m.id} className="relative flex items-start gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                      {/* Dot on timeline */}
                      <div className={`absolute -left-10 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isDone ? 'bg-emerald-500 border-emerald-500' : isOverdue ? 'bg-red-400 border-red-400' : isSoon ? 'bg-amber-400 border-amber-400' : 'bg-white border-indigo-300'
                      }`}>
                        {isDone && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className={`flex-1 p-3.5 rounded-xl border ${isDone ? 'border-emerald-100 bg-emerald-50/50' : isOverdue ? 'border-red-100 bg-red-50/50' : isSoon ? 'border-amber-100 bg-amber-50/50' : 'border-gray-100'}`}>
                        <p className={`text-sm font-semibold ${isDone ? 'text-emerald-700' : 'text-gray-800'}`}>{m.name}</p>
                        <p className={`text-xs mt-1 font-medium ${isDone ? 'text-emerald-500' : isOverdue ? 'text-red-500' : isSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                          {isDone ? `Completed · ${fmtDate(m.due_date)}` : isOverdue ? `${Math.abs(days!)}d overdue` : days === 0 ? 'Due today' : `Due in ${days}d · ${fmtDate(m.due_date)}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (() => {
        // analytics tab
        const tasksByStatus = {
          completed:    allTasks.filter(t => t.status === 'completed').length,
          in_progress:  allTasks.filter(t => t.status === 'in_progress').length,
          blocked:      allTasks.filter(t => t.status === 'blocked').length,
          not_started:  allTasks.filter(t => t.status === 'not_started' || !t.status).length,
          not_required: allTasks.filter(t => t.status === 'not_required').length,
        };
        const taskTotal = allTasks.length;

        const reqByType: Record<string, number> = {};
        const reqByStatus: Record<string, number> = {};
        requests.forEach(r => {
          reqByType[r.request_type]   = (reqByType[r.request_type]   || 0) + 1;
          reqByStatus[r.status]       = (reqByStatus[r.status]       || 0) + 1;
        });

        const daysToGoLive  = getDaysUntil(project.go_live_deadline) ?? 0;
        const hasGoLive     = !!project.go_live_deadline;
        const daysActive    = project.project_start_date
          ? Math.max(0, Math.ceil((Date.now() - new Date(project.project_start_date as string).getTime()) / 86400000))
          : null;

        const healthScore = (() => {
          if (taskTotal === 0) return progress;
          let score = progress;
          if (tasksByStatus.blocked > 0) score -= tasksByStatus.blocked * 5;
          if (hasGoLive && daysToGoLive < 0) score -= 20;
          return Math.max(0, Math.min(100, Math.round(score)));
        })();

        const healthColor = healthScore >= 75 ? { ring: '#10b981', text: 'text-emerald-600', label: 'Healthy', bg: 'bg-emerald-50' }
          : healthScore >= 40               ? { ring: '#f59e0b', text: 'text-amber-600',  label: 'Needs Attention', bg: 'bg-amber-50' }
          :                                   { ring: '#ef4444', text: 'text-red-600',    label: 'At Risk', bg: 'bg-red-50' };

        const TASK_BARS = [
          { key: 'completed',    label: 'Completed',    count: tasksByStatus.completed,    color: 'bg-emerald-500' },
          { key: 'in_progress',  label: 'In Progress',  count: tasksByStatus.in_progress,  color: 'bg-blue-500'    },
          { key: 'not_started',  label: 'Not Started',  count: tasksByStatus.not_started,  color: 'bg-gray-300'    },
          { key: 'blocked',      label: 'Blocked',      count: tasksByStatus.blocked,      color: 'bg-red-400'     },
          { key: 'not_required', label: 'Not Required', count: tasksByStatus.not_required, color: 'bg-slate-200'   },
        ].filter(b => b.count > 0);

        const REQ_TYPE_COLORS: Record<string, string> = {
          bug_report:      'bg-red-400',
          new_requirement: 'bg-blue-500',
          change_request:  'bg-violet-500',
          additional_help: 'bg-emerald-500',
          other:           'bg-gray-400',
        };
        const REQ_STATUS_COLORS: Record<string, string> = {
          pending:      'bg-amber-400',
          under_review: 'bg-blue-400',
          approved:     'bg-emerald-500',
          rejected:     'bg-red-400',
          closed:       'bg-gray-400',
        };

        // SVG donut helper
        const Donut = ({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) => {
          const r = (size - 10) / 2;
          const circ = 2 * Math.PI * r;
          const dash = (pct / 100) * circ;
          return (
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
          );
        };

        return (
          <div className="space-y-5">

            {/* ── Health + KPI strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Health score */}
              <div className={`col-span-2 sm:col-span-1 ${healthColor.bg} rounded-2xl p-4 flex items-center gap-4 border border-white/60`}>
                <div className="relative flex-shrink-0">
                  <Donut pct={healthScore} color={healthColor.ring} size={72} />
                  <span className={`absolute inset-0 flex items-center justify-center text-lg font-extrabold ${healthColor.text}`}>
                    {healthScore}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Health Score</p>
                  <p className={`text-sm font-bold mt-0.5 ${healthColor.text}`}>{healthColor.label}</p>
                  {tasksByStatus.blocked > 0 && (
                    <p className="text-[10px] text-red-500 mt-1">{tasksByStatus.blocked} task{tasksByStatus.blocked > 1 ? 's' : ''} blocked</p>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Completion</p>
                <div className="relative flex-shrink-0 flex items-center gap-3">
                  <Donut pct={progress} color="#6366f1" size={56} />
                  <div>
                    <p className="text-xl font-extrabold text-indigo-600">{progress}%</p>
                    <p className="text-[10px] text-gray-400">{tasksByStatus.completed}/{taskTotal} tasks</p>
                  </div>
                </div>
              </div>

              {/* Go-live */}
              <div className={`bg-white border rounded-2xl p-4 shadow-sm ${hasGoLive && daysToGoLive < 7 ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Go-Live</p>
                <p className={`text-lg font-extrabold ${!hasGoLive ? 'text-gray-400' : daysToGoLive < 0 ? 'text-red-600' : daysToGoLive < 7 ? 'text-amber-600' : 'text-gray-800'}`}>
                  {!hasGoLive ? '—' : daysToGoLive < 0 ? `${Math.abs(daysToGoLive)}d overdue` : `${daysToGoLive}d`}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{hasGoLive ? fmtDate(project.go_live_deadline) : 'Not set'}</p>
              </div>

              {/* Active days */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Days Active</p>
                <p className="text-lg font-extrabold text-gray-800">{daysActive !== null ? daysActive : '—'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{project.project_start_date ? `Since ${fmtDate(project.project_start_date)}` : 'Not started'}</p>
              </div>
            </div>

            {/* ── Task breakdown ──────────────────────────────────────────── */}
            {taskTotal > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Task Breakdown</h3>
                {/* Segmented bar */}
                <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
                  {TASK_BARS.map(b => (
                    <div key={b.key} className={`${b.color} transition-all`} style={{ width: `${(b.count / taskTotal) * 100}%` }} title={`${b.label}: ${b.count}`} />
                  ))}
                </div>
                <div className="space-y-2.5">
                  {TASK_BARS.map(b => (
                    <div key={b.key} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.color}`} />
                      <span className="text-xs text-gray-600 flex-1">{b.label}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${b.color} rounded-full`} style={{ width: `${(b.count / taskTotal) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-6 text-right">{b.count}</span>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round((b.count / taskTotal) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Request analytics ──────────────────────────────────────── */}
            {requests.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* By type */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Requests by Type</h3>
                  <div className="space-y-3">
                    {Object.entries(reqByType).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                      const meta = REQUEST_TYPE_LABELS[type] || REQUEST_TYPE_LABELS.other;
                      const pctW = Math.round((count / requests.length) * 100);
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${REQ_TYPE_COLORS[type] || 'bg-gray-400'}`} />
                          <span className="text-xs text-gray-600 flex-1 truncate">{meta.label}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${REQ_TYPE_COLORS[type] || 'bg-gray-400'}`} style={{ width: `${pctW}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-4 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By status */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Requests by Status</h3>
                  <div className="space-y-3">
                    {Object.entries(reqByStatus).sort((a,b) => b[1]-a[1]).map(([status, count]) => {
                      const meta = REQUEST_STATUS_META[status] || REQUEST_STATUS_META.pending;
                      const pctW = Math.round((count / requests.length) * 100);
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                          <span className="text-xs text-gray-600 flex-1 truncate">{meta.label}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${REQ_STATUS_COLORS[status] || 'bg-gray-400'}`} style={{ width: `${pctW}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-4 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <p className="text-xs font-semibold text-gray-400">No requests raised yet</p>
                <p className="text-[11px] text-gray-300 mt-1">Request analytics will appear once you raise your first request.</p>
              </div>
            )}

            {/* ── Milestones summary ─────────────────────────────────────── */}
            {milestones.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Milestones</h3>
                  <span className="text-xs font-bold text-indigo-600">{completedMilestones}/{milestones.length} done</span>
                </div>
                {/* Segmented milestone bar */}
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-3">
                  <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${(completedMilestones / milestones.length) * 100}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {milestones.slice(0, 6).map(m => {
                    const days = getDaysUntil(m.due_date);
                    const isDone = m.status === 'completed';
                    const isOver = !isDone && days !== null && days < 0;
                    return (
                      <div key={m.id} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${isDone ? 'bg-emerald-50 border-emerald-100' : isOver ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? 'bg-emerald-500' : isOver ? 'bg-red-400' : 'bg-gray-300'}`} />
                        <span className={`truncate font-medium ${isDone ? 'text-emerald-700' : isOver ? 'text-red-600' : 'text-gray-600'}`}>{m.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {activeTab === 'discussion' && (
        <DiscussionForum projectId={project.id} projectName={project.name} />
      )}

      {/* ── My Requests tab ─────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Header row */}
          <div>
            <h3 className="text-sm font-bold text-gray-800">My Requests</h3>
            <p className="text-xs text-gray-400 mt-0.5">Track all your change requests and requirements. Use "Raise Request" above to submit a new one.</p>
          </div>

          {loadingReqs ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mr-3" />
              <span className="text-sm">Loading requests…</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600">No requests yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Raise a change request, new requirement, or ask for help.</p>
              <button onClick={() => setShowRaiseForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Raise Your First Request
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const typeMeta = REQUEST_TYPE_LABELS[req.request_type] || REQUEST_TYPE_LABELS.other;
                const statusMeta = REQUEST_STATUS_META[req.status] || REQUEST_STATUS_META.pending;
                const isApproved = req.status === 'approved';
                const daysLeft = req.due_date ? Math.ceil((new Date(req.due_date).getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={req.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                    isApproved ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl ${typeMeta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <svg className={`w-4 h-4 ${typeMeta.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeMeta.icon} />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 leading-tight">{req.title}</p>
                          <span className={`inline-block text-[10px] font-semibold mt-0.5 ${typeMeta.color}`}>{typeMeta.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{req.description}</p>

                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                      <span>Raised {fmtDate(req.created_at)}</span>
                      <span className={`font-semibold ${
                        req.priority === 'Critical' ? 'text-red-500' :
                        req.priority === 'High' ? 'text-orange-500' :
                        req.priority === 'Medium' ? 'text-amber-500' : 'text-emerald-500'
                      }`}>{req.priority} Priority</span>
                      {isApproved && daysLeft !== null && (
                        <span className={`font-bold ${daysLeft <= 0 ? 'text-red-500' : daysLeft <= 1 ? 'text-orange-500' : 'text-emerald-600'}`}>
                          {daysLeft <= 0 ? 'Deadline passed' : `${daysLeft}d to close`}
                        </span>
                      )}
                    </div>

                    {req.response_comments && (
                      <div className={`mt-3 p-3 rounded-xl border text-xs ${
                        req.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                      }`}>
                        <span className="font-bold">Team response: </span>{req.response_comments}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  gradient: string;
  highlight?: boolean;
  index: number;
  tooltip: string;
}> = ({ label, value, suffix, icon, gradient, highlight, index, tooltip }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative rounded-2xl p-5 client-card-enter cursor-default"
      style={{
        animationDelay: `${index * 80}ms`,
        background: highlight && value > 0
          ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
          : 'white',
        border: highlight && value > 0 ? '1px solid #fcd34d' : '1px solid #f1f5f9',
        boxShadow: highlight && value > 0 ? '0 4px 20px rgba(251,191,36,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'visible',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl w-max max-w-[240px] whitespace-normal text-center leading-snug">
            {tooltip}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${highlight && value > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
        <AnimatedNumber value={value} suffix={suffix} />
      </p>
    </div>
  );
};

// ─── Portal Analytics Component ───────────────────────────────────────────────
const PortalAnalytics: React.FC<{ projects: Project[]; milestoneMap: Record<number, Milestone[]> }> = ({ projects, milestoneMap }) => {
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  // ── Aggregate data ────────────────────────────────────────────────────────
  const projectStats = projects.map(p => {
    const tasks: WBSTask[] = (() => { try { const pl = JSON.parse(p.project_plan || '[]'); return Array.isArray(pl) ? pl : []; } catch { return []; } })();
    const activeTasks  = tasks.filter(t => !['Phase', 'Summary'].includes(t.type || ''));
    const clientTasks  = activeTasks.filter(t => t.owner_role === 'Client' || t.type === 'Client Requirement');
    const done         = activeTasks.filter(t => t.status === 'completed').length;
    const inProg       = activeTasks.filter(t => t.status === 'in_progress').length;
    const blocked      = activeTasks.filter(t => t.status === 'blocked').length;
    const notReq       = activeTasks.filter(t => t.status === 'not_required').length;
    const notStarted   = activeTasks.filter(t => !t.status || t.status === 'not_started').length;
    const total        = activeTasks.length;
    const progress     = total > 0 ? Math.round((done / total) * 100) : 0;
    const clientPend   = clientTasks.filter(t => t.status !== 'completed').length;
    const daysToGoLive = getDaysUntil(p.go_live_deadline) ?? null;
    const hasGoLive    = !!p.go_live_deadline;
    const mils         = milestoneMap[p.id] || [];
    const milsDone     = mils.filter(m => m.status === 'completed').length;
    const upcoming     = mils.filter(m => m.status !== 'completed' && m.due_date).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    let health = progress;
    if (blocked > 0) health -= blocked * 5;
    if (hasGoLive && daysToGoLive !== null && daysToGoLive < 0) health -= 20;
    health = Math.max(0, Math.min(100, Math.round(health)));

    const daysActive = p.project_start_date
      ? Math.max(0, Math.ceil((Date.now() - new Date(p.project_start_date).getTime()) / 86400000))
      : null;

    // Estimate current sprint from tasks
    const inProgressTask = activeTasks.find(t => t.status === 'in_progress');
    const currentSprint  = inProgressTask?.sprint_label || (inProgressTask?.sprint ? `Sprint ${inProgressTask.sprint}` : null);

    return { p, activeTasks, clientTasks, done, inProg, blocked, notReq, notStarted, total, progress, clientPend, daysToGoLive, hasGoLive, mils, milsDone, milsTotal: mils.length, upcoming, health, daysActive, currentSprint };
  });

  const allTasks        = projectStats.flatMap(s => s.activeTasks);
  const totalTasks      = allTasks.length;
  const totalDone       = allTasks.filter(t => t.status === 'completed').length;
  const totalBlocked    = allTasks.filter(t => t.status === 'blocked').length;
  const totalInProg     = allTasks.filter(t => t.status === 'in_progress').length;
  const totalClientPend = projectStats.reduce((s, ps) => s + ps.clientPend, 0);
  const totalMils       = Object.values(milestoneMap).reduce((s, ms) => s + ms.length, 0);
  const doneMils        = Object.values(milestoneMap).reduce((s, ms) => s + ms.filter(m => m.status === 'completed').length, 0);
  const overallPct      = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  // All upcoming milestones across projects, next 60 days
  const upcomingAll = projects.flatMap(p =>
    (milestoneMap[p.id] || [])
      .filter(m => m.status !== 'completed' && m.due_date)
      .map(m => ({ ...m, projectName: p.name }))
  ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
   .slice(0, 5);

  // Client action tasks across all projects
  const clientActionItems = projectStats.flatMap(s =>
    s.clientTasks
      .filter(t => t.status !== 'completed' && t.status !== 'not_required')
      .map(t => ({ ...t, projectName: s.p.name }))
  );

  // SVG Donut helper
  const Donut = ({ pct, color, size = 64, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) => {
    const r    = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
      <svg width={size} height={size} className="-rotate-90" style={{ minWidth: size }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
    );
  };

  const healthMeta = (score: number) =>
    score >= 75 ? { label: 'On Track',      color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: '#10b981' }
    : score >= 40 ? { label: 'Needs Attention', color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',  ring: '#f59e0b' }
    :               { label: 'At Risk',       color: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',    ring: '#ef4444' };

  const daysFromNow = (dateStr?: string) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 bg-white/80 rounded-3xl border border-gray-100 text-gray-400 text-sm client-card-enter">
        <p className="font-semibold text-gray-500 mb-1">No active projects</p>
        <p>Analytics will appear once your implementation is underway.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 client-card-enter">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Portfolio Analytics</h2>
          <p className="text-xs text-gray-400 mt-0.5">Live across {projects.length} active project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-400 font-medium">Live</span>
        </div>
      </div>

      {/* ── Overall health hero ───────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden p-6" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #9333ea 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 50%)' }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Big donut */}
          <div className="relative flex-shrink-0">
            <svg width={96} height={96} className="-rotate-90">
              <circle cx={48} cy={48} r={38} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={9} />
              <circle cx={48} cy={48} r={38} fill="none" stroke="white" strokeWidth={9}
                strokeDasharray={`${(overallPct / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-white rotate-90">{overallPct}%</span>
          </div>

          {/* Stats row */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Tasks Done',    value: `${totalDone}/${totalTasks}`, sub: 'completed' },
              { label: 'Milestones',    value: `${doneMils}/${totalMils}`,   sub: 'hit'        },
              { label: 'In Progress',   value: totalInProg,                  sub: 'tasks'       },
              { label: totalBlocked > 0 ? 'Blocked' : 'Blocked', value: totalBlocked, sub: totalBlocked > 0 ? '⚠ needs action' : '✓ none', warn: totalBlocked > 0 },
            ].map(({ label, value, sub, warn }) => (
              <div key={label} className="text-white/90">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-0.5">{label}</p>
                <p className={`text-xl font-extrabold leading-tight ${warn ? 'text-red-300' : 'text-white'}`}>{value}</p>
                <p className={`text-[10px] mt-0.5 ${warn ? 'text-red-300' : 'text-white/60'}`}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Client Action Items ───────────────────────────────────────────── */}
      {clientActionItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">Your Actions Required</p>
              <p className="text-[11px] text-amber-600">{clientActionItems.length} task{clientActionItems.length > 1 ? 's' : ''} waiting on you</p>
            </div>
          </div>
          <div className="space-y-2">
            {clientActionItems.slice(0, 5).map(t => (
              <div key={`${t.projectName}-${t.id}`} className="flex items-start gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'blocked' ? 'bg-red-400' : t.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.projectName}</p>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  t.status === 'blocked'     ? 'bg-red-100 text-red-600' :
                  t.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-500'
                }`}>{(t.status || 'not started').replace(/_/g, ' ')}</span>
              </div>
            ))}
            {clientActionItems.length > 5 && (
              <p className="text-[11px] text-amber-600 text-center pt-1">+{clientActionItems.length - 5} more — open the project to see all</p>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming milestones + Go-live countdowns ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Upcoming milestones */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Upcoming Milestones</p>
          {upcomingAll.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              All milestones completed
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAll.map(m => {
                const d = daysFromNow(m.due_date);
                const isUrgent = d !== null && d <= 7;
                const isOverdue = d !== null && d < 0;
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isOverdue ? 'bg-red-100 text-red-600' : isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>
                      {isOverdue ? '!' : d !== null ? `${d}d` : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{(m as any).projectName} · {fmtDate(m.due_date)}</p>
                    </div>
                    {isOverdue && <span className="flex-shrink-0 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Overdue</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Go-live countdowns */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Go-Live Countdowns</p>
          {projectStats.filter(s => s.hasGoLive).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No go-live dates set yet</div>
          ) : (
            <div className="space-y-4">
              {projectStats.filter(s => s.hasGoLive).map(({ p, daysToGoLive, progress }) => {
                const d = daysToGoLive ?? 0;
                const isOverdue = d < 0;
                const isUrgent  = d >= 0 && d <= 14;
                const barColor  = isOverdue ? '#ef4444' : isUrgent ? '#f59e0b' : '#6366f1';
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-gray-700 truncate max-w-[60%]">{p.name}</p>
                      <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-indigo-600'}`}>
                        {isOverdue ? `${Math.abs(d)}d overdue` : `${d}d to go`}
                      </span>
                    </div>
                    {/* Dual bar: progress vs time elapsed */}
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: barColor, opacity: 0.25 }} />
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%`, background: barColor }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{progress}% complete · {fmtDate(p.go_live_deadline)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-project deep-dive ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Project Breakdown</p>
        <div className="space-y-3">
          {projectStats.map(({ p, done, inProg, blocked, notStarted, notReq, total, progress, clientPend, daysToGoLive, hasGoLive, milsDone, milsTotal, health, daysActive, currentSprint, upcoming }) => {
            const hm  = healthMeta(health);
            const isExpanded = expandedProject === p.id;
            const BARS = [
              { label: 'Done',       count: done,       color: '#10b981' },
              { label: 'In Progress',count: inProg,     color: '#6366f1' },
              { label: 'Not Started',count: notStarted, color: '#e2e8f0' },
              { label: 'Blocked',    count: blocked,    color: '#ef4444' },
              { label: 'Not Req.',   count: notReq,     color: '#cbd5e1' },
            ].filter(b => b.count > 0);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header — always visible */}
                <button
                  className="w-full text-left p-5 flex items-center gap-4 hover:bg-gray-50/60 transition-colors"
                  onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                >
                  {/* Donut */}
                  <div className="relative flex-shrink-0">
                    <Donut pct={progress} color={hm.color} size={56} stroke={6} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold" style={{ color: hm.color }}>{progress}%</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hm.bg} ${hm.text}`}>{hm.label}</span>
                      {currentSprint && <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{currentSprint}</span>}
                    </div>
                    {/* Mini stacked bar */}
                    <div className="flex h-1.5 rounded-full overflow-hidden gap-px mt-2 w-full bg-gray-100">
                      {total > 0 && BARS.map(b => (
                        <div key={b.label} style={{ width: `${(b.count / total) * 100}%`, background: b.color }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 flex-wrap">
                      <span>{done}/{total} tasks</span>
                      {blocked > 0 && <span className="text-red-500 font-semibold">{blocked} blocked</span>}
                      {clientPend > 0 && <span className="text-amber-600 font-semibold">{clientPend} action{clientPend > 1 ? 's' : ''} from you</span>}
                      {milsTotal > 0 && <span>{milsDone}/{milsTotal} milestones</span>}
                      {hasGoLive && daysToGoLive !== null && (
                        <span className={daysToGoLive < 0 ? 'text-red-500 font-semibold' : daysToGoLive <= 14 ? 'text-amber-500 font-semibold' : ''}>
                          {daysToGoLive < 0 ? `${Math.abs(daysToGoLive)}d overdue` : `${daysToGoLive}d to go-live`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <svg className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                    {/* 4-col stat row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Health',       value: `${health}%`,              color: hm.text,           bg: hm.bg         },
                        { label: 'Days Active',  value: daysActive !== null ? `${daysActive}d` : '—', color: 'text-gray-800', bg: 'bg-gray-50' },
                        { label: 'Milestones',   value: `${milsDone}/${milsTotal}`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                        { label: 'Go-Live',      value: hasGoLive && daysToGoLive !== null ? (daysToGoLive < 0 ? `${Math.abs(daysToGoLive)}d late` : `${daysToGoLive}d`) : '—', color: hasGoLive && daysToGoLive !== null && daysToGoLive < 0 ? 'text-red-600' : 'text-indigo-700', bg: 'bg-indigo-50' },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`rounded-xl p-3 ${bg}`}>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                          <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Task breakdown legend */}
                    {total > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Task Status Breakdown</p>
                        <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2">
                          {BARS.map(b => (
                            <div key={b.label} style={{ width: `${(b.count / total) * 100}%`, background: b.color }} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {BARS.map(b => (
                            <div key={b.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                              {b.label} <span className="font-semibold text-gray-700">{b.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming milestones for this project */}
                    {upcoming.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Next Milestones</p>
                        <div className="space-y-2">
                          {upcoming.slice(0, 3).map(m => {
                            const d = daysFromNow(m.due_date);
                            return (
                              <div key={m.id} className="flex items-center gap-3 text-xs">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${d !== null && d < 0 ? 'bg-red-100 text-red-600' : d !== null && d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>
                                  {d !== null ? (d < 0 ? '!' : `${d}d`) : '?'}
                                </div>
                                <span className="flex-1 text-gray-700 truncate">{m.name}</span>
                                <span className="text-gray-400 flex-shrink-0">{fmtDate(m.due_date)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Team */}
                    {(p.csm_name || p.pm_name) && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Team</p>
                        <div className="flex flex-wrap gap-2">
                          {p.csm_name && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">{p.csm_name.charAt(0)}</div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-700">{p.csm_name}</p>
                                <p className="text-[9px] text-gray-400">CSM</p>
                              </div>
                            </div>
                          )}
                          {p.pm_name && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600">{p.pm_name.charAt(0)}</div>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-700">{p.pm_name}</p>
                                <p className="text-[9px] text-gray-400">PM</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const ClientPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestoneMap, setMilestoneMap] = useState<Record<number, Milestone[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [notifTab, setNotifTab] = useState<string | undefined>(undefined);
  const [portalView, setPortalView] = useState<'projects' | 'analytics'>('projects');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/projects');
      const all: Project[] = res.ok ? await res.json() : [];
      const clientEmail = user?.email?.toLowerCase() || '';
      const active = all.filter(p =>
        ['ACTIVE', 'APPROVED'].includes(p.status) &&
        (clientEmail ? (p.client_spoc_email || '').toLowerCase() === clientEmail : false)
      );
      setProjects(active);

      const entries = await Promise.all(
        active.map(p =>
          fetch(`http://localhost:3001/api/projects/${p.id}/milestones`)
            .then(r => r.ok ? r.json() : [])
            .then((mils: Milestone[]) => [p.id, mils] as [number, Milestone[]])
            .catch(() => [p.id, []] as [number, Milestone[]])
        )
      );
      const map: Record<number, Milestone[]> = {};
      entries.forEach(([id, mils]) => { map[id as number] = mils as Milestone[]; });
      setMilestoneMap(map);
    } catch (_) {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Aggregate stats
  const pendingClientTasks = projects.reduce((sum, p) => {
    const tasks: WBSTask[] = (() => {
      try { const pl = JSON.parse(p.project_plan || '[]'); return Array.isArray(pl) ? pl : []; } catch { return []; }
    })();
    return sum + tasks.filter(t => (t.owner_role === 'Client' || t.type === 'Client Requirement') && t.status !== 'completed').length;
  }, 0);

  const totalMilestones = Object.values(milestoneMap).reduce((s, ms) => s + ms.length, 0);
  const completedMilestones = Object.values(milestoneMap).reduce((s, ms) => s + ms.filter(m => m.status === 'completed').length, 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #fdf4ff 100%)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-ping opacity-20" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-700">Loading your portal…</p>
          <p className="text-xs text-gray-400 mt-1">Fetching your project data</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Global animations */}
      <style>{`
        @keyframes client-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes client-detail-slide {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%  { transform: translateY(-12px) rotate(2deg); }
          66%  { transform: translateY(-6px) rotate(-1deg); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px); }
          50%  { transform: translateY(-18px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .client-card-enter {
          opacity: 0;
          animation: client-fade-up 0.5s ease-out forwards;
        }
        .client-detail-enter {
          animation: client-detail-slide 0.35s ease-out;
        }
        .float-1 { animation: float-slow 6s ease-in-out infinite; }
        .float-2 { animation: float-slower 8s ease-in-out infinite; animation-delay: -2s; }
        .float-3 { animation: float-slow 7s ease-in-out infinite; animation-delay: -4s; }
      `}</style>

      <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f5f3ff 40%, #fdf4ff 100%)' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-indigo-200/50 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <img
                  src="/logo192.png"
                  alt="Chaos Coordinator"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900 tracking-tight">Chaos Coordinator</p>
                <p className="text-[10px] font-medium text-indigo-400 tracking-wide uppercase">Client Portal</p>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {!selectedProject && (
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setPortalView('projects')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${portalView === 'projects' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >Projects</button>
                  <button
                    onClick={() => setPortalView('analytics')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${portalView === 'analytics' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >Analytics</button>
                </div>
              )}
              {user && (
                <div className="bg-slate-800 rounded-lg">
                  <NotificationBell
                    userId={user.id}
                    theme="dark"
                    onProjectClick={(pid, notifType) => {
                      const found = projects.find(p => p.id === pid);
                      if (found) {
                        setNotifTab(NOTIF_TAB_MAP[notifType] || 'overview');
                        setSelectedProject(found);
                      }
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{user?.name?.charAt(0).toUpperCase() || 'C'}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 leading-none">{user?.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              milestones={milestoneMap[selectedProject.id] || []}
              onBack={() => { setSelectedProject(null); setNotifTab(undefined); }}
              initialTab={notifTab}
            />
          ) : portalView === 'analytics' ? (
            <PortalAnalytics projects={projects} milestoneMap={milestoneMap} />
          ) : (
            <>
              {/* ── Hero section ────────────────────────────────────────────── */}
              <div className="relative rounded-3xl overflow-hidden mb-8 client-card-enter" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)' }}>
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 float-1" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
                <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-10 float-2" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(-50%, 40%)' }} />
                <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full opacity-5 float-3" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

                {/* Mesh grid overlay */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }} />

                <div className="relative px-8 py-10">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white/80 text-xs font-medium">Live Dashboard</span>
                      </div>
                      <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                        Welcome back, {user?.name?.split(' ')[0]}!
                      </h1>
                      <p className="text-indigo-200 text-sm max-w-md">
                        Track your implementation progress, milestones, and collaborate with your team — all in one place.
                      </p>
                      {pendingClientTasks > 0 && (
                        <div className="mt-5 inline-flex items-center gap-2.5 bg-amber-400/20 border border-amber-300/30 backdrop-blur rounded-2xl px-4 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-400/30 flex items-center justify-center">
                            <svg className="w-4 h-4 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-white text-sm font-semibold">
                            {pendingClientTasks} action{pendingClientTasks > 1 ? 's' : ''} require your attention
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Big stat bubble */}
                    <div className="hidden md:flex flex-col items-center justify-center bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-5 min-w-[100px] border border-white/20 flex-shrink-0">
                      <p className="text-5xl font-black text-white leading-none">{projects.length}</p>
                      <p className="text-indigo-200 text-xs mt-1 text-center">Active<br/>Project{projects.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Stats grid ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  index={0}
                  label="Active Projects"
                  value={projects.length}
                  gradient="from-indigo-500 to-violet-600"
                  tooltip="Projects currently being implemented for your organisation"
                  icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                />
                <StatCard
                  index={1}
                  label="Your Actions"
                  value={pendingClientTasks}
                  gradient="from-amber-400 to-orange-500"
                  highlight
                  tooltip="WBS tasks assigned to you that are pending — your team is waiting on these"
                  icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <StatCard
                  index={2}
                  label="Milestones Done"
                  value={completedMilestones}
                  suffix={totalMilestones > 0 ? `/${totalMilestones}` : ''}
                  gradient="from-emerald-500 to-teal-500"
                  tooltip="Milestones completed out of total milestones across all your active projects"
                  icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
                />
                <StatCard
                  index={3}
                  label="Total Milestones"
                  value={totalMilestones}
                  gradient="from-sky-500 to-blue-600"
                  tooltip="Total key milestones set across all your active projects"
                  icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
                />
              </div>

              {/* ── Project list ────────────────────────────────────────────── */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-widest">Your Projects</h2>
                <span className="text-xs text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
              </div>

              {projects.length === 0 ? (
                <div className="text-center py-20 bg-white/80 backdrop-blur rounded-3xl border border-gray-100 shadow-sm client-card-enter">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-semibold">No active projects yet</p>
                  <p className="text-gray-400 text-sm mt-1.5">Your implementation team will add you once a project is underway.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {projects.map((p, i) => (
                    <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto px-6 py-6 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-300">© 2025 Chaos Coordinator · Client Portal</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-gray-400">All systems operational</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ClientPortal;
