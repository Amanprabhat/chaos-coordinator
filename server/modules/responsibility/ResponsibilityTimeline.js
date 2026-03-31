const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Responsibility Timeline System
 * Track ownership history and accountability across the project
 */
class ResponsibilityTimeline {
  /**
   * Log responsibility change
   * @param {Object} logData - Responsibility log data
   * @returns {Promise<Object>} Created log entry
   */
  static async logResponsibilityChange(logData) {
    try {
      const {
        entity_type,
        entity_id,
        previous_owner,
        new_owner,
        changed_by,
        change_reason,
        context = {}
      } = logData;

      // Validate required fields
      if (!entity_type || !entity_id || !new_owner || !changed_by) {
        throw new ValidationError('Entity type, entity ID, new owner, and changed by are required');
      }

      // Validate entity type
      const validEntityTypes = ['task', 'milestone', 'project', 'risk'];
      if (!validEntityTypes.includes(entity_type)) {
        throw new ValidationError('Invalid entity type');
      }

      // Validate users exist
      const newOwnerUser = await db('users').where('id', new_owner).first();
      if (!newOwnerUser) {
        throw new ValidationError('New owner not found');
      }

      if (previous_owner) {
        const previousOwnerUser = await db('users').where('id', previous_owner).first();
        if (!previousOwnerUser) {
          throw new ValidationError('Previous owner not found');
        }
      }

      const changedByUser = await db('users').where('id', changed_by).first();
      if (!changedByUser) {
        throw new ValidationError('Changed by user not found');
      }

      // Validate entity exists
      let entityExists = false;
      switch (entity_type) {
        case 'task':
          entityExists = await db('tasks').where('id', entity_id).first();
          break;
        case 'milestone':
          entityExists = await db('milestones').where('id', entity_id).first();
          break;
        case 'project':
          entityExists = await db('projects').where('id', entity_id).first();
          break;
        case 'risk':
          entityExists = await db('risks').where('id', entity_id).first();
          break;
      }

      if (!entityExists) {
        throw new ValidationError('Entity not found');
      }

      const [logEntry] = await db('responsibility_logs')
        .insert({
          entity_type,
          entity_id,
          previous_owner,
          new_owner,
          changed_at: new Date(),
          changed_by,
          change_reason,
          context: JSON.stringify(context),
          created_at: new Date()
        })
        .returning('*');

      // Log the responsibility change
      await db('audit_logs').insert({
        entity_type: 'responsibility',
        entity_id: entity_id,
        action: 'responsibility_changed',
        old_values: { previous_owner },
        new_values: { new_owner, entity_type },
        performed_by: changed_by,
        timestamp: new Date()
      });

      return logEntry;
    } catch (error) {
      throw new Error(`Error logging responsibility change: ${error.message}`);
    }
  }

  /**
   * Get responsibility timeline for an entity
   * @param {string} entityType - Entity type
   * @param {number} entityId - Entity ID
   * @returns {Promise<Array>} Responsibility timeline
   */
  static async getResponsibilityTimeline(entityType, entityId) {
    try {
      const timeline = await db('responsibility_logs')
        .select(
          'responsibility_logs.*',
          'previous_user.name as previous_owner_name',
          'previous_user.email as previous_owner_email',
          'new_user.name as new_owner_name',
          'new_user.email as new_owner_email',
          'changed_user.name as changed_by_name',
          'changed_user.email as changed_by_email'
        )
        .leftJoin('users as previous_user', 'responsibility_logs.previous_owner', 'previous_user.id')
        .leftJoin('users as new_user', 'responsibility_logs.new_owner', 'new_user.id')
        .leftJoin('users as changed_user', 'responsibility_logs.changed_by', 'changed_user.id')
        .where('responsibility_logs.entity_type', entityType)
        .where('responsibility_logs.entity_id', entityId)
        .orderBy('responsibility_logs.changed_at', 'ASC');

      // Parse context for each entry
      for (const entry of timeline) {
        entry.context = JSON.parse(entry.context || '{}');
      }

      return timeline;
    } catch (error) {
      throw new Error(`Error getting responsibility timeline: ${error.message}`);
    }
  }

  /**
   * Get current responsibility for entities
   * @param {string} entityType - Entity type
   * @param {Array} entityIds - Array of entity IDs
   * @returns {Promise<Array>} Current responsibilities
   */
  static async getCurrentResponsibilities(entityType, entityIds) {
    try {
      const responsibilities = [];

      for (const entityId of entityIds) {
        // Get the most recent responsibility log for each entity
        const latestLog = await db('responsibility_logs')
          .select(
            'responsibility_logs.*',
            'users.name as owner_name',
            'users.email as owner_email',
            'users.role as owner_role'
          )
          .join('users', 'responsibility_logs.new_owner', 'users.id')
          .where('responsibility_logs.entity_type', entityType)
          .where('responsibility_logs.entity_id', entityId)
          .orderBy('responsibility_logs.changed_at', 'DESC')
          .first();

        if (latestLog) {
          responsibilities.push({
            entity_type: entityType,
            entity_id: entityId,
            current_owner: latestLog.new_owner,
            owner_name: latestLog.owner_name,
            owner_email: latestLog.owner_email,
            owner_role: latestLog.owner_role,
            last_changed: latestLog.changed_at,
            changed_by: latestLog.changed_by,
            change_reason: latestLog.change_reason
          });
        }
      }

      return responsibilities;
    } catch (error) {
      throw new Error(`Error getting current responsibilities: ${error.message}`);
    }
  }

