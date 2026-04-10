/**
 * WBS Project Plan Generator — V2
 *
 * Generates a sprint-based Work Breakdown Structure (WBS) project plan based on:
 * - SOW / MoM text (extracts keywords to detect scope)
 * - Whether integrations are required (30 vs 45 working days)
 * - A start date (optional — if not provided, tasks use relative day offsets)
 *
 * Working days = Mon–Fri only (weekends excluded).
 * Standard plan:        30 working days / 5 sprints (Sprint 0–4)
 * With integrations:    45 working days / 6 sprints (Sprint 0–5 + Phase 2)
 *
 * Row types:
 *   Phase | Summary | Task | Milestone | Deliverable | Client Requirement | Assumption | Risk
 *
 * WBS code hierarchy:
 *   1       = Phase
 *   1.1     = Sprint Summary
 *   1.1.1   = Task
 *   1.1.M1  = Milestone
 *   1.1.D1  = Deliverable
 *   1.1.CR1 = Client Requirement
 *   1.1.A1  = Assumption
 *   1.1.R1  = Risk
 */

// ── Sprint metadata ──────────────────────────────────────────────────────────

const SPRINT_META = {
  0: {
    sprint_label: 'Sprint 0 (Wk 0–2)',
    sprint_week:  'Wk 0–2',
    deliverable:  'Signed project charter + environments ready',
  },
  1: {
    sprint_label: 'Sprint 1 (Wk 3)',
    sprint_week:  'Wk 3',
    deliverable:  'SSO + configured system',
  },
  2: {
    sprint_label: 'Sprint 2 (Wk 4)',
    sprint_week:  'Wk 4',
    deliverable:  'UAT-ready migrated system',
  },
  3: {
    sprint_label: 'Sprint 3 (Wk 5–6)',
    sprint_week:  'Wk 5–6',
    deliverable:  'UAT sign-off + trained users',
  },
  4: {
    sprint_label: 'Sprint 4 (Wk 6)',
    sprint_week:  'Wk 6',
    deliverable:  'Go-live complete + stakeholder sign-off',
  },
  5: {
    sprint_label: 'Sprint 5 (Wk 7–9)',
    sprint_week:  'Wk 7–9',
    deliverable:  'Deployed integration workflows',
  },
};

// ── Base plan V2 (30 working days, Phase 1 only) ─────────────────────────────

