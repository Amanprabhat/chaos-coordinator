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

module.exports = router;
