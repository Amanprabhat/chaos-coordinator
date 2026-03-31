const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Smart Notification System
 * Intelligent notifications with smart nudges and reminders
 */
class SmartNotificationSystem {
  /**
   * Create notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  static async createNotification(notificationData) {
    try {
      const { user_id, project_id, type, title, message, is_read } = notificationData;
      
      if (!user_id || !project_id || !type || !title || !message) {
        throw new ValidationError('User ID, project ID, type, title, and message are required');
      }

      const [notification] = await db('notifications')
        .insert({
          user_id,
          project_id,
          type,
          title,
          message,
          is_read: is_read || false,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // Send real-time notification if needed
      if (notificationData.send_immediately) {
        await this.sendRealTimeNotification(notification);
      }

      return notification;
    } catch (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  /**
   * Send real-time notification (WebSocket integration ready)
   * @param {Object} notification - Notification to send
   */
  static async sendRealTimeNotification(notification) {
    try {
      // In production, this would integrate with WebSocket
      console.log(`🔔 Real-time notification: ${notification.title} for user ${notification.user_id}`);
      
      // For now, just log to console
      // In production, this would emit via WebSocket to connected clients
      return true;
    } catch (error) {
      console.error('Error sending real-time notification:', error);
      return false;
    }
  }

  /**
   * Get user notifications
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of notifications
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const { limit = 50, unread_only = false, type } = options;
      
      let query = db('notifications')
        .where('user_id', userId)
        .orderBy('created_at', 'DESC')
        .limit(limit);

      if (unread_only) {
        query = query.andWhere('is_read', false);
      }

      if (type) {
        query = query.andWhere('type', type);
      }

      const notifications = await query;

      // Mark notifications as read if requested
      if (options.mark_as_read && notifications.length > 0) {
        const notificationIds = notifications.map(n => n.id);
        await db('notifications')
          .whereIn('id', notificationIds)
          .update({
            is_read: true,
            updated_at: new Date()
          });
      }

      return notifications;
    } catch (error) {
      throw new Error(`Error fetching user notifications: ${error.message}`);
    }
  }

  /**
   * Get project notifications
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of project notifications
   */
  static async getProjectNotifications(projectId, options = {}) {
    try {
      const { limit = 50, type } = options;
      
      let query = db('notifications')
        .where('project_id', projectId)
        .orderBy('created_at', 'DESC')
        .limit(limit);

      if (type) {
        query = query.andWhere('type', type);
      }

      const notifications = await query;

      return notifications;
    } catch (error) {
      throw new Error(`Error fetching project notifications: ${error.message}`);
    }
  }

  /**
   * Create smart notification based on project events
   * @param {number} projectId - Project ID
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  static async createSmartNotification(projectId, eventType, eventData) {
    try {
      let notification = null;

      switch (eventType) {
        case 'task_assigned':
          notification = await this.createNotification({
            user_id: eventData.owner_id,
            project_id: projectId,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned: ${eventData.task_title}`,
            send_immediately: true
          });
          break;

        case 'task_overdue':
          notification = await this.createNotification({
            user_id: eventData.owner_id,
            project_id: projectId,
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `Task "${eventData.task_title}" is overdue by ${eventData.hours_overdue} hours`,
            send_immediately: true
          });
          break;

        case 'milestone_completed':
          notification = await this.createNotification({
            user_id: eventData.owner_id,
            project_id: projectId,
            type: 'milestone_completed',
            title: 'Milestone Completed',
            message: `Milestone "${eventData.milestone_name}" has been completed`,
            send_immediately: true
          });
          break;

        case 'risk_escalated':
          notification = await this.createNotification({
            user_id: eventData.owner_id,
            project_id: projectId,
            type: 'risk_escalated',
            title: 'Risk Escalated',
            message: `Critical risk escalated: ${eventData.risk_description}`,
            send_immediately: true
          });
          break;

        case 'project_stuck':
          notification = await this.createNotification({
            user_id: eventData.owner_id,
            project_id: projectId,
            type: 'project_stuck',
            title: 'Project Stuck',
            message: `Project "${eventData.project_name}" has been stuck in "${eventData.current_stage}" stage for ${eventData.days_stuck} days`,
            send_immediately: true
          });
          break;

        default:
          // Generic notification
          notification = await this.createNotification({
            user_id: eventData.owner_id || eventData.project_owner_id,
            project_id: projectId,
            type: 'project_update',
            title: 'Project Update',
            message: JSON.stringify(eventData),
            send_immediately: false
          });
      }

      return notification;
    } catch (error) {
      throw new Error(`Error creating smart notification: ${error.message}`);
    }
  }

  /**
   * Get unread notification count for user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  static async getUnreadCount(userId) {
    try {
      const result = await db('notifications')
        .where('user_id', userId)
        .where('is_read', false)
        .count('* as count');

      return result[0].count;
    } catch (error) {
      throw new Error(`Error getting unread count: ${error.message}`);
    }
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async markAsRead(notificationId, userId) {
    try {
      const [result] = await db('notifications')
        .where('id', notificationId)
        .andWhere('user_id', userId)
        .update({
          is_read: true,
          updated_at: new Date()
        });

      return result > 0;
    } catch (error) {
      throw new Error(`Error marking notification as read: ${error.message}`);
    }
  }
}

module.exports = SmartNotificationSystem;
