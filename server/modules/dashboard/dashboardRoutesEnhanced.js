const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const SLAEngine = require('../sla/SLAEngine');
const LifecycleEngine = require('../lifecycle/LifecycleEngineEnhanced');

/**
 * Enhanced Dashboard API Routes
 * Base: /api/dashboard
 */

// GET /api/dashboard/overview - Get comprehensive dashboard overview with enhanced metrics
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
      changeCount,
      knowledgeAssetCount
    ] = await Promise.all([
      db('projects').count('* as count'),
      db('projects').where('status', 'active').count('* as count'),
      db('tasks').count('* as count'),
      db('milestones').count('* as count'),
      db('risks').count('* as count'),
      db('changes').count('* as count'),
      db('knowledge_assets').count('* as count')
    ]);

    // Get stage distribution with enhanced info
    const stageDistribution = await db('projects')
      .select(
        'lifecycle_stages.name as stage_name',
        'lifecycle_stages.display_order',
        db.raw('COUNT(*) as count'),
        db.raw('AVG(EXTRACT(EPOCH FROM (CURRENT_DATE - projects.created_at))/86400) as avg_days_in_stage')
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .groupBy('lifecycle_stages.name', 'lifecycle_stages.display_order')
      .orderBy('lifecycle_stages.display_order', 'asc');

    // Get risk severity distribution with scores
    const riskDistribution = await db('risks')
      .select('severity', db.raw('COUNT(*) as count'), db.raw('SUM(risk_score) as total_score'))
      .groupBy('severity')
      .orderBy('severity', 'asc');

    // Get task status distribution with SLA info
    const taskStatusDistribution = await db('tasks')
      .select('status', db.raw('COUNT(*) as count'))
      .groupBy('status')
      .orderBy('count', 'desc');

    // Get SLA metrics
    const slaMetrics = await db('tasks')
      .where('sla_hours', '>', 0)
      .select(
        db.raw('COUNT(*) as total_tracked'),
        db.raw('COUNT(CASE WHEN sla_breached = true THEN 1 ELSE 0 END) as breached'),
        db.raw('AVG(CASE WHEN sla_breached = true THEN EXTRACT(EPOCH FROM (due_date - sla_start_time))/3600 ELSE NULL END) as avg_hours_overdue')
      );

    const overview = {
      summary: {
        total_projects: parseInt(projectCount[0].count),
        active_projects: parseInt(activeProjectCount[0].count),
        total_tasks: parseInt(taskCount[0].count),
        total_milestones: parseInt(milestoneCount[0].count),
        total_risks: parseInt(riskCount[0].count),
        total_changes: parseInt(changeCount[0].count),
        total_knowledge_assets: parseInt(knowledgeAssetCount[0].count)
      },
      distributions: {
        by_stage: stageDistribution,
        by_risk_severity: riskDistribution,
        by_task_status: taskStatusDistribution,
        by_sla: slaMetrics[0] || { total_tracked: 0, breached: 0, avg_hours_overdue: 0 }
      }
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// GET /api/dashboard/issues - Get comprehensive issues with enhanced analysis
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

    // Get overdue tasks with SLA analysis
    const overdueTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.manager_id',
        'manager.name as manager_name',
        'manager.email as manager_email',
        db.raw('EXTRACT(EPOCH FROM (tasks.due_date - tasks.sla_start_time)) / 3600 as hours_overdue'),
        db.raw(`
          CASE 
            WHEN tasks.sla_hours > 0 THEN 
              CASE 
                WHEN tasks.sla_breached = true THEN 'breached'
                WHEN tasks.sla_paused = true THEN 'paused'
                WHEN tasks.status = 'completed' THEN 'completed'
                ELSE 'active'
              END
            ELSE 'no_sla'
          END as sla_status
        `),
        db.raw(`
          CASE 
            WHEN tasks.sla_hours > 0 AND tasks.sla_breached = true THEN 
              EXTRACT(EPOCH FROM (CURRENT_DATE - tasks.due_date)) / 86400
            ELSE NULL
          END as days_overdue
        `)
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .leftJoin('users as manager', 'users.manager_id', 'manager.id')
      .where('tasks.due_date', '<', today)
      .where('tasks.status', 'in', ['todo', 'in_progress', 'at_risk'])
      .orderBy('tasks.hours_overdue', 'desc');

    // Categorize overdue tasks by severity
    for (const task of overdueTasks) {
      task.severity = task.hours_overdue > 72 ? 'critical' : (task.hours_overdue > 24 ? 'high' : 'medium');
      task.needs_escalation = task.hours_overdue > 48;
    }

    // Get blocked milestones with blocking analysis
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
      milestone.days_overdue = Math.floor((todayDate - dueDate) / (1000 * 60 * 24));
    }

    // Get pending handovers with analysis
    const pendingHandovers = await db('handover_notes')
      .select(
        'handover_notes.*',
        'projects.name as project_name',
        'projects.client_name',
        'lifecycle_stages.name as project_stage',
        'from_user.name as from_user_name',
        'from_user.email as from_user_email',
        'to_user.name as to_user_name',
        'to_user.email as to_user_email'
      )
      .leftJoin('projects', 'handover_notes.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as from_user', 'handover_notes.from_role', 'from_user.role')
      .leftJoin('users as to_user', 'handover_notes.to_role', 'to_user.role')
      .where('handover_notes.checklist_completed', false)
      .orWhere('handover_notes.approved_by', null)
      .orderBy('handover_notes.created_at', 'asc');

    // Categorize pending handovers
    const categorized = {
      needs_checklist: pendingHandovers.filter(h => !h.checklist_completed),
      needs_approval: pendingHandovers.filter(h => h.checklist_completed && !h.approved_by)
    };

    // Get critical risks with escalation info
    const criticalRisks = await db('risks')
      .select(
        'risks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.manager_id',
        'manager.name as manager_name',
        'manager.email as manager_email',
        db.raw('EXTRACT(EPOCH FROM (CURRENT_DATE - risks.identified_date)) / 86400 as days_open')
      )
      .leftJoin('projects', 'risks.project_id', 'projects.id')
      .leftJoin('users as owner', 'risks.owner_id', 'owner.id')
      .leftJoin('users as manager', 'users.manager_id', 'manager.id')
      .where('risks.severity', 'critical')
      .where('risks.status', 'open')
      .orderBy('risks.identified_date', 'desc');

    // Add escalation recommendations
    for (const risk of criticalRisks) {
      risk.escalation_level = risk.days_open > 7 ? 'project_owner' : 'owner';
      risk.needs_immediate_escalation = risk.days_open > 3;
    }

    // Get projects stuck in current stage
    const stuckProjects = await LifecycleEngine.getStuckProjects(14);

    const issues = {
      orphaned_tasks: {
        count: orphanedTasks.length,
        items: orphanedTasks,
        severity: orphanedTasks.length > 0 ? 'critical' : 'none'
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
        needs_checklist_count: categorized.needs_checklist.length,
        needs_approval_count: categorized.needs_approval.length,
        items: pendingHandovers,
        severity: pendingHandovers.length > 0 ? 'medium' : 'none'
      },
      critical_risks: {
        count: criticalRisks.length,
        items: criticalRisks,
        severity: criticalRisks.length > 0 ? 'critical' : 'none'
      },
      stuck_projects: {
        count: stuckProjects.length,
        items: stuckProjects,
        severity: stuckProjects.length > 0 ? 'high' : 'none'
      },
      total_issues: orphanedTasks.length + overdueTasks.length + blockedMilestones.length + overdueMilestones.length + pendingHandovers.length + criticalRisks.length
    };

    res.json(issues);
  } catch (error) {
    console.error('Error fetching dashboard issues:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard issues' });
  }
});

