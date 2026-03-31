const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Decision Tracking System
 * Critical for tracking key project decisions and preventing misalignment
 */
class DecisionTrackingSystem {
  /**
   * Create a new decision record
   * @param {Object} decisionData - Decision data
   * @returns {Promise<Object>} Created decision
   */
  static async createDecision(decisionData) {
    try {
      const {
        project_id,
        title,
        description,
        taken_by,
        stakeholders = [],
        decision_date,
        impact_area,
        related_task_id,
        justification,
        alternatives_considered
      } = decisionData;

      // Validate required fields
      if (!project_id || !title || !description || !taken_by || !impact_area) {
        throw new ValidationError('Project ID, title, description, taken_by, and impact area are required');
      }

      // Validate impact area
      const validImpactAreas = ['scope', 'timeline', 'tech', 'process', 'budget', 'quality'];
      if (!validImpactAreas.includes(impact_area)) {
        throw new ValidationError('Invalid impact area');
      }

      // Validate stakeholders exist
      if (stakeholders.length > 0) {
        for (const stakeholderId of stakeholders) {
          const stakeholder = await db('users').where('id', stakeholderId).first();
          if (!stakeholder) {
            throw new ValidationError(`Stakeholder with ID ${stakeholderId} not found`);
          }
        }
      }

      // Validate related task if provided
      if (related_task_id) {
        const task = await db('tasks').where('id', related_task_id).first();
        if (!task) {
          throw new ValidationError('Related task not found');
        }
      }

      const [newDecision] = await db('decisions')
        .insert({
          project_id,
          title,
          description,
          taken_by,
          stakeholders,
          decision_date: decision_date || new Date(),
          impact_area,
          related_task_id,
          justification,
          alternatives_considered,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // Log the decision
      await db('audit_logs').insert({
        entity_type: 'decision',
        entity_id: newDecision.id,
        action: 'decision_created',
        new_values: {
          title: newDecision.title,
          impact_area: newDecision.impact_area,
          stakeholders_count: stakeholders.length
        },
        performed_by: taken_by,
        timestamp: new Date()
      });

      // Notify stakeholders
      if (stakeholders.length > 0) {
        await this.notifyStakeholders(newDecision, stakeholders);
      }

      return newDecision;
    } catch (error) {
      throw new Error(`Error creating decision: ${error.message}`);
    }
  }

  /**
   * Get decisions for a project
   * @param {number} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of decisions
   */
  static async getProjectDecisions(projectId, options = {}) {
    try {
      const { 
        limit = 50, 
        impact_area, 
        decision_status, 
        start_date, 
        end_date,
        include_stakeholders = true 
      } = options;

      let query = db('decisions')
        .select(
          'decisions.*',
          'users.name as decision_maker_name',
          'users.email as decision_maker_email',
          'users.role as decision_maker_role'
        )
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .orderBy('decisions.decision_date', 'DESC')
        .limit(limit);

      if (impact_area) {
        query = query.andWhere('decisions.impact_area', impact_area);
      }

      if (decision_status) {
        query = query.andWhere('decisions.decision_status', decision_status);
      }

      if (start_date) {
        query = query.andWhere('decisions.decision_date', '>=', start_date);
      }

      if (end_date) {
        query = query.andWhere('decisions.decision_date', '<=', end_date);
      }

      const decisions = await query;

      // Get stakeholder information if requested
      if (include_stakeholders) {
        for (const decision of decisions) {
          if (decision.stakeholders && decision.stakeholders.length > 0) {
            decision.stakeholder_details = await db('users')
              .select('id', 'name', 'email', 'role')
              .whereIn('id', decision.stakeholders);
          } else {
            decision.stakeholder_details = [];
          }
        }
      }

      return decisions;
    } catch (error) {
      throw new Error(`Error getting project decisions: ${error.message}`);
    }
  }

  /**
   * Update decision status
   * @param {number} decisionId - Decision ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated decision
   */
  static async updateDecision(decisionId, updateData) {
    try {
      const { decision_status, justification, updated_by } = updateData;

      if (!decision_status || !updated_by) {
        throw new ValidationError('Decision status and updated by are required');
      }

      const validStatuses = ['active', 'reversed', 'superseded', 'implemented'];
      if (!validStatuses.includes(decision_status)) {
        throw new ValidationError('Invalid decision status');
      }

      const [updatedDecision] = await db('decisions')
        .where('id', decisionId)
        .update({
          decision_status,
          justification,
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedDecision) {
        throw new ValidationError('Decision not found');
      }

      // Log the update
      await db('audit_logs').insert({
        entity_type: 'decision',
        entity_id: decisionId,
        action: 'decision_updated',
        old_values: { decision_status: 'active' },
        new_values: { decision_status },
        performed_by: updated_by,
        timestamp: new Date()
      });

      return updatedDecision;
    } catch (error) {
      throw new Error(`Error updating decision: ${error.message}`);
    }
  }

  /**
   * Get decision analytics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Decision analytics
   */
  static async getDecisionAnalytics(projectId) {
    try {
      // Get decisions by impact area
      const decisionsByImpact = await db('decisions')
        .select('impact_area')
        .count('* as count')
        .where('project_id', projectId)
        .groupBy('impact_area')
        .orderBy('count', 'desc');

      // Get decisions by status
      const decisionsByStatus = await db('decisions')
        .select('decision_status')
        .count('* as count')
        .where('project_id', projectId)
        .groupBy('decision_status')
        .orderBy('count', 'desc');

      // Get decisions by time period
      const decisionsByMonth = await db('decisions')
        .select(
          db.raw('DATE_TRUNC(\'month\', decision_date) as month'),
          db.raw('COUNT(*) as count')
        )
        .where('project_id', projectId)
        .groupBy(db.raw('DATE_TRUNC(\'month\', decision_date)'))
        .orderBy(db.raw('DATE_TRUNC(\'month\', decision_date)'), 'desc')
        .limit(12);

      // Get decision makers
      const topDecisionMakers = await db('decisions')
        .select(
          'users.name',
          'users.email',
          db.raw('COUNT(*) as decision_count')
        )
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .groupBy('users.id', 'users.name', 'users.email')
        .orderBy('decision_count', 'desc')
        .limit(5);

      // Get recent decisions
      const recentDecisions = await db('decisions')
        .select(
          'decisions.*',
          'users.name as decision_maker_name'
        )
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .orderBy('decisions.decision_date', 'desc')
        .limit(10);

      return {
        project_id: projectId,
        summary: {
          total_decisions: decisionsByImpact.reduce((sum, item) => sum + item.count, 0),
          by_impact_area: decisionsByImpact,
          by_status: decisionsByStatus,
          by_month: decisionsByMonth,
          top_decision_makers: topDecisionMakers
        },
        recent_decisions: recentDecisions,
        decision_maturity_score: this.calculateDecisionMaturityScore(decisionsByImpact, decisionsByStatus)
      };
    } catch (error) {
      throw new Error(`Error getting decision analytics: ${error.message}`);
    }
  }

  /**
   * Get decision conflicts or inconsistencies
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of potential conflicts
   */
  static async getDecisionConflicts(projectId) {
    try {
      const conflicts = [];

      // Check for reversed decisions that might conflict with current ones
      const reversedDecisions = await db('decisions')
        .select('decisions.*', 'users.name as decision_maker_name')
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .where('decisions.decision_status', 'reversed')
        .orderBy('decisions.decision_date', 'desc');

      for (const reversed of reversedDecisions) {
        // Look for active decisions in the same impact area
        const conflictingDecisions = await db('decisions')
          .select('decisions.*', 'users.name as decision_maker_name')
          .join('users', 'decisions.taken_by', 'users.id')
          .where('decisions.project_id', projectId)
          .where('decisions.impact_area', reversed.impact_area)
          .where('decisions.decision_status', 'active')
          .where('decisions.decision_date', '>', reversed.decision_date);

        if (conflictingDecisions.length > 0) {
          conflicts.push({
            type: 'reversed_conflict',
            reversed_decision: reversed,
            conflicting_decisions: conflictingDecisions,
            description: `Reversed decision in ${reversed.impact_area} conflicts with active decisions`
          });
        }
      }

      // Check for decisions without proper stakeholder involvement
      const decisionsWithoutStakeholders = await db('decisions')
        .select('decisions.*', 'users.name as decision_maker_name')
        .join('users', 'decisions.taken_by', 'users.id')
        .where('decisions.project_id', projectId)
        .where('decisions.stakeholders', '{}')
        .where('decisions.impact_area', 'in', ['scope', 'timeline', 'budget'])
        .orderBy('decisions.decision_date', 'desc');

      for (const decision of decisionsWithoutStakeholders) {
        conflicts.push({
          type: 'missing_stakeholders',
          decision: decision,
          description: `Critical decision in ${decision.impact_area} lacks stakeholder involvement`
        });
      }

      return conflicts;
    } catch (error) {
      throw new Error(`Error getting decision conflicts: ${error.message}`);
    }
  }

  /**
   * Notify stakeholders about decisions
   * @param {Object} decision - Decision object
   * @param {Array} stakeholderIds - Array of stakeholder IDs
   */
  static async notifyStakeholders(decision, stakeholderIds) {
    try {
      for (const stakeholderId of stakeholderIds) {
        await db('notifications').insert({
          user_id: stakeholderId,
          project_id: decision.project_id,
          type: 'decision_made',
          title: 'New Decision Made',
          message: `A new decision has been made: "${decision.title}" in ${decision.impact_area}`,
          send_immediately: true,
          created_at: new Date()
        });
      }
    } catch (error) {
      console.error('Error notifying stakeholders:', error);
    }
  }

  /**
   * Calculate decision maturity score
   * @param {Array} decisionsByImpact - Decisions grouped by impact area
   * @param {Array} decisionsByStatus - Decisions grouped by status
   * @returns {number} Maturity score (0-100)
   */
  static calculateDecisionMaturityScore(decisionsByImpact, decisionsByStatus) {
    try {
      let score = 50; // Base score

      // Bonus for decisions across multiple impact areas
      if (decisionsByImpact.length >= 4) {
        score += 20;
      } else if (decisionsByImpact.length >= 2) {
        score += 10;
      }

      // Bonus for having implemented decisions
      const implementedCount = decisionsByStatus.find(s => s.decision_status === 'implemented')?.count || 0;
      const totalCount = decisionsByStatus.reduce((sum, s) => sum + s.count, 0);
      
      if (totalCount > 0) {
        const implementationRate = (implementedCount / totalCount) * 100;
        score += (implementationRate / 100) * 30;
      }

      // Deduction for too many reversed decisions
      const reversedCount = decisionsByStatus.find(s => s.decision_status === 'reversed')?.count || 0;
      if (reversedCount > totalCount * 0.2) {
        score -= 15;
      }

      return Math.min(100, Math.max(0, score));
    } catch (error) {
      return 50; // Default score
    }
  }
}

module.exports = DecisionTrackingSystem;
