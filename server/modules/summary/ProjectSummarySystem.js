const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Project Summary Snapshot System
 * Single snapshot view of project status for quick overview
 */
class ProjectSummarySystem {
  /**
   * Generate project summary snapshot
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID generating the summary
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Project summary
   */
  static async generateProjectSummary(projectId, userId, options = {}) {
    try {
      const { auto_generated = false } = options;

      // Validate project exists
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order',
          'users.name as owner_name',
          'users.email as owner_email',
          'users.role as owner_role'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      // Get project metrics
      const metrics = await this.getProjectMetrics(projectId);

      // Get key blockers
      const keyBlockers = await this.getKeyBlockers(projectId);

      // Get next steps
      const nextSteps = await this.getNextSteps(projectId);

      // Get critical decisions
      const criticalDecisions = await this.getCriticalDecisions(projectId);

      // Get upcoming deadlines
      const upcomingDeadlines = await this.getUpcomingDeadlines(projectId);

      // Get team performance summary
      const teamPerformance = await this.getTeamPerformanceSummary(projectId);

      // Get risk summary
      const riskSummary = await this.getRiskSummary(projectId);

      // Determine current status
      const currentStatus = this.determineCurrentStatus(metrics, keyBlockers, riskSummary);

      // Create or update project summary
      const [summary] = await db('project_summary')
        .insert({
          project_id: projectId,
          current_status: currentStatus.status,
          key_blockers: keyBlockers.map(b => b.description),
          next_steps: nextSteps.map(s => s.description),
          critical_decisions: criticalDecisions.map(d => d.title),
          upcoming_deadlines: upcomingDeadlines.map(d => `${d.title} - ${d.due_date}`),
          team_performance_summary: teamPerformance,
          risk_summary: riskSummary,
          last_updated_by: userId,
          last_updated_at: new Date(),
          auto_generated,
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict('project_id')
        .merge({
          current_status: currentStatus.status,
          key_blockers: keyBlockers.map(b => b.description),
          next_steps: nextSteps.map(s => s.description),
          critical_decisions: criticalDecisions.map(d => d.title),
          upcoming_deadlines: upcomingDeadlines.map(d => `${d.title} - ${d.due_date}`),
          team_performance_summary: teamPerformance,
          risk_summary: riskSummary,
          last_updated_by: userId,
          last_updated_at: new Date(),
          auto_generated,
          updated_at: new Date()
        })
        .returning('*');

      return {
        project: {
          id: project.id,
          name: project.name,
          client_name: project.client_name,
          current_stage: project.current_stage,
          owner: project.owner_name
        },
        summary: {
          current_status: currentStatus,
          metrics: metrics,
          key_blockers: keyBlockers,
          next_steps: nextSteps,
          critical_decisions: criticalDecisions,
          upcoming_deadlines: upcomingDeadlines,
          team_performance: teamPerformance,
          risk_summary: riskSummary
        },
        metadata: {
          generated_by: userId,
          generated_at: summary.last_updated_at,
          auto_generated: auto_generated
        }
      };
    } catch (error) {
      throw new Error(`Error generating project summary: ${error.message}`);
    }
  }

  /**
   * Get project summary snapshot
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Project summary
   */
  static async getProjectSummary(projectId) {
    try {
      const summary = await db('project_summary')
        .select(
          'project_summary.*',
          'projects.name as project_name',
          'projects.client_name',
          'projects.current_stage_id',
          'lifecycle_stages.name as current_stage',
          'users.name as last_updated_by_name',
          'users.email as last_updated_by_email'
        )
        .join('projects', 'project_summary.project_id', 'projects.id')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'project_summary.last_updated_by', 'users.id')
        .where('project_summary.project_id', projectId)
        .first();

      if (!summary) {
        throw new ValidationError('Project summary not found');
      }

      return summary;
    } catch (error) {
      throw new Error(`Error getting project summary: ${error.message}`);
    }
  }

  /**
   * Get project metrics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Project metrics
   */
  static async getProjectMetrics(projectId) {
    try {
      // Get task metrics
      const taskMetrics = await db('tasks')
        .select(
          db.raw('COUNT(*) as total_tasks'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_tasks'),
          db.raw('COUNT(CASE WHEN status = \'in_progress\' THEN 1 END) as in_progress_tasks'),
          db.raw('COUNT(CASE WHEN status = \'todo\' THEN 1 END) as todo_tasks'),
          db.raw('COUNT(CASE WHEN due_date < CURRENT_DATE AND status IN (\'todo\', \'in_progress\') THEN 1 END) as overdue_tasks'),
          db.raw('COUNT(CASE WHEN sla_breached = true THEN 1 END) as sla_breached_tasks')
        )
        .where('project_id', projectId)
        .first();

      // Get milestone metrics
      const milestoneMetrics = await db('milestones')
        .select(
          db.raw('COUNT(*) as total_milestones'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_milestones'),
          db.raw('COUNT(CASE WHEN status = \'in_progress\' THEN 1 END) as in_progress_milestones'),
          db.raw('COUNT(CASE WHEN due_date < CURRENT_DATE AND status IN (\'pending\', \'in_progress\') THEN 1 END) as overdue_milestones')
        )
        .where('project_id', projectId)
        .first();

      // Get risk metrics
      const riskMetrics = await db('risks')
        .select(
          db.raw('COUNT(*) as total_risks'),
          db.raw('COUNT(CASE WHEN severity = \'critical\' THEN 1 END) as critical_risks'),
          db.raw('COUNT(CASE WHEN status = \'open\' THEN 1 END) as open_risks'),
          db.raw('COUNT(CASE WHEN status = \'resolved\' THEN 1 END) as resolved_risks')
        )
        .where('project_id', projectId)
        .first();

      // Calculate completion percentages
      const taskCompletionRate = taskMetrics.total_tasks > 0 ? 
        (taskMetrics.completed_tasks / taskMetrics.total_tasks) * 100 : 0;
      const milestoneCompletionRate = milestoneMetrics.total_milestones > 0 ? 
        (milestoneMetrics.completed_milestones / milestoneMetrics.total_milestones) * 100 : 0;

      return {
        tasks: {
          ...taskMetrics,
          completion_rate: parseFloat(taskCompletionRate.toFixed(2))
        },
        milestones: {
          ...milestoneMetrics,
          completion_rate: parseFloat(milestoneCompletionRate.toFixed(2))
        },
        risks: riskMetrics,
        overall_health: this.calculateOverallHealth(taskMetrics, milestoneMetrics, riskMetrics)
      };
    } catch (error) {
      throw new Error(`Error getting project metrics: ${error.message}`);
    }
  }

  /**
   * Get key blockers
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Key blockers
   */
  static async getKeyBlockers(projectId) {
    try {
      const blockers = [];

      // Check for overdue tasks
      const overdueTasks = await db('tasks')
        .select('title', 'description', 'due_date', 'delay_reason', 'delay_impact_hours')
        .where('project_id', projectId)
        .where('due_date', '<', new Date().toISOString().split('T')[0])
        .where('status', 'in', ['todo', 'in_progress'])
        .orderBy('delay_impact_hours', 'desc')
        .limit(5);

      overdueTasks.forEach(task => {
        blockers.push({
          type: 'overdue_task',
          title: `Overdue Task: ${task.title}`,
          description: task.delay_reason || `Task is ${Math.floor((new Date() - new Date(task.due_date)) / (1000 * 60 * 60))} hours overdue`,
          severity: task.delay_impact_hours > 48 ? 'critical' : task.delay_impact_hours > 24 ? 'high' : 'medium',
          impact_hours: task.delay_impact_hours
        });
      });

      // Check for blocked milestones
      const blockedMilestones = await db('milestones')
        .select('title', 'description', 'due_date')
        .where('project_id', projectId)
        .where('status', 'blocked')
        .orderBy('due_date', 'ASC')
        .limit(3);

      blockedMilestones.forEach(milestone => {
        blockers.push({
          type: 'blocked_milestone',
          title: `Blocked Milestone: ${milestone.title}`,
          description: milestone.description || 'Milestone is blocked and needs attention',
          severity: 'high',
          impact_hours: 0
        });
      });

      // Check for critical risks
      const criticalRisks = await db('risks')
        .select('title', 'description', 'severity')
        .where('project_id', projectId)
        .where('severity', 'critical')
        .where('status', 'open')
        .orderBy('identified_date', 'DESC')
        .limit(3);

      criticalRisks.forEach(risk => {
        blockers.push({
          type: 'critical_risk',
          title: `Critical Risk: ${risk.title}`,
          description: risk.description || 'Critical risk requires immediate attention',
          severity: 'critical',
          impact_hours: 0
        });
      });

      // Check for unassigned tasks
      const unassignedTasks = await db('tasks')
        .count('* as count')
        .where('project_id', projectId)
        .whereNull('owner_id')
        .first();

      if (unassignedTasks.count > 0) {
        blockers.push({
          type: 'unassigned_tasks',
          title: 'Unassigned Tasks',
          description: `${unassignedTasks.count} tasks without owners`,
          severity: unassignedTasks.count > 5 ? 'high' : 'medium',
          impact_hours: 0
        });
      }

      return blockers.sort((a, b) => {
        const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      throw new Error(`Error getting key blockers: ${error.message}`);
    }
  }

  /**
   * Get next steps
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Next steps
   */
  static async getNextSteps(projectId) {
    try {
      const nextSteps = [];

      // Get upcoming tasks
      const upcomingTasks = await db('tasks')
        .select('title', 'description', 'due_date', 'owner_id', 'users.name as owner_name')
        .join('users', 'tasks.owner_id', 'users.id')
        .where('project_id', projectId)
        .where('status', 'in', ['todo', 'in_progress'])
        .where('due_date', '>=', new Date().toISOString().split('T')[0])
        .orderBy('due_date', 'ASC')
        .limit(5);

      upcomingTasks.forEach(task => {
        nextSteps.push({
          type: 'upcoming_task',
          title: `Task: ${task.title}`,
          description: `Due on ${task.due_date} - Assigned to ${task.owner_name}`,
          priority: this.getTaskPriority(task),
          due_date: task.due_date,
          owner: task.owner_name
        });
      });

      // Get upcoming milestones
      const upcomingMilestones = await db('milestones')
        .select('title', 'description', 'due_date', 'owner_id', 'users.name as owner_name')
        .join('users', 'milestones.owner_id', 'users.id')
        .where('project_id', projectId)
        .where('status', 'in', ['pending', 'in_progress'])
        .where('due_date', '>=', new Date().toISOString().split('T')[0])
        .orderBy('due_date', 'ASC')
        .limit(3);

      upcomingMilestones.forEach(milestone => {
        nextSteps.push({
          type: 'upcoming_milestone',
          title: `Milestone: ${milestone.title}`,
          description: `Due on ${milestone.due_date} - Assigned to ${milestone.owner_name}`,
          priority: 'high',
          due_date: milestone.due_date,
          owner: milestone.owner_name
        });
      });

      // Get pending decisions
      const pendingDecisions = await db('decisions')
        .select('title', 'description', 'decision_date', 'users.name as decision_maker_name')
        .join('users', 'decisions.taken_by', 'users.id')
        .where('project_id', projectId)
        .where('decision_status', 'active')
        .orderBy('decision_date', 'DESC')
        .limit(3);

      pendingDecisions.forEach(decision => {
        nextSteps.push({
          type: 'pending_decision',
          title: `Decision: ${decision.title}`,
          description: `Made on ${decision.decision_date} by ${decision.decision_maker_name}`,
          priority: 'medium',
          due_date: null,
          owner: decision.decision_maker_name
        });
      });

      return nextSteps.sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date) - new Date(b.due_date);
        }
        return 0;
      });
    } catch (error) {
      throw new Error(`Error getting next steps: ${error.message}`);
    }
  }

  /**
   * Get critical decisions
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Critical decisions
   */
  static async getCriticalDecisions(projectId) {
    try {
      const decisions = await db('decisions')
        .select(
          'decisions.*',
          'users.name as decision_maker_name',
          'users.email as decision_maker_email'
        )
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .where('decisions.impact_area', 'in', ['scope', 'timeline', 'budget'])
        .where('decisions.decision_status', 'active')
        .orderBy('decisions.decision_date', 'DESC')
        .limit(5);

      return decisions.map(decision => ({
        ...decision,
        criticality: this.getDecisionCriticality(decision)
      }));
    } catch (error) {
      throw new Error(`Error getting critical decisions: ${error.message}`);
    }
  }

  /**
   * Get upcoming deadlines
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Upcoming deadlines
   */
  static async getUpcomingDeadlines(projectId) {
    try {
      const deadlines = [];
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get upcoming task deadlines
      const taskDeadlines = await db('tasks')
        .select('title', 'due_date', 'owner_id', 'users.name as owner_name')
        .join('users', 'tasks.owner_id', 'users.id')
        .where('project_id', projectId)
        .where('status', 'in', ['todo', 'in_progress'])
        .where('due_date', '>=', today.toISOString().split('T')[0])
        .where('due_date', '<=', thirtyDaysFromNow.toISOString().split('T')[0])
        .orderBy('due_date', 'ASC')
        .limit(5);

      taskDeadlines.forEach(task => {
        deadlines.push({
          type: 'task',
          title: task.title,
          due_date: task.due_date,
          owner: task.owner_name,
          days_until: Math.floor((new Date(task.due_date) - today) / (1000 * 60 * 60 * 24))
        });
      });

      // Get upcoming milestone deadlines
      const milestoneDeadlines = await db('milestones')
        .select('title', 'due_date', 'owner_id', 'users.name as owner_name')
        .join('users', 'milestones.owner_id', 'users.id')
        .where('project_id', projectId)
        .where('status', 'in', ['pending', 'in_progress'])
        .where('due_date', '>=', today.toISOString().split('T')[0])
        .where('due_date', '<=', thirtyDaysFromNow.toISOString().split('T')[0])
        .orderBy('due_date', 'ASC')
        .limit(3);

      milestoneDeadlines.forEach(milestone => {
        deadlines.push({
          type: 'milestone',
          title: milestone.title,
          due_date: milestone.due_date,
          owner: milestone.owner_name,
          days_until: Math.floor((new Date(milestone.due_date) - today) / (1000 * 60 * 60 * 24))
        });
      });

      return deadlines.sort((a, b) => a.days_until - b.days_until);
    } catch (error) {
      throw new Error(`Error getting upcoming deadlines: ${error.message}`);
    }
  }

  /**
   * Get team performance summary
   * @param {number} projectId - Project ID
   * @returns {Promise<string>} Team performance summary
   */
  static async getTeamPerformanceSummary(projectId) {
    try {
      // Get team member performance
      const teamPerformance = await db('tasks')
        .select(
          'users.name',
          'users.role',
          db.raw('COUNT(*) as total_tasks'),
          db.raw('COUNT(CASE WHEN tasks.status = \'completed\' THEN 1 END) as completed_tasks'),
          db.raw('COUNT(CASE WHEN tasks.due_date < CURRENT_DATE AND tasks.status IN (\'todo\', \'in_progress\') THEN 1 END) as overdue_tasks')
        )
        .join('users', 'tasks.owner_id', 'users.id')
        .where('tasks.project_id', projectId)
        .groupBy('users.id', 'users.name', 'users.role')
        .orderBy('completed_tasks', 'desc')
        .limit(10);

      // Generate summary
      const totalTeamMembers = teamPerformance.length;
      const highPerformers = teamPerformance.filter(member => {
        const completionRate = member.total_tasks > 0 ? (member.completed_tasks / member.total_tasks) * 100 : 0;
        return completionRate > 80 && member.overdue_tasks === 0;
      }).length;

      const strugglingMembers = teamPerformance.filter(member => member.overdue_tasks > 2).length;

      let summary = `Team of ${totalTeamMembers} members`;
      
      if (highPerformers > 0) {
        summary += ` with ${highPerformers} high performer${highPerformers > 1 ? 's' : ''}`;
      }
      
      if (strugglingMembers > 0) {
        summary += ` and ${strugglingMembers} member${strugglingMembers > 1 ? 's' : ''} needing support`;
      }

      if (highPerformers === 0 && strugglingMembers === 0) {
        summary += ' performing adequately';
      }

      return summary;
    } catch (error) {
      return 'Team performance data not available';
    }
  }

  /**
   * Get risk summary
   * @param {number} projectId - Project ID
   * @returns {Promise<string>} Risk summary
   */
  static async getRiskSummary(projectId) {
    try {
      const riskMetrics = await db('risks')
        .select(
          db.raw('COUNT(*) as total_risks'),
          db.raw('COUNT(CASE WHEN severity = \'critical\' THEN 1 END) as critical_risks'),
          db.raw('COUNT(CASE WHEN status = \'open\' THEN 1 END) as open_risks')
        )
        .where('project_id', projectId)
        .first();

      let summary = `${riskMetrics.total_risks} total risks`;
      
      if (riskMetrics.critical_risks > 0) {
        summary += ` including ${riskMetrics.critical_risks} critical`;
      }
      
      if (riskMetrics.open_risks > 0) {
        summary += ` with ${riskMetrics.open_risks} open`;
      }

      if (riskMetrics.critical_risks === 0 && riskMetrics.open_risks === 0) {
        summary += ' - all risks resolved';
      }

      return summary;
    } catch (error) {
      return 'Risk data not available';
    }
  }

  /**
   * Determine current status
   * @param {Object} metrics - Project metrics
   * @param {Array} blockers - Key blockers
   * @param {string} riskSummary - Risk summary
   * @returns {Object} Current status
   */
  static determineCurrentStatus(metrics, blockers, riskSummary) {
    const { tasks, milestones, risks, overall_health } = metrics;
    
    let status = 'on_track';
    let message = 'Project is progressing well';

    // Check for critical issues
    if (blockers.some(b => b.severity === 'critical') || risks.critical_risks > 0) {
      status = 'critical';
      message = 'Project has critical issues requiring immediate attention';
    } else if (blockers.some(b => b.severity === 'high') || risks.open_risks > 3) {
      status = 'at_risk';
      message = 'Project is at risk and needs attention';
    } else if (tasks.overdue_tasks > 0 || milestones.overdue_milestones > 0) {
      status = 'delayed';
      message = 'Project is experiencing delays';
    } else if (overall_health < 60) {
      status = 'concerning';
      message = 'Project health score is concerning';
    } else if (overall_health > 85) {
      status = 'excellent';
      message = 'Project is performing excellently';
    }

    return {
      status,
      message,
      health_score: overall_health,
      blocker_count: blockers.length,
      risk_level: risks.critical_risks > 0 ? 'critical' : risks.open_risks > 3 ? 'high' : 'medium'
    };
  }

  /**
   * Calculate overall health score
   * @param {Object} taskMetrics - Task metrics
   * @param {Object} milestoneMetrics - Milestone metrics
   * @param {Object} riskMetrics - Risk metrics
   * @returns {number} Health score (0-100)
   */
  static calculateOverallHealth(taskMetrics, milestoneMetrics, riskMetrics) {
    let score = 100;

    // Deduct for overdue tasks
    if (taskMetrics.overdue_tasks > 0) {
      score -= Math.min(30, taskMetrics.overdue_tasks * 5);
    }

    // Deduct for SLA breaches
    if (taskMetrics.sla_breached_tasks > 0) {
      score -= Math.min(20, taskMetrics.sla_breached_tasks * 3);
    }

    // Deduct for overdue milestones
    if (milestoneMetrics.overdue_milestones > 0) {
      score -= Math.min(25, milestoneMetrics.overdue_milestones * 8);
    }

    // Deduct for critical risks
    if (riskMetrics.critical_risks > 0) {
      score -= Math.min(15, riskMetrics.critical_risks * 5);
    }

    // Bonus for high completion rates
    if (taskMetrics.completion_rate > 80) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get task priority
   * @param {Object} task - Task object
   * @returns {string} Priority level
   */
  static getTaskPriority(task) {
    const today = new Date();
    const dueDate = new Date(task.due_date);
    const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 0) return 'critical';
    if (daysUntilDue <= 3) return 'high';
    if (daysUntilDue <= 7) return 'medium';
    return 'low';
  }

  /**
   * Get decision criticality
   * @param {Object} decision - Decision object
   * @returns {string} Criticality level
   */
  static getDecisionCriticality(decision) {
    if (decision.impact_area === 'budget') return 'critical';
    if (decision.impact_area === 'timeline') return 'high';
    if (decision.impact_area === 'scope') return 'high';
    return 'medium';
  }
}

module.exports = ProjectSummarySystem;
