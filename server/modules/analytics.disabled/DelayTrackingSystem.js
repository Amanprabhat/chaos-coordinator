const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Delay Tracking and Root Cause Analytics System
 * Track delays, analyze patterns, and provide insights
 */
class DelayTrackingSystem {
  /**
   * Log task delay with reason and category
   * @param {number} taskId - Task ID
   * @param {Object} delayData - Delay data
   * @returns {Promise<Object>} Updated task
   */
  static async logTaskDelay(taskId, delayData) {
    try {
      const { delay_reason, delay_category, delay_impact_hours, updated_by } = delayData;

      if (!delay_reason || !delay_category || !updated_by) {
        throw new ValidationError('Delay reason, category, and updated by are required');
      }

      const validCategories = ['dependency', 'client', 'internal', 'external', 'resource', 'technical', 'unknown'];
      if (!validCategories.includes(delay_category)) {
        throw new ValidationError('Invalid delay category');
      }

      // Validate task exists
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        throw new ValidationError('Task not found');
      }

      // Calculate delay impact if not provided
      const today = new Date();
      const dueDate = new Date(task.due_date);
      const impactHours = delay_impact_hours || Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60)));

      const [updatedTask] = await db('tasks')
        .where('id', taskId)
        .update({
          delay_reason,
          delay_category,
          delay_impact_hours: impactHours,
          delay_notified: false,
          updated_at: new Date()
        })
        .returning('*');

      // Update project delay score
      await this.updateProjectDelayScore(task.project_id);

      // Log the delay
      await db('audit_logs').insert({
        entity_type: 'task',
        entity_id: taskId,
        action: 'delay_logged',
        new_values: {
          delay_reason,
          delay_category,
          delay_impact_hours: impactHours
        },
        performed_by: updated_by,
        timestamp: new Date()
      });

      // Check if SLA is breached and notify
      if (task.sla_breached || impactHours > 24) {
        await this.notifyDelayStakeholders(updatedTask, impactHours);
      }

      return updatedTask;
    } catch (error) {
      throw new Error(`Error logging task delay: ${error.message}`);
    }
  }

  /**
   * Resolve task delay
   * @param {number} taskId - Task ID
   * @param {Object} resolutionData - Resolution data
   * @returns {Promise<Object>} Updated task
   */
  static async resolveTaskDelay(taskId, resolutionData) {
    try {
      const { resolution_notes, updated_by } = resolutionData;

      if (!resolution_notes || !updated_by) {
        throw new ValidationError('Resolution notes and updated by are required');
      }

      const [updatedTask] = await db('tasks')
        .where('id', taskId)
        .update({
          delay_resolved_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedTask) {
        throw new ValidationError('Task not found');
      }

      // Log the resolution
      await db('audit_logs').insert({
        entity_type: 'task',
        entity_id: taskId,
        action: 'delay_resolved',
        new_values: {
          resolution_notes,
          resolved_at: updatedTask.delay_resolved_at
        },
        performed_by: updated_by,
        timestamp: new Date()
      });

      // Update project delay score
      await this.updateProjectDelayScore(updatedTask.project_id);

      return updatedTask;
    } catch (error) {
      throw new Error(`Error resolving task delay: ${error.message}`);
    }
  }

  /**
   * Get delay analytics for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Delay analytics
   */
  static async getDelayAnalytics(projectId) {
    try {
      // Get delays by category
      const delaysByCategory = await db('tasks')
        .select('delay_category')
        .count('* as count')
        .sum('delay_impact_hours as total_hours')
        .where('project_id', projectId)
        .whereNotNull('delay_category')
        .groupBy('delay_category')
        .orderBy('total_hours', 'desc');

      // Get delays by time period
      const delaysByMonth = await db('tasks')
        .select(
          db.raw('DATE_TRUNC(\'month\', created_at) as month'),
          db.raw('COUNT(*) as count'),
          db.raw('SUM(delay_impact_hours) as total_hours')
        )
        .where('project_id', projectId)
        .whereNotNull('delay_category')
        .groupBy(db.raw('DATE_TRUNC(\'month\', created_at)'))
        .orderBy(db.raw('DATE_TRUNC(\'month\', created_at)'), 'desc')
        .limit(12);

      // Get top delayed tasks
      const topDelayedTasks = await db('tasks')
        .select(
          'tasks.*',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .leftJoin('users', 'tasks.owner_id', 'users.id')
        .where('tasks.project_id', projectId)
        .whereNotNull('tasks.delay_category')
        .where('tasks.delay_impact_hours', '>', 0)
        .orderBy('tasks.delay_impact_hours', 'desc')
        .limit(10);

      // Get unresolved delays
      const unresolvedDelays = await db('tasks')
        .select(
          'tasks.*',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .leftJoin('users', 'tasks.owner_id', 'users.id')
        .where('tasks.project_id', projectId)
        .whereNotNull('tasks.delay_category')
        .whereNull('tasks.delay_resolved_at')
        .where('tasks.status', 'in', ['todo', 'in_progress'])
        .orderBy('tasks.delay_impact_hours', 'desc')
        .limit(20);

      // Calculate delay patterns
      const delayPatterns = await this.analyzeDelayPatterns(projectId);

      return {
        project_id: projectId,
        summary: {
          total_delayed_tasks: delaysByCategory.reduce((sum, item) => sum + item.count, 0),
          total_delay_hours: delaysByCategory.reduce((sum, item) => sum + (item.total_hours || 0), 0),
          by_category: delaysByCategory,
          by_month: delaysByMonth,
          top_delayed_tasks: topDelayedTasks,
          unresolved_delays: unresolvedDelays,
          patterns: delayPatterns
        }
      };
    } catch (error) {
      throw new Error(`Error getting delay analytics: ${error.message}`);
    }
  }

  /**
   * Get root cause analysis
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Root cause analysis
   */
  static async getRootCauseAnalysis(projectId) {
    try {
      // Get delay reasons and group them
      const delayReasons = await db('tasks')
        .select('delay_reason', 'delay_category', 'delay_impact_hours')
        .where('project_id', projectId)
        .whereNotNull('delay_reason')
        .whereNotNull('delay_category');

      // Analyze patterns
      const rootCauses = this.identifyRootCauses(delayReasons);

      // Get recommendations based on patterns
      const recommendations = this.generateDelayRecommendations(rootCauses);

      // Get impact by owner
      const impactByOwner = await db('tasks')
        .select(
          'users.name',
          'users.email',
          'users.role',
          db.raw('COUNT(*) as delayed_tasks'),
          db.raw('SUM(tasks.delay_impact_hours) as total_delay_hours')
        )
        .join('users', 'tasks.owner_id', 'users.id')
        .where('tasks.project_id', projectId)
        .whereNotNull('tasks.delay_category')
        .groupBy('users.id', 'users.name', 'users.email', 'users.role')
        .orderBy('total_delay_hours', 'desc')
        .limit(10);

      // Get trend analysis
      const trendAnalysis = await this.analyzeDelayTrends(projectId);

      return {
        project_id: projectId,
        root_causes: rootCauses,
        recommendations: recommendations,
        impact_by_owner: impactByOwner,
        trend_analysis: trendAnalysis,
        summary: {
          total_root_causes: rootCauses.length,
          high_impact_causes: rootCauses.filter(cause => cause.severity === 'high').length,
          preventable_delays: rootCauses.filter(cause => cause.preventable === true).length
        }
      };
    } catch (error) {
      throw new Error(`Error getting root cause analysis: ${error.message}`);
    }
  }

  /**
   * Get escalation visibility data
   * @returns {Promise<Object>} Escalation visibility
   */
  static async getEscalationVisibility() {
    try {
      // Get top delayed owners
      const topDelayedOwners = await db('tasks')
        .select(
          'users.name',
          'users.email',
          'users.role',
          'users.manager_id',
          db.raw('COUNT(*) as delayed_tasks'),
          db.raw('SUM(tasks.delay_impact_hours) as total_delay_hours')
        )
        .join('users', 'tasks.owner_id', 'users.id')
        .whereNotNull('tasks.delay_category')
        .where('tasks.delay_impact_hours', '>', 0)
        .groupBy('users.id', 'users.name', 'users.email', 'users.role', 'users.manager_id')
        .orderBy('total_delay_hours', 'desc')
        .limit(20);

      // Get projects with repeated SLA breaches
      const projectsWithBreaches = await db('projects')
        .select(
          'projects.*',
          db.raw('COUNT(tasks.id) as breach_count'),
          db.raw('SUM(tasks.delay_impact_hours) as total_breach_hours')
        )
        .join('tasks', 'projects.id', 'tasks.project_id')
        .where('tasks.sla_breached', true)
        .where('tasks.delay_impact_hours', '>', 0)
        .groupBy('projects.id', 'projects.name', 'projects.client_name', 'projects.owner_id', 'projects.current_stage_id', 'projects.status')
        .having(db.raw('COUNT(tasks.id)'), '>', 2)
        .orderBy('breach_count', 'desc')
        .limit(15);

      // Get teams causing maximum delays
      const teamsWithDelays = await db('tasks')
        .select(
          'users.role as team_role',
          db.raw('COUNT(*) as delayed_tasks'),
          db.raw('SUM(tasks.delay_impact_hours) as total_delay_hours'),
          db.raw('AVG(tasks.delay_impact_hours) as avg_delay_hours')
        )
        .join('users', 'tasks.owner_id', 'users.id')
        .whereNotNull('tasks.delay_category')
        .where('tasks.delay_impact_hours', '>', 0)
        .groupBy('users.role')
        .orderBy('total_delay_hours', 'desc')
        .limit(10);

      // Get critical delays needing immediate attention
      const criticalDelays = await db('tasks')
        .select(
          'tasks.*',
          'projects.name as project_name',
          'projects.client_name',
          'users.name as owner_name',
          'users.email as owner_email',
          'users.manager_id',
          'manager.name as manager_name',
          'manager.email as manager_email'
        )
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('users', 'tasks.owner_id', 'users.id')
        .leftJoin('users as manager', 'users.manager_id', 'manager.id')
        .where('tasks.delay_impact_hours', '>', 48)
        .where('tasks.status', 'in', ['todo', 'in_progress'])
        .whereNull('tasks.delay_resolved_at')
        .orderBy('tasks.delay_impact_hours', 'desc')
        .limit(25);

      return {
        summary: {
          top_delayed_owners: topDelayedOwners,
          projects_with_breaches: projectsWithBreaches,
          teams_with_delays: teamsWithDelays,
          critical_delays: criticalDelays
        },
        metrics: {
          total_delayed_owners: topDelayedOwners.length,
          total_projects_with_breaches: projectsWithBreaches.length,
          total_critical_delays: criticalDelays.length,
          avg_delay_per_team: teamsWithDelays.reduce((sum, team) => sum + team.avg_delay_hours, 0) / teamsWithDelays.length
        }
      };
    } catch (error) {
      throw new Error(`Error getting escalation visibility: ${error.message}`);
    }
  }

  /**
   * Generate weekly digest for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Weekly digest
   */
  static async generateWeeklyDigest(projectId) {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get progress this week
      const progressThisWeek = await db('tasks')
        .select(
          db.raw('COUNT(*) as total_tasks'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_tasks'),
          db.raw('COUNT(CASE WHEN status = \'in_progress\' THEN 1 END) as in_progress_tasks')
        )
        .where('project_id', projectId)
        .where('updated_at', '>=', oneWeekAgo)
        .first();

      // Get delays this week
      const delaysThisWeek = await db('tasks')
        .select(
          db.raw('COUNT(*) as delayed_tasks'),
          db.raw('SUM(delay_impact_hours) as total_delay_hours'),
          db.raw('ARRAY_AGG(delay_category) as delay_categories')
        )
        .where('project_id', projectId)
        .where('updated_at', '>=', oneWeekAgo)
        .whereNotNull('delay_category')
        .first();

      // Get decisions this week
      const decisionsThisWeek = await db('decisions')
        .select(
          db.raw('COUNT(*) as total_decisions'),
          db.raw('ARRAY_AGG(impact_area) as impact_areas')
        )
        .where('project_id', projectId)
        .where('decision_date', '>=', oneWeekAgo)
        .first();

      // Get risks this week
      const risksThisWeek = await db('risks')
        .select(
          db.raw('COUNT(*) as total_risks'),
          db.raw('COUNT(CASE WHEN status = \'open\' THEN 1 END) as open_risks'),
          db.raw('COUNT(CASE WHEN status = \'resolved\' THEN 1 END) as resolved_risks'),
          db.raw('ARRAY_AGG(severity) as severities')
        )
        .where('project_id', projectId)
        .where('updated_at', '>=', oneWeekAgo)
        .first();

      // Get meetings this week
      const meetingsThisWeek = await db('meetings')
        .select(
          db.raw('COUNT(*) as total_meetings'),
          db.raw('SUM(duration_minutes) as total_minutes'),
          db.raw('ARRAY_AGG(meeting_type) as meeting_types')
        )
        .where('project_id', projectId)
        .where('meeting_date', '>=', oneWeekAgo)
        .first();

      // Generate insights
      const insights = this.generateWeeklyInsights({
        progress: progressThisWeek,
        delays: delaysThisWeek,
        decisions: decisionsThisWeek,
        risks: risksThisWeek,
        meetings: meetingsThisWeek
      });

      // Update project digest sent flag
      await db('projects')
        .where('id', projectId)
        .update({
          weekly_digest_sent: true,
          last_digest_date: new Date()
        });

      return {
        project_id: projectId,
        week_start: oneWeekAgo.toISOString().split('T')[0],
        week_end: new Date().toISOString().split('T')[0],
        progress: progressThisWeek,
        delays: delaysThisWeek,
        decisions: decisionsThisWeek,
        risks: risksThisWeek,
        meetings: meetingsThisWeek,
        insights: insights
      };
    } catch (error) {
      throw new Error(`Error generating weekly digest: ${error.message}`);
    }
  }

  /**
   * Helper methods
   */
  static async updateProjectDelayScore(projectId) {
    try {
      // Use the database function to calculate delay score
      await db.raw('SELECT calculate_project_delay_score(?)', [projectId]);
    } catch (error) {
      console.error('Error updating project delay score:', error);
    }
  }

  static async notifyDelayStakeholders(task, impactHours) {
    try {
      // Notify task owner
      await db('notifications').insert({
        user_id: task.owner_id,
        project_id: task.project_id,
        type: 'task_delayed',
        title: 'Task Delay Alert',
        message: `Task "${task.title}" is delayed by ${impactHours} hours. Reason: ${task.delay_reason}`,
        send_immediately: impactHours > 48,
        created_at: new Date()
      });

      // Notify project owner if delay is significant
      if (impactHours > 72) {
        const project = await db('projects').where('id', task.project_id).first();
        if (project && project.owner_id !== task.owner_id) {
          await db('notifications').insert({
            user_id: project.owner_id,
            project_id: task.project_id,
            type: 'critical_delay',
            title: 'Critical Project Delay',
            message: `Critical delay in task "${task.title}" - ${impactHours} hours overdue`,
            send_immediately: true,
            created_at: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error notifying delay stakeholders:', error);
    }
  }

  static analyzeDelayPatterns(projectId) {
    // This would implement pattern analysis logic
    // For now, return mock data
    return {
      recurring_patterns: [
        {
          pattern: 'Client delays in requirements phase',
          frequency: 'high',
          impact: 'medium'
        },
        {
          pattern: 'Technical dependencies causing delays',
          frequency: 'medium',
          impact: 'high'
        }
      ],
      seasonal_trends: [],
      risk_factors: []
    };
  }

  static identifyRootCauses(delayReasons) {
    const rootCauses = [];
    const groupedReasons = {};

    // Group similar reasons
    delayReasons.forEach(delay => {
      const category = delay.delay_category;
      if (!groupedReasons[category]) {
        groupedReasons[category] = [];
      }
      groupedReasons[category].push(delay);
    });

    // Analyze each category
    Object.keys(groupedReasons).forEach(category => {
      const reasons = groupedReasons[category];
      const totalImpact = reasons.reduce((sum, reason) => sum + reason.delay_impact_hours, 0);
      const avgImpact = totalImpact / reasons.length;

      rootCauses.push({
        category,
        total_impact_hours: totalImpact,
        affected_tasks: reasons.length,
        avg_impact_hours: avgImpact,
        severity: totalImpact > 100 ? 'high' : totalImpact > 50 ? 'medium' : 'low',
        preventable: category !== 'external',
        common_reasons: this.getCommonReasons(reasons)
      });
    });

    return rootCauses.sort((a, b) => b.total_impact_hours - a.total_impact_hours);
  }

  static getCommonReasons(reasons) {
    const reasonCounts = {};
    reasons.forEach(reason => {
      const normalizedReason = reason.delay_reason.toLowerCase().trim();
      reasonCounts[normalizedReason] = (reasonCounts[normalizedReason] || 0) + 1;
    });

    return Object.keys(reasonCounts)
      .sort((a, b) => reasonCounts[b] - reasonCounts[a])
      .slice(0, 3)
      .map(reason => ({ reason, count: reasonCounts[reason] }));
  }

  static generateDelayRecommendations(rootCauses) {
    const recommendations = [];

    rootCauses.forEach(cause => {
      switch (cause.category) {
        case 'client':
          recommendations.push({
            category: 'client',
            recommendation: 'Improve client communication and expectation management',
            priority: cause.severity === 'high' ? 'high' : 'medium',
            actions: ['Regular client check-ins', 'Clear requirement documentation', 'Early risk identification']
          });
          break;
        case 'dependency':
          recommendations.push({
            category: 'dependency',
            recommendation: 'Better dependency management and risk assessment',
            priority: cause.severity === 'high' ? 'high' : 'medium',
            actions: ['Dependency mapping', 'Risk mitigation planning', 'Alternative solutions']
          });
          break;
        case 'internal':
          recommendations.push({
            category: 'internal',
            recommendation: 'Improve internal processes and resource allocation',
            priority: cause.severity === 'high' ? 'high' : 'medium',
            actions: ['Process optimization', 'Resource planning', 'Skill development']
          });
          break;
      }
    });

    return recommendations;
  }

  static analyzeDelayTrends(projectId) {
    // This would implement trend analysis logic
    // For now, return mock data
    return {
      trend_direction: 'increasing',
      trend_percentage: 15.5,
      forecast_next_month: 25,
      confidence_level: 0.75
    };
  }

  static generateWeeklyInsights(data) {
    const insights = [];

    if (data.delays && data.delays.delayed_tasks > 0) {
      insights.push({
        type: 'warning',
        message: `${data.delays.delayed_tasks} tasks delayed this week`,
        recommendation: 'Focus on resolving delays to maintain project timeline'
      });
    }

    if (data.progress && data.progress.completed_tasks > 0) {
      insights.push({
        type: 'positive',
        message: `${data.progress.completed_tasks} tasks completed this week`,
        recommendation: 'Great progress! Keep up the momentum'
      });
    }

    if (data.risks && data.risks.open_risks > 3) {
      insights.push({
        type: 'concern',
        message: `${data.risks.open_risks} open risks need attention`,
        recommendation: 'Prioritize risk mitigation activities'
      });
    }

    return insights;
  }
}

module.exports = DelayTrackingSystem;