// GET /api/dashboard/my-work - Get user-specific work with enhanced analytics
router.get('/my-work', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get user's tasks with SLA status
    const myTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'milestones.name as milestone_name',
        'accountable.name as accountable_name',
        'accountable.email as accountable_email',
        db.raw(`
          CASE 
            WHEN tasks.sla_hours > 0 THEN 
              CASE 
                WHEN tasks.sla_breached = true THEN 'breached'
                WHEN tasks.sla_paused = true THEN 'paused'
                WHEN tasks.status = 'completed' THEN 'completed'
                ELSE 'active'
              END
            ELSE 'no_sla'
          END as sla_status
        `),
        db.raw('EXTRACT(EPOCH FROM (tasks.due_date - tasks.sla_start_time)) / 3600 as hours_overdue')
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('milestones', 'tasks.milestone_id', 'milestones.id')
      .leftJoin('users as accountable', 'tasks.accountable_id', 'accountable.id')
      .where('tasks.owner_id', user_id)
      .orderBy('tasks.due_date', 'asc');

    // Categorize tasks and calculate SLA metrics
    const myTasksByStatus = {
      todo: [],
      in_progress: [],
      completed: [],
      blocked: [],
      at_risk: [],
      reopened: []
    };

    let slaMetrics = {
      total_tracked: 0,
      breached: 0,
      avg_completion_hours: 0,
      breach_rate: 0
    };

    for (const task of myTasks) {
      const status = task.status;
      if (myTasksByStatus[status]) {
        myTasksByStatus[status].push(task);
      }

      // SLA calculations
      if (task.sla_hours > 0) {
        slaMetrics.total_tracked++;
        if (task.sla_status === 'breached') {
          slaMetrics.breached++;
        }
        
        if (task.status === 'completed' && task.actual_hours) {
          slaMetrics.avg_completion_hours += task.actual_hours;
        }
      }
    }

    slaMetrics.breach_rate = slaMetrics.total_tracked > 0 ? (slaMetrics.breached / slaMetrics.total_tracked) * 100 : 0;

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

    // Get user's SLA performance
    const slaPerformance = await SLAEngine.getUserSLAPerformance(user_id, 30);

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
        by_status: myTasksByStatus,
        sla_metrics: slaMetrics,
        overdue: myTasks.filter(t => t.sla_status === 'breached'),
        items: {
          all: myTasks,
          overdue: myTasks.filter(t => t.sla_status === 'breached')
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
      },
      sla_performance: slaPerformance
    };

    res.json(myWork);
  } catch (error) {
    console.error('Error fetching user work:', error);
    res.status(500).json({ error: 'Failed to fetch user work' });
  }
});

