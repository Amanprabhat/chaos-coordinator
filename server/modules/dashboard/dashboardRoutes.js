const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

/**
 * Dashboard API Routes
 * Base: /api/dashboard
 */

// GET /api/dashboard/overview - Get dashboard overview with key metrics
router.get('/overview', async (req, res) => {
  try {
    const { user_id, user_role } = req.query;

    // Get basic counts
    const [
      projectCount,
      activeProjectCount,
      taskCount,
      milestoneCount,
      riskCount,
      changeCount
    ] = await Promise.all([
      db('projects').count('* as count'),
      db('projects').where('status', 'active').count('* as count'),
      db('tasks').count('* as count'),
      db('milestones').count('* as count'),
      db('risks').count('* as count'),
      db('changes').count('* as count')
    ]);

    // Get stage distribution
    const stageDistribution = await db('projects')
      .select(
        'lifecycle_stages.name as stage_name',
        db.raw('COUNT(*) as count')
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .groupBy('lifecycle_stages.name', 'lifecycle_stages.display_order')
      .orderBy('lifecycle_stages.display_order', 'asc');

    // Get risk severity distribution
    const riskDistribution = await db('risks')
      .select('severity', db.raw('COUNT(*) as count'))
      .groupBy('severity')
      .orderBy('severity', 'asc');

    // Get task status distribution
    const taskStatusDistribution = await db('tasks')
      .select('status', db.raw('COUNT(*) as count'))
      .groupBy('status')
      .orderBy('count', 'desc');

    const overview = {
      summary: {
        total_projects: parseInt(projectCount[0].count),
        active_projects: parseInt(activeProjectCount[0].count),
        total_tasks: parseInt(taskCount[0].count),
        total_milestones: parseInt(milestoneCount[0].count),
        total_risks: parseInt(riskCount[0].count),
        total_changes: parseInt(changeCount[0].count)
      },
      distributions: {
        by_stage: stageDistribution,
        by_risk_severity: riskDistribution,
        by_task_status: taskStatusDistribution
      }
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// GET /api/dashboard/issues - Get dashboard issues (orphaned tasks, overdue items, blocked milestones)
router.get('/issues', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get tasks without owners (should be empty due to validation)
    const orphanedTasks = await db('tasks')
      .whereNull('owner_id')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id');

    // Get overdue tasks
    const overdueTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .where('tasks.due_date', '<', today)
      .where('tasks.status', 'in', ['todo', 'in_progress'])
      .orderBy('tasks.due_date', 'asc');

    // Calculate days overdue for each task
    for (const task of overdueTasks) {
      const dueDate = new Date(task.due_date);
      const todayDate = new Date(today);
      task.days_overdue = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
    }

    // Get blocked milestones
    const blockedMilestones = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.status', 'blocked')
      .orderBy('milestones.due_date', 'asc');

    // Get blocking tasks for each blocked milestone
    for (const milestone of blockedMilestones) {
      const blockingTasks = await db('tasks')
        .where({
          milestone_id: milestone.id,
          status: 'blocked'
        })
        .select('title', 'description', 'owner_id');
      
      milestone.blocking_tasks = blockingTasks;
    }

    // Get overdue milestones
    const overdueMilestones = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.due_date', '<', today)
      .where('milestones.status', 'in', ['pending', 'in_progress'])
      .orderBy('milestones.due_date', 'asc');

    // Calculate days overdue for each milestone
    for (const milestone of overdueMilestones) {
      const dueDate = new Date(milestone.due_date);
      const todayDate = new Date(today);
      milestone.days_overdue = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
    }

    // Get pending handovers
    const pendingHandovers = await db('handover_notes')
      .select(
        'handover_notes.*',
        'projects.name as project_name',
        'projects.client_name',
        'lifecycle_stages.name as project_stage'
      )
      .leftJoin('projects', 'handover_notes.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .where('handover_notes.checklist_completed', false)
      .orWhere('handover_notes.approved_by', null)
      .orderBy('handover_notes.created_at', 'asc');

    // Get critical risks
    const criticalRisks = await db('risks')
      .select(
        'risks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'risks.project_id', 'projects.id')
      .leftJoin('users as owner', 'risks.owner_id', 'owner.id')
      .where('risks.severity', 'critical')
      .where('risks.status', 'open')
      .orderBy('risks.identified_date', 'desc');

    const issues = {
      orphaned_tasks: {
        count: orphanedTasks.length,
        items: orphanedTasks,
        severity: orphanedTasks.length > 0 ? 'high' : 'none'
      },
      overdue_tasks: {
        count: overdueTasks.length,
        items: overdueTasks,
        severity: overdueTasks.length > 0 ? 'high' : 'none'
      },
      blocked_milestones: {
        count: blockedMilestones.length,
        items: blockedMilestones,
        severity: blockedMilestones.length > 0 ? 'medium' : 'none'
      },
      overdue_milestones: {
        count: overdueMilestones.length,
        items: overdueMilestones,
        severity: overdueMilestones.length > 0 ? 'high' : 'none'
      },
      pending_handovers: {
        count: pendingHandovers.length,
        items: pendingHandovers,
        severity: pendingHandovers.length > 0 ? 'medium' : 'none'
      },
      critical_risks: {
        count: criticalRisks.length,
        items: criticalRisks,
        severity: criticalRisks.length > 0 ? 'critical' : 'none'
      },
      total_issues: orphanedTasks.length + overdueTasks.length + blockedMilestones.length + overdueMilestones.length + pendingHandovers.length + criticalRisks.length
    };

    res.json(issues);
  } catch (error) {
    console.error('Error fetching dashboard issues:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard issues' });
  }
});

// GET /api/dashboard/my-work - Get user-specific work items
router.get('/my-work', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get user's tasks
    const myTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'milestones.name as milestone_name'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('milestones', 'tasks.milestone_id', 'milestones.id')
      .where('tasks.owner_id', user_id)
      .orderBy('tasks.due_date', 'asc');

    // Categorize tasks
    const myTasksByStatus = {
      todo: myTasks.filter(t => t.status === 'todo'),
      in_progress: myTasks.filter(t => t.status === 'in_progress'),
      completed: myTasks.filter(t => t.status === 'completed'),
      blocked: myTasks.filter(t => t.status === 'blocked')
    };

    // Get overdue tasks for this user
    const myOverdueTasks = myTasks.filter(t => 
      t.due_date < today && ['todo', 'in_progress'].includes(t.status)
    );

    // Get tasks due soon (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const myUpcomingTasks = myTasks.filter(t => 
      t.due_date >= today && 
      t.due_date <= nextWeekStr && 
      ['todo', 'in_progress'].includes(t.status)
    );

    // Get user's milestones
    const myMilestones = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .where('milestones.owner_id', user_id)
      .orderBy('milestones.due_date', 'asc');

    // Get overdue milestones for this user
    const myOverdueMilestones = myMilestones.filter(m => 
      m.due_date < today && ['pending', 'in_progress'].includes(m.status)
    );

    // Get user's risks
    const myRisks = await db('risks')
      .select(
        'risks.*',
        'projects.name as project_name',
        'projects.client_name'
      )
      .leftJoin('projects', 'risks.project_id', 'projects.id')
      .where('risks.owner_id', user_id)
      .orderBy('risks.severity', 'desc');

    // Get open risks for this user
    const myOpenRisks = myRisks.filter(r => r.status === 'open');

    // Get projects where user is owner
    const myProjects = await db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as stage_name',
        'lifecycle_stages.display_order as stage_order'
      )
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .where('projects.owner_id', user_id)
      .orderBy('projects.updated_at', 'desc');

    const myWork = {
      tasks: {
        total: myTasks.length,
        by_status: {
          todo: myTasksByStatus.todo.length,
          in_progress: myTasksByStatus.in_progress.length,
          completed: myTasksByStatus.completed.length,
          blocked: myTasksByStatus.blocked.length
        },
        overdue: myOverdueTasks.length,
        upcoming: myUpcomingTasks.length,
        items: {
          all: myTasks,
          overdue: myOverdueTasks,
          upcoming: myUpcomingTasks
        }
      },
      milestones: {
        total: myMilestones.length,
        overdue: myOverdueMilestones.length,
        items: {
          all: myMilestones,
          overdue: myOverdueMilestones
        }
      },
      risks: {
        total: myRisks.length,
        open: myOpenRisks.length,
        items: {
          all: myRisks,
          open: myOpenRisks
        }
      },
      projects: {
        total: myProjects.length,
        items: myProjects
      }
    };

    res.json(myWork);
  } catch (error) {
    console.error('Error fetching user work:', error);
    res.status(500).json({ error: 'Failed to fetch user work' });
  }
});