const BASE_PLAN_V2 = [
  // ── Phase header ────────────────────────────────────────────────────────────
  {
    wbs: '1', phase: 'Phase 1', sprint: -1, type: 'Phase',
    name: 'Phase 1: Implementation & Go-Live',
    owner_role: '', day_start: 1, day_end: 30, depends_on: '', notes: '',
  },

  // ── Sprint 0: Prep Phase (Days 1–6) ─────────────────────────────────────────
  {
    wbs: '1.1', phase: 'Phase 1', sprint: 0, type: 'Summary',
    name: 'Prep Phase',
    owner_role: '', day_start: 1, day_end: 6, depends_on: '', notes: '',
  },
  {
    wbs: '1.1.1', phase: 'Phase 1', sprint: 0, type: 'Task',
    name: 'Conduct kickoff meeting',
    owner_role: 'CSM', day_start: 1, day_end: 1, depends_on: '', notes: '',
  },
  {
    wbs: '1.1.2', phase: 'Phase 1', sprint: 0, type: 'Task',
    name: 'Define stakeholders and project governance',
    owner_role: 'CSM', day_start: 1, day_end: 2, depends_on: '', notes: '',
  },
  {
    wbs: '1.1.3', phase: 'Phase 1', sprint: 0, type: 'Task',
    name: 'Requirements gathering & review',
    owner_role: 'CSM', day_start: 2, day_end: 4, depends_on: '1.1.2', notes: '',
  },
  {
    wbs: '1.1.4', phase: 'Phase 1', sprint: 0, type: 'Task',
    name: 'Prepare and finalize project plan',
    owner_role: 'PM', day_start: 3, day_end: 5, depends_on: '1.1.1, 1.1.2', notes: '',
  },
  {
    wbs: '1.1.5', phase: 'Phase 1', sprint: 0, type: 'Task',
    name: 'Set up UAT and Prod environments',
    owner_role: 'PM', day_start: 4, day_end: 6, depends_on: '1.1.4', notes: '',
  },
  {
    wbs: '1.1.D1', phase: 'Phase 1', sprint: 0, type: 'Deliverable',
    name: 'Signed-off project charter',
    owner_role: 'PM', day_start: 5, day_end: 6, depends_on: '1.1.4',
    notes: 'PM to finalize, client to sign off',
  },
  {
    wbs: '1.1.CR1', phase: 'Phase 1', sprint: 0, type: 'Client Requirement',
    name: 'Confirm project goals, scope and success criteria',
    owner_role: 'Client', day_start: 1, day_end: 4, depends_on: '',
    notes: 'Required before project plan is finalized',
  },
  {
    wbs: '1.1.M1', phase: 'Phase 1', sprint: 0, type: 'Milestone',
    name: 'Prep Phase Complete — Project plan finalized, environments ready',
    owner_role: '', day_start: 6, day_end: 6, depends_on: '1.1.5, 1.1.D1',
    notes: 'Gate: proceed to Sprint 1',
  },

  // ── Sprint 1: Core Configuration (Days 7–12) ─────────────────────────────────
  {
    wbs: '1.2', phase: 'Phase 1', sprint: 1, type: 'Summary',
    name: 'Core Configuration',
    owner_role: '', day_start: 7, day_end: 12, depends_on: '1.1', notes: '',
  },
  {
    wbs: '1.2.1', phase: 'Phase 1', sprint: 1, type: 'Task',
    name: 'SSO authentication setup',
    owner_role: 'PM', day_start: 7, day_end: 8, depends_on: '1.1.CR1', notes: '',
  },
  {
    wbs: '1.2.2', phase: 'Phase 1', sprint: 1, type: 'Task',
    name: 'Core system configuration',
    owner_role: 'PM', day_start: 7, day_end: 12, depends_on: '1.1.5', notes: '',
  },
  {
    wbs: '1.2.3', phase: 'Phase 1', sprint: 1, type: 'Task',
    name: 'User roles & permissions configuration',
    owner_role: 'PM', day_start: 9, day_end: 12, depends_on: '1.2.2', notes: '',
  },
  {
    wbs: '1.2.D1', phase: 'Phase 1', sprint: 1, type: 'Deliverable',
    name: 'SSO integration setup complete',
    owner_role: 'PM', day_start: 12, day_end: 12, depends_on: '1.2.1', notes: '',
  },
  {
    wbs: '1.2.CR1', phase: 'Phase 1', sprint: 1, type: 'Client Requirement',
    name: 'Provide API credentials and environment access',
    owner_role: 'Client', day_start: 7, day_end: 9, depends_on: '',
    notes: 'Required for integration setup',
  },
  {
    wbs: '1.2.M1', phase: 'Phase 1', sprint: 1, type: 'Milestone',
    name: 'Configuration Complete — SSO & core system ready',
    owner_role: '', day_start: 12, day_end: 12, depends_on: '1.2.3, 1.2.D1',
    notes: 'Gate: proceed to Migration',
  },

  // ── Sprint 2: Migration & Data Setup (Days 13–18) ────────────────────────────
  {
    wbs: '1.3', phase: 'Phase 1', sprint: 2, type: 'Summary',
    name: 'Migration & Data Setup',
    owner_role: '', day_start: 13, day_end: 18, depends_on: '1.2', notes: '',
  },
  {
    wbs: '1.3.1', phase: 'Phase 1', sprint: 2, type: 'Task',
    name: 'Execute migration to UAT environment',
    owner_role: 'PM', day_start: 13, day_end: 15, depends_on: '1.2.2', notes: '',
  },
  {
    wbs: '1.3.2', phase: 'Phase 1', sprint: 2, type: 'Task',
    name: 'Content transformation (if required)',
    owner_role: 'PM', day_start: 13, day_end: 18, depends_on: '',
    notes: 'Optional — if content transformation is in scope',
  },
  {
    wbs: '1.3.3', phase: 'Phase 1', sprint: 2, type: 'Task',
    name: 'Run data integrity checks',
    owner_role: 'PM', day_start: 15, day_end: 16, depends_on: '1.3.1', notes: '',
  },
  {
    wbs: '1.3.4', phase: 'Phase 1', sprint: 2, type: 'Task',
    name: 'Prepare UAT plan and user stories',
    owner_role: 'CSM', day_start: 14, day_end: 18, depends_on: '1.3.1', notes: '',
  },
  {
    wbs: '1.3.D1', phase: 'Phase 1', sprint: 2, type: 'Deliverable',
    name: 'UAT Plan',
    owner_role: 'CSM', day_start: 18, day_end: 18, depends_on: '1.3.4', notes: '',
  },
  {
    wbs: '1.3.CR1', phase: 'Phase 1', sprint: 2, type: 'Client Requirement',
    name: 'Review UAT migration results and confirm scope',
    owner_role: 'Client', day_start: 16, day_end: 18, depends_on: '1.3.1', notes: '',
  },
  {
    wbs: '1.3.A1', phase: 'Phase 1', sprint: 2, type: 'Assumption',
    name: 'Content transformation team starts Day 1 of sprint if required',
    owner_role: '', day_start: 13, day_end: 13, depends_on: '', notes: '',
  },
  {
    wbs: '1.3.M1', phase: 'Phase 1', sprint: 2, type: 'Milestone',
    name: 'Migration Complete — UAT plan ready, data integrity verified',
    owner_role: '', day_start: 18, day_end: 18, depends_on: '1.3.3, 1.3.D1, 1.3.CR1',
    notes: 'Gate: proceed to Testing',
  },

  // ── Sprint 3: Testing & Validation (Days 19–24) ──────────────────────────────
  {
    wbs: '1.4', phase: 'Phase 1', sprint: 3, type: 'Summary',
    name: 'Testing & Validation (SIT & KUT)',
    owner_role: '', day_start: 19, day_end: 24, depends_on: '1.3', notes: '',
  },
  {
    wbs: '1.4.1', phase: 'Phase 1', sprint: 3, type: 'Task',
    name: 'Execute System Integration Testing (SIT)',
    owner_role: 'PM', day_start: 19, day_end: 21, depends_on: '1.3.1', notes: '',
  },
  {
    wbs: '1.4.2', phase: 'Phase 1', sprint: 3, type: 'Task',
    name: 'Conduct Key User Training (KUT)',
    owner_role: 'CSM', day_start: 22, day_end: 24, depends_on: '1.4.1', notes: '',
  },
  {
    wbs: '1.4.3', phase: 'Phase 1', sprint: 3, type: 'Task',
    name: 'Complete content transformation and get sign-off',
    owner_role: 'CSM', day_start: 19, day_end: 23, depends_on: '1.3.2', notes: '',
  },
  {
    wbs: '1.4.CR1', phase: 'Phase 1', sprint: 3, type: 'Client Requirement',
    name: 'Conduct UAT with business users',
    owner_role: 'Client', day_start: 20, day_end: 24, depends_on: '1.4.1', notes: '',
  },
  {
    wbs: '1.4.CR2', phase: 'Phase 1', sprint: 3, type: 'Client Requirement',
    name: 'Provide UAT feedback and content sign-off',
    owner_role: 'Client', day_start: 22, day_end: 24, depends_on: '1.4.CR1', notes: '',
  },
  {
    wbs: '1.4.D1', phase: 'Phase 1', sprint: 3, type: 'Deliverable',
    name: 'UAT-ready system + content signed off',
    owner_role: 'PM', day_start: 24, day_end: 24, depends_on: '1.4.1, 1.4.2, 1.4.3', notes: '',
  },
  {
    wbs: '1.4.M1', phase: 'Phase 1', sprint: 3, type: 'Milestone',
    name: 'Testing Complete — UAT-ready, users trained, content signed off',
    owner_role: '', day_start: 24, day_end: 24, depends_on: '1.4.D1, 1.4.CR2',
    notes: 'Gate: proceed to Final Validation',
  },

  // ── Sprint 4: Final Validation & Go-Live (Days 25–30) ────────────────────────
  {
    wbs: '1.5', phase: 'Phase 1', sprint: 4, type: 'Summary',
    name: 'Final Validation & Go-Live',
    owner_role: '', day_start: 25, day_end: 30, depends_on: '1.4', notes: '',
  },
  {
    wbs: '1.5.1', phase: 'Phase 1', sprint: 4, type: 'Task',
    name: 'Resolve defects and final fixes',
    owner_role: 'PM', day_start: 25, day_end: 27, depends_on: '1.4.CR2', notes: '',
  },
  {
    wbs: '1.5.2', phase: 'Phase 1', sprint: 4, type: 'Task',
    name: 'Migrate delta data & deploy final content',
    owner_role: 'PM', day_start: 27, day_end: 29, depends_on: '1.5.1', notes: '',
  },
  {
    wbs: '1.5.3', phase: 'Phase 1', sprint: 4, type: 'Task',
    name: 'Go-Live readiness check',
    owner_role: 'CSM', day_start: 29, day_end: 29, depends_on: '1.5.2', notes: '',
  },
  {
    wbs: '1.5.CR1', phase: 'Phase 1', sprint: 4, type: 'Client Requirement',
    name: 'Participate in handover and review documentation',
    owner_role: 'Client', day_start: 29, day_end: 30, depends_on: '1.5.2', notes: '',
  },
  {
    wbs: '1.5.D1', phase: 'Phase 1', sprint: 4, type: 'Deliverable',
    name: 'Final Project Report & Stakeholder Sign-Off',
    owner_role: 'CSM', day_start: 30, day_end: 30, depends_on: '1.5.3, 1.5.CR1', notes: '',
  },
  {
    wbs: '1.5.R1', phase: 'Phase 1', sprint: 4, type: 'Risk',
    name: 'Commercials may change based on scope finalization',
    owner_role: '', day_start: 25, day_end: 25, depends_on: '',
    notes: 'Monitor throughout project',
  },
  {
    wbs: '1.5.M1', phase: 'Phase 1', sprint: 4, type: 'Milestone',
    name: '⭐ Phase 1 Complete — Go-Live, stakeholder sign-off received',
    owner_role: '', day_start: 30, day_end: 30, depends_on: '1.5.D1',
    notes: 'MAJOR: Phase 1 close-out',
  },
];