// GET /api/dashboard/performance - Get enhanced performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { period = 30, user_id } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    const periodStart = daysAgo.toISOString().split('T')[0];

    // Get completed tasks in period with SLA analysis
    const completedTasksWithSLA = await db('tasks')
      .where('status', 'completed')
      .where('completion_date', '>=', periodStart)
      .where('sla_hours', '>', 0)
      .select(
        'actual_hours',
        'sla_hours',
        db.raw('EXTRACT(EPOCH FROM (completion_date - sla_start_time)) / 3600 as duration_hours'),
        db.raw('CASE WHEN sla_breached = true THEN 1 ELSE 0 END as was_breached')
      )
      .orderBy('completion_date', 'desc');

    // Calculate performance metrics
    const totalCompleted = completedTasksWithSLA.length;
    const breachedCount = completedTasksWithSLA.filter(t => t.was_breached).length;
    const totalDuration = completedTasksWithSLA.reduce((sum, task) => sum + (task.duration_hours || 0), 0);
    const avgDuration = totalCompleted > 0 ? totalDuration / totalCompleted : 0;

    // Get completion rate by role
    const completionByRole = await db('tasks')
      .select(
        'users.role',
        db.raw('COUNT(*) as total_tasks'),
        db.raw('COUNT(CASE WHEN tasks.status = "completed" THEN 1 ELSE 0 END) as completed_tasks'),
        db.raw('COUNT(CASE WHEN tasks.sla_hours > 0 AND tasks.sla_breached = false THEN 1 ELSE 0 END) as completed_within_sla')
      )
      .leftJoin('users', 'tasks.owner_id', 'users.id')
      .where('tasks.created_at', '>=', periodStart)
      .where('tasks.status', 'completed')
      .groupBy('users.role')
      .orderBy('completed_tasks', 'desc');

    // Calculate completion rates
    for (const role of completionByRole) {
      role.sla_compliance_rate = role.total_tasks > 0 ? ((role.completed_within_sla / role.total_tasks) * 100).toFixed(2) : '0.00';
      role.overall_completion_rate = role.total_tasks > 0 ? ((role.completed_tasks / role.total_tasks) * 100).toFixed(2) : '0.00';
    }

    // Get user performance if specified
    let userPerformance = null;
    if (user_id) {
      userPerformance = await SLAEngine.getUserSLAPerformance(user_id, parseInt(period));
    }

    const performance = {
      period: `Last ${period} days`,
      task_completion: {
        total_completed: totalCompleted,
        sla_breached: breachedCount,
        sla_compliance_rate: totalCompleted > 0 ? (((totalCompleted - breachedCount) / totalCompleted) * 100).toFixed(2) : '0.00',
        avg_duration_hours: avgDuration.toFixed(2)
      },
      completion_by_role: completionByRole,
      user_performance: userPerformance
    };

    res.json(performance);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// GET /api/dashboard/escalations - Get escalation dashboard