// GET /api/dashboard/activity - Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50, project_id } = req.query;

    let query = db('activity_log')
      .select(
        'activity_log.*',
        'projects.name as project_name',
        'projects.client_name'
      )
      .leftJoin('projects', 'activity_log.project_id', 'projects.id')
      .orderBy('activity_log.created_at', 'desc')
      .limit(parseInt(limit));

    if (project_id) {
      query = query.where('activity_log.project_id', project_id);
    }

    const activities = await query;

    // Parse details JSON for each activity
    for (const activity of activities) {
      try {
        activity.details = JSON.parse(activity.details);
      } catch (e) {
        // Keep details as string if JSON parsing fails
      }
    }

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/dashboard/performance - Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to last 30 days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    const periodStart = daysAgo.toISOString().split('T')[0];

    // Get completed tasks in period
    const completedTasks = await db('tasks')
      .where('status', 'completed')
      .where('completion_date', '>=', periodStart)
      .count('* as count');

    // Get milestones completed in period
    const completedMilestones = await db('milestones')
      .where('status', 'completed')
      .where('completion_date', '>=', periodStart)
      .count('* as count');

    // Get risks resolved in period
    const resolvedRisks = await db('risks')
      .where('status', 'resolved')
      .where('actual_resolution_date', '>=', periodStart)
      .count('* as count');

    // Get projects that moved stages in period
    const stageTransitions = await db('activity_log')
      .where('action', 'stage_transition')
      .where('created_at', '>=', periodStart)
      .count('* as count');

    // Get average task completion time
    const avgCompletionTime = await db('tasks')
      .where('status', 'completed')
      .where('completion_date', '>=', periodStart)
      .avg('actual_hours as avg_hours');

    // Get completion rate by role
    const completionByRole = await db('tasks')
      .select(
        'users.role',
        db.raw('COUNT(*) as total_tasks'),
        db.raw('SUM(CASE WHEN tasks.status = "completed" THEN 1 ELSE 0 END) as completed_tasks')
      )
      .leftJoin('users', 'tasks.owner_id', 'users.id')
      .where('tasks.created_at', '>=', periodStart)
      .groupBy('users.role')
      .orderBy('completed_tasks', 'desc');

    // Calculate completion rates
    for (const role of completionByRole) {
      role.completion_rate = role.total_tasks > 0 
        ? ((role.completed_tasks / role.total_tasks) * 100).toFixed(2)
        : 0;
    }

    const performance = {
      period: `Last ${period} days`,
      achievements: {
        tasks_completed: parseInt(completedTasks[0].count),
        milestones_completed: parseInt(completedMilestones[0].count),
        risks_resolved: parseInt(resolvedRisks[0].count),
        stage_transitions: parseInt(stageTransitions[0].count)
      },
      metrics: {
        avg_task_completion_hours: parseFloat(avgCompletionTime[0].avg_hours || 0).toFixed(2),
        completion_by_role: completionByRole
      }
    };

    res.json(performance);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// GET /api/dashboard/audit-log — activity trail, Admin-only for wbs audit
