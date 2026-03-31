const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidatorEnhanced');

/**
 * SLA Engine
 * Realistic SLA calculation, breach detection, and escalation
 */
class SLAEngine {
  /**
   * Calculate SLA status for a task
   * @param {Object} task - Task object
   * @returns {Object} SLA status information
   */
  static calculateSLAStatus(task) {
    const now = new Date();
    const slaStatus = {
      is_breached: false,
      hours_remaining: 0,
      hours_overdue: 0,
      is_paused: task.sla_paused || false,
      active_time_hours: 0,
      breach_duration_hours: 0
    };

    // If task is completed, no SLA calculation needed
    if (task.status === 'completed') {
      return slaStatus;
    }

    // If no SLA hours set, no SLA tracking
    if (!task.sla_hours || task.sla_hours <= 0) {
      return slaStatus;
    }

    // Calculate active time (excluding paused periods)
    let slaStartTime = task.sla_start_time || task.created_at;
    let activeTime = now - new Date(slaStartTime);
    
    // Subtract paused time if applicable
    if (task.sla_paused && task.sla_pause_start_time) {
      const pausedDuration = now - new Date(task.sla_pause_start_time);
      activeTime -= pausedDuration;
    }

    slaStatus.active_time_hours = activeTime / (1000 * 60 * 60);
    slaStatus.hours_remaining = task.sla_hours - slaStatus.active_time_hours;

    // Check for breach
    if (slaStatus.hours_remaining < 0) {
      slaStatus.is_breached = true;
      slaStatus.hours_overdue = Math.abs(slaStatus.hours_remaining);
      slaStatus.breach_duration_hours = slaStatus.hours_overdue;
    }

    return slaStatus;
  }

  /**
   * Start SLA tracking for a task
   * @param {number} taskId - Task ID
   * @param {number} userId - User starting the task
   * @returns {Promise<Object>} Updated task
   */
  static async startSLATracking(taskId, userId) {
    try {
      const [updatedTask] = await db('tasks')
        .where('id', taskId)
        .update({
          status: 'in_progress',
          sla_start_time: new Date(),
          sla_paused: false,
          sla_pause_reason: null,
          updated_at: new Date()
        })
        .returning('*');

      // Log SLA start
      await this.logSLAEvent(taskId, 'sla_started', {
        user_id: userId,
        start_time: updatedTask.sla_start_time
      });

      return updatedTask;
    } catch (error) {
      throw new Error(`Error starting SLA tracking: ${error.message}`);
    }
  }

  /**
   * Pause SLA tracking for a task
   * @param {number} taskId - Task ID
   * @param {string} reason - Reason for pausing
   * @returns {Promise<Object>} Updated task
   */
  static async pauseSLATracking(taskId, reason) {
    try {
      const [updatedTask] = await db('tasks')
        .where('id', taskId)
        .update({
          sla_paused: true,
          sla_pause_start_time: new Date(),
          sla_pause_reason: reason,
          updated_at: new Date()
        })
        .returning('*');

      // Log SLA pause
      await this.logSLAEvent(taskId, 'sla_paused', {
        reason: reason,
        pause_time: updatedTask.sla_pause_start_time
      });

      return updatedTask;
    } catch (error) {
      throw new Error(`Error pausing SLA tracking: ${error.message}`);
    }
  }