router.get('/escalations', async (req, res) => {
  try {
    const { severity = 'critical' } = req.query;

    // Get tasks needing escalation
    const slaBreaches = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.manager_id',
        'manager.name as manager_name',
        'manager.email as manager_email',
        db.raw('EXTRACT(EPOCH FROM (CURRENT_DATE - tasks.due_date)) / 86400 as days_overdue')
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .leftJoin('users as manager', 'users.manager_id', 'manager.id')
      .where('tasks.sla_breached', true)
      .whereRaw('EXTRACT(EPOCH FROM (CURRENT_DATE - tasks.due_date)) / 86400 > ?', [severity === 'critical' ? 3 : 7]) // Critical: >3 days, High: >7 days
      .orderBy('tasks.days_overdue', 'desc');

    // Add escalation recommendations
    for (const task of slaBreaches) {
      task.escalation_level = task.days_overdue > 7 ? 'project_owner' : 'manager';
      task.needs_immediate_escalation = task.days_overdue > 3;
      task.escalation_recommended = true;
    }

    // Get critical risks needing escalation
    const criticalRisks = await db('risks')
      .select(
        'risks.*',
        'projects.name as project_name',
        'owner.name as owner_name',
        db.raw('EXTRACT(EPOCH FROM (CURRENT_DATE - risks.identified_date)) / 86400 as days_open')
      )
      .leftJoin('projects', 'risks.project_id', 'projects.id')
      .leftJoin('users as owner', 'risks.owner_id', 'owner.id')
      .where('severity', severity)
      .where('status', 'open')
      .orderBy('risks.identified_date', 'desc');

    // Add escalation recommendations for risks
    for (const risk of criticalRisks) {
      risk.escalation_level = risk.days_open > 7 ? 'project_owner' : 'owner';
      risk.needs_immediate_escalation = risk.days_open > 3;
    }

    const escalations = {
      sla_breaches: {
        count: slaBreaches.length,
        items: slaBreaches,
        severity: slaBreaches.length > 0 ? 'critical' : 'high'
      },
      critical_risks: {
        count: criticalRisks.length,
        items: criticalRisks,
        severity: criticalRisks.length > 0 ? 'critical' : 'high'
      },
      total_escalations: slaBreaches.length + criticalRisks.length
    };

    res.json(escalations);
  } catch (error) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

module.exports = router;