// Params: limit, project_id, action, from, to, user_role, user_id, csm_id, pm_id, owner_id
router.get('/audit-log', async (req, res) => {
  try {
    const { limit = 200, project_id, action, from, to, user_role, user_id, csm_id, pm_id, owner_id } = req.query;

    // Audit trail is Admin-only — no other role gets access
    if (user_role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: audit trail is restricted to administrators' });
    }

    // Scope to projects visible to the requesting user
    let scopedProjectIds = null;
    if (user_role && user_role !== 'Admin') {
      let pq = db('projects').select('id');
      if (csm_id)        pq = pq.where('csm_id', csm_id);
      else if (pm_id)    pq = pq.where('pm_id', pm_id);
      else if (owner_id) pq = pq.where('owner_id', owner_id);
      else if (user_id)  pq = pq.where(function() {
        this.where('owner_id', user_id).orWhere('csm_id', user_id).orWhere('pm_id', user_id);
      });
      scopedProjectIds = (await pq).map(r => r.id);
    }

    let query = db('activity_log')
      .select(
        'activity_log.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.status as project_status'
      )
      .leftJoin('projects', 'activity_log.project_id', 'projects.id')
      .orderBy('activity_log.created_at', 'desc')
      .limit(parseInt(limit));

    if (scopedProjectIds) query = query.whereIn('activity_log.project_id', scopedProjectIds);
    if (project_id) query = query.where('activity_log.project_id', project_id);
    if (action)     query = query.where('activity_log.action', action);
    if (from)       query = query.where('activity_log.created_at', '>=', from);
    if (to)         query = query.where('activity_log.created_at', '<=', to + ' 23:59:59');

    const logs = await query;
    for (const log of logs) {
      try { log.details = JSON.parse(log.details); } catch { /* keep as string */ }
    }
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/dashboard/analytics — aggregated stats, role-scoped
// Params: period, user_role, user_id, csm_id, pm_id, owner_id,
//         status, priority, project_type, client, created_from, created_to, go_live_from, go_live_to
router.get('/analytics', async (req, res) => {
  try {
    const {
      period = '30', user_role, user_id, csm_id, pm_id, owner_id,
      status, priority, project_type, client,
      created_from, created_to, go_live_from, go_live_to,
    } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - (parseInt(period) || 30));
    const sinceStr = since.toISOString().split('T')[0];
    const today    = new Date().toISOString().split('T')[0];

    const EMPTY = {
      period: parseInt(period), scopedRole: user_role || 'Admin',
      projectsByStatus: [], tasksByStatus: [], wbsTasksByStatus: [],
      overdueTasks: 0, blockedTasks: 0, wbsOverdueCount: 0, wbsBlockedCount: 0, wbsBlockedTaskList: [], wbsOverdueTaskList: [],
      recentActivity: [], weeklyActivityTrend: [], milestoneStats: [],
      goLiveThisMonth: 0, activeProjects: 0, myTasksByStatus: [],
      byType: [], byPriority: [], upcomingGoLive: [], atRiskProjects: [],
      projectHealth: [], createdThisPeriod: 0, avgProjectAgeDays: 0, totalProjects: 0,
      stageVelocity: 0, topClients: [], csmWorkload: [], pmWorkload: [],
    };

    // ── Role-based scoping ────────────────────────────────────────────────────
    let scopedProjectIds = null;
    if (user_role && user_role !== 'Admin') {
      let pq = db('projects').select('id');
      if (csm_id)        pq = pq.where('csm_id', csm_id);
      else if (pm_id)    pq = pq.where('pm_id', pm_id);
      else if (owner_id) pq = pq.where('owner_id', owner_id);
      else if (user_id)  pq = pq.where(function () {
        this.where('owner_id', user_id).orWhere('csm_id', user_id).orWhere('pm_id', user_id);
      });
      scopedProjectIds = (await pq).map(r => r.id);
      if (scopedProjectIds.length === 0) return res.json(EMPTY);
    }

    // ── Additional dimension filters ──────────────────────────────────────────
    const hasExtraFilters = status || priority || project_type || client ||
      created_from || created_to || go_live_from || go_live_to;
    if (hasExtraFilters) {
      let fq = db('projects').select('id');
      if (scopedProjectIds !== null) fq = fq.whereIn('id', scopedProjectIds);
      if (status)       fq = fq.whereIn('status', String(status).split(',').filter(Boolean));
      if (priority)     fq = fq.whereIn('priority', String(priority).split(',').filter(Boolean));
      if (project_type) fq = fq.where('project_type', project_type);
      if (client)       fq = fq.whereRaw('LOWER(client_name) LIKE ?', [`%${String(client).toLowerCase()}%`]);
      if (created_from) fq = fq.where('created_at', '>=', created_from);
      if (created_to)   fq = fq.where('created_at', '<=', created_to + ' 23:59:59');
      if (go_live_from) fq = fq.where('go_live_deadline', '>=', go_live_from);
      if (go_live_to)   fq = fq.where('go_live_deadline', '<=', go_live_to);
      scopedProjectIds = (await fq).map(r => r.id);
      if (scopedProjectIds.length === 0) return res.json(EMPTY);
    }

    const applyScope = (q, col = 'project_id') =>
      scopedProjectIds ? q.whereIn(col, scopedProjectIds) : q;

    // ── Fetch all scoped projects with WBS plans ───────────────────────────────
    let projectsQ = db('projects').select(
      'id', 'name', 'client_name', 'status', 'go_live_deadline',
      'priority', 'project_type', 'project_plan', 'created_at',
      'project_start_date', 'csm_id', 'pm_id', 'owner_id'
    );
    if (scopedProjectIds) projectsQ = projectsQ.whereIn('id', scopedProjectIds);
    const allProjects = await projectsQ;

    // ── Parse WBS tasks from project_plan JSON ─────────────────────────────────
    const wbsStatusMap = {};
    const projectWbsStats = {};
    const wbsBlockedTaskList = [];
    const wbsOverdueTaskList = [];
    for (const p of allProjects) {
      if (!p.project_plan) continue;
      try {
        const plan = JSON.parse(p.project_plan);
        let total = 0, done = 0, inProgress = 0, blocked = 0, overdue = 0;
        for (const task of plan) {
          if (['Phase', 'Summary'].includes(task.type || '')) continue;
          total++;
          const st = task.status || 'not_started';
          wbsStatusMap[st] = (wbsStatusMap[st] || 0) + 1;
          if (st === 'completed')   done++;
          if (st === 'in_progress') inProgress++;
          if (st === 'blocked') {
            blocked++;
            wbsBlockedTaskList.push({
              projectId: p.id, projectName: p.name, clientName: p.client_name,
              taskName: task.name || '(unnamed)', wbs: task.wbs || '',
              ownerRole: task.owner_role || task.assigned_to || '',
              plannedEnd: (task.planned_end || '').split('T')[0].split(' ')[0] || null,
            });
          }
          const taskEnd = (task.planned_end || '').split('T')[0].split(' ')[0];
          if (taskEnd && taskEnd < today && st !== 'completed') {
            overdue++;
            wbsOverdueTaskList.push({
              projectId: p.id, projectName: p.name, clientName: p.client_name,
              taskName: task.name || '(unnamed)', wbs: task.wbs || '',
              ownerRole: task.owner_role || task.assigned_to || '',
              plannedEnd: taskEnd,
              status: st,
            });
          }
        }
        projectWbsStats[p.id] = {
          total, done, inProgress, blocked, overdue,
          name: p.name, client_name: p.client_name, status: p.status,
          go_live_deadline: p.go_live_deadline, priority: p.priority,
          pct: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      } catch { /* skip malformed */ }
    }

    const wbsTasksByStatus = Object.entries(wbsStatusMap)
      .map(([status, count]) => ({ status, count }));
    const wbsOverdueCount = Object.values(projectWbsStats).reduce((s, p) => s + p.overdue, 0);
    const wbsBlockedCount = Object.values(projectWbsStats).reduce((s, p) => s + p.blocked, 0);

    // At-risk projects (most overdue + blocked)
    const atRiskProjects = Object.entries(projectWbsStats)
      .filter(([, s]) => s.overdue > 0 || s.blocked > 0)
      .sort(([, a], [, b]) => (b.overdue + b.blocked * 2) - (a.overdue + a.blocked * 2))
      .slice(0, 8)
      .map(([id, s]) => ({ id: parseInt(id), ...s }));

    // Project completion health: top 10 by completion %
    const projectHealth = Object.entries(projectWbsStats)
      .filter(([, s]) => s.total > 0 && ['ACTIVE', 'APPROVED'].includes(s.status))
      .sort(([, a], [, b]) => b.pct - a.pct)
      .slice(0, 10)
      .map(([id, s]) => ({ id: parseInt(id), ...s }));

    // ── Upcoming Go-Live (next 45 days) ─────────────────────────────────────────
    const in45 = new Date(); in45.setDate(in45.getDate() + 45);
    let glQ = db('projects')
      .select('id', 'name', 'client_name', 'status', 'go_live_deadline', 'priority')
      .whereNotNull('go_live_deadline')
      .where('go_live_deadline', '>=', today)
      .where('go_live_deadline', '<=', in45.toISOString().split('T')[0])
      .orderBy('go_live_deadline', 'asc').limit(10);
    if (scopedProjectIds) glQ = glQ.whereIn('id', scopedProjectIds);
    const upcomingGoLive = await glQ;

    // ── Weekly activity trend (last 8 weeks) ────────────────────────────────────
    const since8w = new Date(); since8w.setDate(since8w.getDate() - 57);
    let dailyAcQ = db('activity_log')
      .select(db.raw("substr(created_at, 1, 10) as day"), db.raw('COUNT(*) as cnt'))
      .where('created_at', '>=', since8w.toISOString().split('T')[0])
      .groupByRaw("substr(created_at, 1, 10)")
      .orderBy('day');
    if (scopedProjectIds) dailyAcQ = dailyAcQ.whereIn('project_id', scopedProjectIds);
    const dailyActivity = await dailyAcQ;

    const weeklyActivityTrend = Array.from({ length: 8 }, (_, i) => {
      const wEnd   = new Date(); wEnd.setDate(wEnd.getDate() - i * 7);
      const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 7);
      const startStr = wStart.toISOString().split('T')[0];
      const endStr   = wEnd.toISOString().split('T')[0];
      const count = dailyActivity
        .filter(d => d.day >= startStr && d.day < endStr)
        .reduce((s, d) => s + Number(d.cnt), 0);
      const label = wEnd.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      return { week: startStr, label, count };
    }).reverse();

    // ── Standard SQL aggregations ────────────────────────────────────────────────
    const [
      projectsByStatus,
      tasksByStatus,
      overdueTasksRaw,
      recentActivity,
      milestoneStats,
      goLiveRaw,
      activeProjectsRaw,
      blockedTasksRaw,
      myTasksRaw,
      byTypeRaw,
      byPriorityRaw,
      createdRaw,
      topClientsRaw,
      stageVelocityRaw,
      csmWorkloadRaw,
      pmWorkloadRaw,
    ] = await Promise.all([
      (() => {
        let q = db('projects').select('status', db.raw('COUNT(*) as count')).groupBy('status');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      applyScope(db('tasks').select('status', db.raw('COUNT(*) as count')).groupBy('status')),
      applyScope(db('tasks').where('status', '!=', 'completed').whereNotNull('due_date').where('due_date', '<', today).count('* as count')),
      applyScope(db('activity_log').select('action', db.raw('COUNT(*) as count')).where('created_at', '>=', sinceStr).groupBy('action').orderBy('count', 'desc').limit(12)),
      applyScope(db('milestones').select('status', db.raw('COUNT(*) as count')).groupBy('status')),
      (() => {
        const ms = new Date(); ms.setDate(1);
        const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
        let q = db('projects').whereNotNull('go_live_deadline')
          .where('go_live_deadline', '>=', ms.toISOString().split('T')[0])
          .where('go_live_deadline', '<=', me.toISOString().split('T')[0])
          .count('* as count');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      (() => {
        let q = db('projects').whereIn('status', ['ACTIVE', 'APPROVED']).count('* as count');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      applyScope(db('tasks').where('status', 'blocked').count('* as count')),
      user_id && user_role !== 'Admin'
        ? db('tasks').where('owner_id', user_id).select('status', db.raw('COUNT(*) as count')).groupBy('status')
        : Promise.resolve([]),
      (() => {
        let q = db('projects').select('project_type', db.raw('COUNT(*) as count')).whereNotNull('project_type').groupBy('project_type');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      (() => {
        let q = db('projects').whereNotNull('priority').whereNot('priority', '').select('priority', db.raw('COUNT(*) as count')).groupBy('priority');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      (() => {
        let q = db('projects').where('created_at', '>=', sinceStr).count('* as count');
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      // Top clients by project count
      (() => {
        let q = db('projects').whereNotNull('client_name').whereNot('client_name', '')
          .select('client_name', db.raw('COUNT(*) as count')).groupBy('client_name').orderBy('count', 'desc').limit(8);
        if (scopedProjectIds) q = q.whereIn('id', scopedProjectIds);
        return q;
      })(),
      // Stage velocity — transitions in the period
      applyScope(
        db('activity_log').select('action', db.raw('COUNT(*) as count'))
          .where('action', 'stage_transition').where('created_at', '>=', sinceStr)
          .count('* as count')
      ),
      // CSM workload (admin-level view)
      (() => {
        let q = db('projects').whereNotNull('projects.csm_id')
          .leftJoin('users as csm', 'projects.csm_id', 'csm.id')
          .select(
            'csm.name as name',
            db.raw('COUNT(projects.id) as total'),
            db.raw('SUM(CASE WHEN projects.status IN ("ACTIVE","APPROVED") THEN 1 ELSE 0 END) as active_count')
          )
          .groupBy('csm.name').orderBy('total', 'desc').limit(10);
        if (scopedProjectIds) q = q.whereIn('projects.id', scopedProjectIds);
        return q;
      })(),
      // PM workload (admin-level view)
      (() => {
        let q = db('projects').whereNotNull('projects.pm_id')
          .leftJoin('users as pm', 'projects.pm_id', 'pm.id')
          .select(
            'pm.name as name',
            db.raw('COUNT(projects.id) as total'),
            db.raw('SUM(CASE WHEN projects.status IN ("ACTIVE","APPROVED") THEN 1 ELSE 0 END) as active_count')
          )
          .groupBy('pm.name').orderBy('total', 'desc').limit(10);
        if (scopedProjectIds) q = q.whereIn('projects.id', scopedProjectIds);
        return q;
      })(),
    ]);

    // ── Average age of active/approved projects ──────────────────────────────────
    const activeProjs = allProjects.filter(p => ['ACTIVE', 'APPROVED'].includes(p.status));
    const avgProjectAgeDays = activeProjs.length > 0
      ? Math.round(activeProjs.reduce((s, p) => {
          const raw = new Date(p.created_at).toISOString().split('T')[0];
          const d = new Date(raw + 'T00:00:00');
          return s + (Date.now() - d.getTime()) / 86400000;
        }, 0) / activeProjs.length)
      : 0;

    res.json({
      period:            parseInt(period),
      scopedRole:        user_role || 'Admin',
      totalProjects:     allProjects.length,
      projectsByStatus,
      tasksByStatus,
      wbsTasksByStatus,
      wbsOverdueCount,
      wbsBlockedCount,
      wbsBlockedTaskList,
      wbsOverdueTaskList,
      overdueTasks:      Number(overdueTasksRaw[0]?.count || 0),
      blockedTasks:      Number(blockedTasksRaw[0]?.count || 0),
      recentActivity,
      weeklyActivityTrend,
      milestoneStats,
      goLiveThisMonth:   Number(goLiveRaw[0]?.count || 0),
      activeProjects:    Number(activeProjectsRaw[0]?.count || 0),
      myTasksByStatus:   myTasksRaw,
      byType:            byTypeRaw,
      byPriority:        byPriorityRaw,
      upcomingGoLive,
      atRiskProjects,
      projectHealth,
      createdThisPeriod: Number(createdRaw[0]?.count || 0),
      avgProjectAgeDays,
      topClients:        topClientsRaw,
      stageVelocity:     Number(stageVelocityRaw[0]?.count || 0),
      csmWorkload:       csmWorkloadRaw,
      pmWorkload:        pmWorkloadRaw,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
