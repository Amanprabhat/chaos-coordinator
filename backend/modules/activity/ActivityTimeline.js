const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Activity Timeline System
 * Comprehensive project activity tracking and timeline visualization
 */
class ActivityTimeline {
  /**
   * Get project activity timeline
   * @param {number} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Activity timeline
   */
  static async getProjectTimeline(projectId, options = {}) {
    try {
      const { limit = 100, start_date, end_date, activity_type } = options;
      
      let query = db('audit_logs')
        .select(
          'audit_logs.*',
          'users.name as user_name',
          'users.email as user_email',
          'users.role as user_role'
        )
        .leftJoin('users', 'audit_logs.performed_by', 'users.id')
        .where('audit_logs.entity_id', projectId)
        .orderBy('audit_logs.timestamp', 'DESC')
        .limit(limit);

      if (start_date) {
        query = query.andWhere('audit_logs.timestamp', '>=', start_date);
      }

      if (end_date) {
        query = query.andWhere('audit_logs.timestamp', '<=', end_date);
      }

      if (activity_type) {
        query = query.andWhere('audit_logs.action', activity_type);
      }

      const activities = await query;

      // Group activities by date for timeline visualization
      const timeline = activities.reduce((acc, current) => {
        const date = new Date(current.timestamp).toISOString().split('T')[0];
        
        if (!acc[date]) {
          acc[date] = [];
        }
        
        acc[date].push(current);
        return acc;
      }, {});

      return timeline;
    } catch (error) {
      throw new Error(`Error getting project timeline: ${error.message}`);
    }
  }

  /**
   * Log project activity
   * @param {number} projectId - Project ID
   * @param {string} action - Action performed
   * @param {number} userId - User ID
   * @param {Object} details - Activity details
   * @param {Object} entityData - Entity data changes
   * @returns {Promise<Object>} Log result
   */
  static async logProjectActivity(projectId, action, userId, details = {}, entityData = {}) {
    try {
      const logEntry = {
        entity_type: 'project',
        entity_id: projectId,
        action,
        old_values: entityData.old_values || null,
        new_values: { ...details, ...entityData.new_values },
        performed_by: userId,
        timestamp: new Date()
      };

      await db('audit_logs').insert(logEntry);
      
      return logEntry;
    } catch (error) {
      throw new Error(`Error logging project activity: ${error.message}`);
    }
  }

  /**
   * Get project velocity metrics
   * @param {number} projectId - Project ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Velocity metrics
   */
  static async getProjectVelocity(projectId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Get stage transitions in period
      const stageTransitions = await db('audit_logs')
        .where('audit_logs.entity_type', 'project')
        .where('audit_logs.action', 'stage_transition')
        .where('audit_logs.timestamp', '>=', startDateStr)
        .orderBy('audit_logs.timestamp', 'ASC');

      // Get tasks completed in period
      const completedTasks = await db('tasks')
        .where('project_id', projectId)
        .where('status', 'completed')
        .where('completion_date', '>=', startDateStr)
        .where('completion_date', '<=', new Date().toISOString().split('T')[0])
        .select(
          'completion_date',
          'estimated_hours',
          'actual_hours',
          db.raw('EXTRACT(EPOCH FROM (completion_date - created_at)) / 3600 as duration_hours')
        );

      // Calculate velocity metrics
      const totalTasks = completedTasks.length;
      const totalDuration = completedTasks.reduce((sum, task) => sum + (task.duration_hours || 0), 0);
      const avgDuration = totalDuration > 0 ? totalDuration / totalTasks : 0;

      // Calculate cycle time
      const cycleTime = stageTransitions.length > 0 ? 
        (new Date(stageTransitions[stageTransitions.length - 1].timestamp) - new Date(stageTransitions[0].timestamp)) / (1000 * 60 * 60 * 24) : 
        null;

      return {
        project_id: projectId,
        period_days: days,
        stage_transitions: stageTransitions.length,
        tasks_completed: totalTasks,
        avg_duration_hours: parseFloat(avgDuration.toFixed(2)),
        total_duration_hours: parseFloat(totalDuration.toFixed(2)),
        cycle_time_days: cycleTime ? parseFloat((cycleTime).toFixed(2)) : null,
        calculated_at: new Date()
      };
    } catch (error) {
      throw new Error(`Error calculating project velocity: ${error.message}`);
    }
  }

  /**
   * Get project burndown chart data
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Burndown chart data
   */
  static async getBurndownData(projectId) {
    try {
      // Get tasks for the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

      const tasks = await db('tasks')
        .where('project_id', projectId)
        .where('created_at', '>=', ninetyDaysAgoStr)
        .select('status', 'created_at', 'completion_date', 'estimated_hours', 'actual_hours');

      // Group by week
      const burndownData = {};
      for (let i = 0; i < 12; i++) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setDate(weekStart.getDate() - ((i * 7) - 1));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + (6 - weekStart.getDay()));
        
        const weekTasks = tasks.filter(task => {
          const taskDate = new Date(task.created_at);
          return taskDate >= weekStart && taskDate < weekEnd;
        });

        const completed = weekTasks.filter(t => t.status === 'completed').length;
        const total = weekTasks.length;
        const completedEstimated = weekTasks
          .filter(t => t.status === 'completed')
          .reduce((sum, task) => sum + (task.estimated_hours || 0), 0);

        burndownData[`week_${i}`] = {
          week_start: weekStart.toISOString().split('T')[0],
          week_end: weekEnd.toISOString().split('T')[0],
          total: total,
          completed: completed,
          completed_estimated: completedEstimated,
          completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0'
        };
      }

      return {
        project_id: projectId,
        period: '90 days',
        burndown_data: burndownData,
        calculated_at: new Date()
      };
    } catch (error) {
      throw new Error(`Error getting burndown data: ${error.message}`);
    }
  }
}

module.exports = ActivityTimeline;