// ── Phase 2: Integration (Days 31–45) — added when hasIntegrations is true ───

const PHASE2_PLAN = [
  // Phase 2 header
  {
    wbs: '2', phase: 'Phase 2', sprint: -2, type: 'Phase',
    name: 'Phase 2: Integration (Post Go-Live)',
    owner_role: '', day_start: 31, day_end: 45, depends_on: '', notes: '',
  },
  // Sprint 5 summary
  {
    wbs: '2.1', phase: 'Phase 2', sprint: 5, type: 'Summary',
    name: 'Integration',
    owner_role: '', day_start: 31, day_end: 45, depends_on: '1.5',
    notes: 'Timeline subject to change after requirement finalization',
  },
  {
    wbs: '2.1.1', phase: 'Phase 2', sprint: 5, type: 'Task',
    name: 'Integration architecture review',
    owner_role: 'PM', day_start: 31, day_end: 33, depends_on: '1.5.M1', notes: '',
  },
  {
    wbs: '2.1.2', phase: 'Phase 2', sprint: 5, type: 'Task',
    name: 'API / Connector setup',
    owner_role: 'PM', day_start: 33, day_end: 38, depends_on: '2.1.1', notes: '',
  },
  {
    wbs: '2.1.3', phase: 'Phase 2', sprint: 5, type: 'Task',
    name: 'Integration development & configuration',
    owner_role: 'PM', day_start: 37, day_end: 43, depends_on: '2.1.2', notes: '',
  },
  {
    wbs: '2.1.4', phase: 'Phase 2', sprint: 5, type: 'Task',
    name: 'Execute integration testing (SIT)',
    owner_role: 'PM', day_start: 37, day_end: 43, depends_on: '2.1.2', notes: '',
  },
  {
    wbs: '2.1.CR1', phase: 'Phase 2', sprint: 5, type: 'Client Requirement',
    name: 'Provide integration API credentials and endpoints',
    owner_role: 'Client', day_start: 31, day_end: 33, depends_on: '',
    notes: 'Required for integration setup',
  },
  {
    wbs: '2.1.D1', phase: 'Phase 2', sprint: 5, type: 'Deliverable',
    name: 'Integration deployed & operational',
    owner_role: 'PM', day_start: 45, day_end: 45, depends_on: '2.1.3, 2.1.4', notes: '',
  },
  {
    wbs: '2.1.A1', phase: 'Phase 2', sprint: 5, type: 'Assumption',
    name: 'Integration timeline is subject to change after requirement finalization',
    owner_role: '', day_start: 31, day_end: 31, depends_on: '', notes: '',
  },
  {
    wbs: '2.1.R1', phase: 'Phase 2', sprint: 5, type: 'Risk',
    name: 'Commercials may change based on scope finalization',
    owner_role: '', day_start: 31, day_end: 31, depends_on: '',
    notes: 'Monitor throughout project',
  },
  {
    wbs: '2.1.M1', phase: 'Phase 2', sprint: 5, type: 'Milestone',
    name: '⭐ Project Complete — All integration workflows deployed',
    owner_role: '', day_start: 45, day_end: 45, depends_on: '2.1.D1',
    notes: 'MAJOR: Project close-out',
  },
];

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Add N working days to a date (skips Sat/Sun)
 */