  /**
   * Get responsibility analytics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Responsibility analytics
   */
  static async getResponsibilityAnalytics(projectId) {
    try {
      // Get responsibility changes by entity type
      const changesByEntityType = await db('responsibility_logs')
        .select('entity_type')
        .count('* as count')
        .join('tasks', 'responsibility_logs.entity_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .where('responsibility_logs.entity_type', 'task')
        .groupBy('entity_type')
        .orderBy('count', 'desc');

      // Get top users with most responsibility changes
      const topUsers = await db('responsibility_logs')
        .select(
          'users.name',
          'users.email',
          'users.role',
          db.raw('COUNT(*) as change_count'),
          db.raw('COUNT(DISTINCT responsibility_logs.entity_id) as entity_count')
        )
        .join('users', 'responsibility_logs.new_owner', 'users.id')
        .join('tasks', 'responsibility_logs.entity_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .where('responsibility_logs.entity_type', 'task')
        .groupBy('users.id', 'users.name', 'users.email', 'users.role')
        .orderBy('change_count', 'desc')
        .limit(10);

      // Get responsibility changes by time period
      const changesByMonth = await db('responsibility_logs')
        .select(
          db.raw('DATE_TRUNC(\'month\', changed_at) as month'),
          db.raw('COUNT(*) as count')
        )
        .join('tasks', 'responsibility_logs.entity_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .where('responsibility_logs.entity_type', 'task')
        .groupBy(db.raw('DATE_TRUNC(\'month\', changed_at)'))
        .orderBy(db.raw('DATE_TRUNC(\'month\', changed_at)'), 'desc')
        .limit(12);

      // Get orphaned entities (entities without current owners)
      const orphanedEntities = await this.getOrphanedEntities(projectId);

      // Get responsibility stability score
      const stabilityScore = await this.calculateResponsibilityStability(projectId);

      return {
        project_id: projectId,
        summary: {
          total_changes: changesByEntityType.reduce((sum, item) => sum + item.count, 0),
          by_entity_type: changesByEntityType,
          by_month: changesByMonth,
          top_users: topUsers,
          orphaned_entities: orphanedEntities,
          stability_score: stabilityScore
        }
      };
    } catch (error) {
      throw new Error(`Error getting responsibility analytics: ${error.message}`);
    }
  }

  /**
   * Get accountability timeline for a user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User accountability timeline
   */
  static async getUserAccountabilityTimeline(userId, options = {}) {
    try {
      const { 
        start_date, 
        end_date, 
        entity_type,
        limit = 100 
      } = options;

      // Get entities where user was responsible
      let query = db('responsibility_logs')
        .select(
          'responsibility_logs.*',
          'tasks.title as task_title',
          'tasks.project_id',
          'projects.name as project_name',
          'milestones.title as milestone_title',
          'risks.title as risk_title'
        )
        .leftJoin('tasks', function() {
          this.on('responsibility_logs.entity_id', '=', 'tasks.id')
            .andOn('responsibility_logs.entity_type', '=', db.raw('?', ['task']))
        })
        .leftJoin('projects', 'tasks.project_id', 'projects.id')
        .leftJoin('milestones', function() {
          this.on('responsibility_logs.entity_id', '=', 'milestones.id')
            .andOn('responsibility_logs.entity_type', '=', db.raw('?', ['milestone']))
        })
        .leftJoin('risks', function() {
          this.on('responsibility_logs.entity_id', '=', 'risks.id')
            .andOn('responsibility_logs.entity_type', '=', db.raw('?', ['risk']))
        })
        .where('responsibility_logs.new_owner', userId)
        .orderBy('responsibility_logs.changed_at', 'DESC')
        .limit(limit);

      if (start_date) {
        query = query.andWhere('responsibility_logs.changed_at', '>=', start_date);
      }

      if (end_date) {
        query = query.andWhere('responsibility_logs.changed_at', '<=', end_date);
      }

      if (entity_type) {
        query = query.andWhere('responsibility_logs.entity_type', entity_type);
      }

      const timeline = await query;

      // Group by entity type for better organization
      const groupedTimeline = timeline.reduce((acc, entry) => {
        if (!acc[entry.entity_type]) {
          acc[entry.entity_type] = [];
        }
        acc[entry.entity_type].push(entry);
        return acc;
      }, {});

      return {
        user_id: userId,
        timeline: groupedTimeline,
        summary: {
          total_responsibilities: timeline.length,
          by_entity_type: Object.keys(groupedTimeline).reduce((acc, type) => {
            acc[type] = groupedTimeline[type].length;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      throw new Error(`Error getting user accountability timeline: ${error.message}`);
    }
  }

  /**
   * Get orphaned entities (without current owners)
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Orphaned entities
   */
  static async getOrphanedEntities(projectId) {
    try {
      const orphaned = [];

      // Check for orphaned tasks
      const orphanedTasks = await db('tasks')
        .select(
          'tasks.id',
          'tasks.title',
          'tasks.project_id',
          'tasks.status',
          'tasks.due_date'
        )
        .where('tasks.project_id', projectId)
        .whereNull('tasks.owner_id');

      orphaned.push(...orphanedTasks.map(task => ({
        entity_type: 'task',
        entity_id: task.id,
        title: task.title,
        status: task.status,
        due_date: task.due_date,
        orphaned_since: task.created_at
      })));

      // Check for orphaned milestones
      const orphanedMilestones = await db('milestones')
        .select(
          'milestones.id',
          'milestones.title',
          'milestones.project_id',
          'milestones.status',
          'milestones.due_date'
        )
        .where('milestones.project_id', projectId)
        .whereNull('milestones.owner_id');

      orphaned.push(...orphanedMilestones.map(milestone => ({
        entity_type: 'milestone',
        entity_id: milestone.id,
        title: milestone.title,
        status: milestone.status,
        due_date: milestone.due_date,
        orphaned_since: milestone.created_at
      })));

      // Check for orphaned risks
      const orphanedRisks = await db('risks')
        .select(
          'risks.id',
          'risks.title',
          'risks.project_id',
          'risks.status',
          'risks.severity'
        )
        .where('risks.project_id', projectId)
        .whereNull('risks.owner_id');

      orphaned.push(...orphanedRisks.map(risk => ({
        entity_type: 'risk',
        entity_id: risk.id,
        title: risk.title,
        status: risk.status,
        severity: risk.severity,
        orphaned_since: risk.identified_date
      })));

      return orphaned;
    } catch (error) {
      throw new Error(`Error getting orphaned entities: ${error.message}`);
    }
  }

  /**
   * Calculate responsibility stability score
   * @param {number} projectId - Project ID
   * @returns {Promise<number>} Stability score (0-100)
   */
  static async calculateResponsibilityStability(projectId) {
    try {
      // Get all responsibility changes for project tasks
      const totalChanges = await db('responsibility_logs')
        .count('* as count')
        .join('tasks', 'responsibility_logs.entity_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .where('responsibility_logs.entity_type', 'task')
        .first();

      // Get total number of tasks
      const totalTasks = await db('tasks')
        .count('* as count')
        .where('project_id', projectId)
        .first();

      // Calculate stability score
      // Higher score = fewer changes per task
      const changesPerTask = totalTasks.count > 0 ? totalChanges.count / totalTasks.count : 0;
      let stabilityScore = 100;

      // Deduct points for high change frequency
      if (changesPerTask > 3) {
        stabilityScore -= 30;
      } else if (changesPerTask > 2) {
        stabilityScore -= 20;
      } else if (changesPerTask > 1) {
        stabilityScore -= 10;
      }

      return Math.max(0, Math.min(100, stabilityScore));
    } catch (error) {
      return 50; // Default score
    }
  }

  /**
   * Get responsibility handover recommendations
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Handover recommendations
   */
  static async getHandoverRecommendations(projectId) {
    try {
      const recommendations = [];

      // Get users with high responsibility load
      const userLoads = await db('responsibility_logs')
        .select(
          'users.name',
          'users.email',
          db.raw('COUNT(DISTINCT responsibility_logs.entity_id) as current_responsibilities')
        )
        .join('users', 'responsibility_logs.new_owner', 'users.id')
        .join('tasks', 'responsibility_logs.entity_id', 'tasks.id')
        .where('tasks.project_id', projectId)
        .where('responsibility_logs.entity_type', 'task')
        .where('tasks.status', 'in', ['todo', 'in_progress'])
        .groupBy('users.id', 'users.name', 'users.email')
        .orderBy('current_responsibilities', 'desc')
        .limit(5);

      // Get users with low responsibility load
      const availableUsers = await db('users')
        .select('users.id', 'users.name', 'users.email', 'users.role')
        .where('users.is_active', true)
        .whereNotIn('users.id', userLoads.map(u => u.id))
        .limit(5);

      // Generate recommendations
      for (const userLoad of userLoads) {
        if (userLoad.current_responsibilities > 10) {
          recommendations.push({
            type: 'overload',
            user: userLoad,
            message: `${userLoad.name} has ${userLoad.current_responsibilities} active responsibilities`,
            suggested_action: 'Consider redistributing some responsibilities'
          });
        }
      }

      // Check for users with no responsibilities
      if (availableUsers.length > 0) {
        recommendations.push({
          type: 'underutilized',
          users: availableUsers,
          message: `${availableUsers.length} users have no current responsibilities`,
          suggested_action: 'Consider assigning responsibilities to available team members'
        });
      }

      return recommendations;
    } catch (error) {
      throw new Error(`Error getting handover recommendations: ${error.message}`);
    }
  }
}

module.exports = ResponsibilityTimeline;