  /**
   * Resume SLA tracking for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  static async resumeSLATracking(taskId) {
    try {
      const task = await db('tasks').where('id', taskId).first();
      
      let updateData = {
        sla_paused: false,
        sla_pause_reason: null,
        updated_at: new Date()
      };

      // Calculate total pause duration
      if (task.sla_pause_start_time) {
        const pauseDuration = new Date() - new Date(task.sla_pause_start_time);
        updateData.sla_pause_start_time = null;
        updateData.sla_total_pause_duration = pauseDuration / (1000 * 60 * 60); // Convert to hours
      }

      const [updatedTask] = await db('tasks')
        .where('id', taskId)
        .update(updateData)
        .returning('*');

      // Log SLA resume
      await this.logSLAEvent(taskId, 'sla_resumed', {
        pause_duration: updateData.sla_total_pause_duration,
        resume_time: new Date()
      });

      return updatedTask;
    } catch (error) {
      throw new Error(`Error resuming SLA tracking: ${error.message}`);
    }
  }

  /**
   * Check for SLA breaches and trigger notifications
   * @param {number} projectId - Project ID to check
   * @returns {Promise<Array>} Array of breach notifications
   */
  static async checkSLABreaches(projectId) {
    try {
      const now = new Date();
      const breachedTasks = await db('tasks')
        .select(
          'tasks.*',
          'users.name as owner_name',
          'users.email as owner_email',
          'users.manager_id',
          'manager.name as manager_name',
          'manager.email as manager_email'
        )
        .leftJoin('users', 'tasks.owner_id', 'users.id')
        .leftJoin('users as manager', 'users.manager_id', 'manager.id')
        .where('tasks.project_id', projectId)
        .where('tasks.sla_hours', '>', 0)
        .where('tasks.status', 'in', ['in_progress', 'at_risk'])
        .whereNot('tasks.sla_paused', true);

      const notifications = [];

      for (const task of breachedTasks) {
        const slaStatus = this.calculateSLAStatus(task);
        
        if (slaStatus.is_breached) {
          const notification = {
            task_id: task.id,
            task_title: task.title,
            owner_id: task.owner_id,
            owner_name: task.owner_name,
            owner_email: task.owner_email,
            manager_id: task.manager_id,
            manager_name: task.manager_name,
            manager_email: task.manager_email,
            breach_duration_hours: slaStatus.breach_duration_hours,
            sla_hours: task.sla_hours,
            active_time_hours: slaStatus.active_time_hours,
            severity: slaStatus.hours_overdue > 24 ? 'critical' : slaStatus.hours_overdue > 8 ? 'high' : 'medium',
            notification_type: slaStatus.hours_overdue > 48 ? 'escalate_to_pm' : 'notify_owner'
          };

          // Update task breach status
          await db('tasks')
            .where('id', task.id)
            .update({
              sla_breached: true,
              updated_at: new Date()
            });

          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      throw new Error(`Error checking SLA breaches: ${error.message}`);
    }
  }

  /**
   * Get SLA metrics for dashboard
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} SLA metrics
   */
  static async getSLAMetrics(projectId) {
    try {
      const tasks = await db('tasks')
        .where('project_id', projectId)
        .where('sla_hours', '>', 0);

      const metrics = {
        total_tracked: tasks.length,
        breached: 0,
        at_risk: 0,
        avg_completion_hours: 0,
        breach_distribution: {
          less_than_4h: 0,
          between_4h_8h: 0,
          between_8h_24h: 0,
          between_24h_48h: 0,
          more_than_48h: 0
        }
      };

      let totalCompletionHours = 0;
      let completedCount = 0;

      for (const task of tasks) {
        const slaStatus = this.calculateSLAStatus(task);
        
        if (slaStatus.is_breached) {
          metrics.breached++;
          
          // Categorize breach duration
          const hoursOverdue = slaStatus.hours_overdue;
          if (hoursOverdue < 4) {
            metrics.breach_distribution.less_than_4h++;
          } else if (hoursOverdue <= 8) {
            metrics.breach_distribution.between_4h_8h++;
          } else if (hoursOverdue <= 24) {
            metrics.breach_distribution.between_8h_24h++;
          } else if (hoursOverdue <= 48) {
            metrics.breach_distribution.between_24h_48h++;
          } else {
            metrics.breach_distribution.more_than_48h++;
          }
        }

        if (task.status === 'at_risk') {
          metrics.at_risk++;
        }

        if (task.status === 'completed' && task.actual_hours) {
          totalCompletionHours += task.actual_hours;
          completedCount++;
        }
      }

      metrics.avg_completion_hours = completedCount > 0 ? totalCompletionHours / completedCount : 0;

      return metrics;
    } catch (error) {
      throw new Error(`Error calculating SLA metrics: ${error.message}`);
    }
  }

  /**
   * Log SLA events for audit trail
   * @param {number} taskId - Task ID
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  static async logSLAEvent(taskId, eventType, eventData) {
    try {
      await db('audit_logs').insert({
        entity_type: 'task',
        entity_id: taskId,
        action: `sla_${eventType}`,
        new_values: eventData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging SLA event:', error);
    }
  }

  /**
   * Validate SLA setup before task creation/update
   * @param {Object} taskData - Task data
   * @throws {ValidationError} If SLA setup is invalid
   */
  static validateSLASetup(taskData) {
    if (taskData.sla_hours && taskData.sla_hours < 0) {
      throw new ValidationError('SLA hours must be positive.');
    }

    if (taskData.sla_hours && taskData.sla_hours > 168) { // 24 * 7 = 1 week max
      throw new ValidationError('SLA hours cannot exceed 168 hours (1 week).');
    }

    return true;
  }

  /**
   * Get SLA performance by user
   * @param {number} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} User SLA performance
   */
  static async getUserSLAPerformance(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const tasks = await db('tasks')
        .where('owner_id', userId)
        .where('created_at', '>=', startDateStr)
        .where('sla_hours', '>', 0);

      const performance = {
        total_tasks: tasks.length,
        breached_tasks: 0,
        avg_completion_ratio: 0,
        breach_rate: 0,
        sla_compliance: 0
      };

      let completedWithinSLA = 0;
      let totalCompleted = 0;

      for (const task of tasks) {
        const slaStatus = this.calculateSLAStatus(task);
        
        if (slaStatus.is_breached) {
          performance.breached_tasks++;
        }

        if (task.status === 'completed') {
          totalCompleted++;
          if (!slaStatus.is_breached) {
            completedWithinSLA++;
          }
        }
      }

      performance.avg_completion_ratio = totalCompleted > 0 ? (completedWithinSLA / totalCompleted) * 100 : 0;
      performance.breach_rate = tasks.length > 0 ? (performance.breached_tasks / tasks.length) * 100 : 0;
      performance.sla_compliance = 100 - performance.breach_rate;

      return performance;
    } catch (error) {
      throw new Error(`Error calculating user SLA performance: ${error.message}`);
    }
  }
}

module.exports = SLAEngine;