function addWorkingDays(startDate, days) {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++; // skip Sun=0, Sat=6
  }
  return date;
}

/**
 * Get the date of the Nth working day from a start date (1-indexed).
 * Day 1 = the start date itself (if it is a working day).
 */
function workingDayDate(startDate, dayNum) {
  const date = new Date(startDate);
  let count = 0;
  while (count < dayNum - 1) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return date;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Generate the sprint-based WBS plan (V2 — full type system).
 *
 * @param {Object} opts
 * @param {string|null} opts.startDate          - ISO date string, or null for a tentative plan
 * @param {boolean}     opts.hasIntegrations    - whether the project has integration requirements
 * @param {string}      opts.momText            - MoM / SOW text (reserved for future scope detection)
 * @param {string}      opts.integrationDetails - integration details text
 * @returns {Array} array of task objects with full WBS type metadata
 */
function generateProjectPlan({ startDate, hasIntegrations, momText, integrationDetails, customTotalDays }) {
  let rawTasks = [...BASE_PLAN_V2];
  if (hasIntegrations) rawTasks = [...rawTasks, ...PHASE2_PLAN];

  const defaultDays = hasIntegrations ? 45 : 30;
  const totalDays = (customTotalDays && Number(customTotalDays) >= 10)
    ? Math.round(Number(customTotalDays))
    : defaultDays;

  return rawTasks.map((t, idx) => {
    const sprintNum = t.sprint >= 0 ? t.sprint : (t.sprint === -1 ? 0 : 5);
    const meta = SPRINT_META[sprintNum] || {};

    let dayStart = t.day_start;
    let dayEnd   = t.day_end;
    if (totalDays !== defaultDays) {
      dayStart = Math.max(1, Math.round(t.day_start * totalDays / defaultDays));
      dayEnd   = Math.max(dayStart, Math.round(t.day_end * totalDays / defaultDays));
    }

    const task = {
      id: idx + 1,
      wbs: t.wbs,
      phase: t.phase,
      sprint: t.sprint,
      sprint_label: meta.sprint_label || (t.sprint < 0 ? t.phase : `Sprint ${t.sprint}`),
      sprint_week:  meta.sprint_week || '',
      deliverable:  meta.deliverable || '',
      type: t.type,
      name: t.name,
      owner_role: t.owner_role,
      day_start: dayStart,
      day_end:   dayEnd,
      duration_days: dayEnd - dayStart + 1,
      status: 'not_started',
      tentative: !startDate,
      total_working_days: totalDays,
      depends_on: t.depends_on || '',
      notes: t.notes || '',
    };

    if (startDate) {
      const sd = new Date(startDate);
      task.planned_start = formatDate(workingDayDate(sd, dayStart));
      task.planned_end   = formatDate(workingDayDate(sd, dayEnd));
    }

    return task;
  });
}

module.exports = { generateProjectPlan };
