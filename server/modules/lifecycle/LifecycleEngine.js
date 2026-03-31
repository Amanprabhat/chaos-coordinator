const db = require('../database/connection');
const { ValidationError } = require('joi');

/**
 * Lifecycle Engine
 * Manages project lifecycle stage transitions with validation rules
 */
class LifecycleEngine {
  /**
   * Get all lifecycle stages in order
   * @returns {Promise<Array>} Array of lifecycle stages
   */
  static async getStages() {
    try {
      const stages = await db('lifecycle_stages')
        .orderBy('display_order', 'asc');
      return stages;
    } catch (error) {
      throw new Error('Error fetching lifecycle stages');
    }
  }

  /**
   * Get current stage of a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Current stage information
   */
  static async getCurrentStage(projectId) {
    try {
      const stage = await db('projects')
        .select(
          'projects.current_stage_id',
          'lifecycle_stages.name as stage_name',
          'lifecycle_stages.display_order',
          'lifecycle_stages.description'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.id', projectId)
        .first();

      if (!stage) {
        throw new ValidationError('Project not found or has no current stage');
      }

      return stage;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Error fetching current stage');
    }
  }

  /**
   * Check if project can transition to next stage
   * @param {number} projectId - Project ID
   * @param {number} targetStageId - Target stage ID
   * @returns {Promise<Object>} Validation result with reasons
   */
  static async canTransitionToStage(projectId, targetStageId) {
    try {
      const result = {
        canTransition: true,
        reasons: [],
        blockers: []
      };

      // Get current project and stage information
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage_name',
          'lifecycle_stages.display_order as current_stage_order'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      // Get target stage information
      const targetStage = await db('lifecycle_stages')
        .where('id', targetStageId)
        .first();

      if (!targetStage) {
        throw new ValidationError('Target stage not found');
      }

      // Check if transition is forward (not backward)
      if (targetStage.display_order <= project.current_stage_order) {
        result.canTransition = false;
        result.blockers.push('Can only transition forward to next stage');
        return result;
      }

      // Check if it's the immediate next stage
      const nextStageOrder = project.current_stage_order + 1;
      if (targetStage.display_order !== nextStageOrder) {
        result.canTransition = false;
        result.blockers.push('Can only transition to immediate next stage');
        return result;
      }

      // Check for open critical risks
      const criticalRisks = await db('risks')
        .where({
          project_id: projectId,
          severity: 'critical',
          status: 'open'
        });

      if (criticalRisks.length > 0) {
        result.canTransition = false;
        result.blockers.push(`${criticalRisks.length} critical risk(s) must be resolved before stage transition`);
        result.reasons.push('Critical risks block stage transition');
      }

      // Check for pending handover notes for current stage
      const currentStageName = project.current_stage_name.toLowerCase();
      const pendingHandovers = await db('handover_notes')
        .where({
          project_id: projectId,
          checklist_completed: false
        })
        .whereRaw('LOWER(from_role) = ?', [currentStageName]);

      if (pendingHandovers.length > 0) {
        result.canTransition = false;
        result.blockers.push(`${pendingHandovers.length} handover checklist(s) must be completed`);
        result.reasons.push('Pending handover checklists block stage transition');
      }

      // Check for overdue milestones in current stage
      const overdueMilestones = await db('milestones')
        .where({
          project_id: projectId,
          status: ['pending', 'in_progress']
        })
        .where('due_date', '<', new Date().toISOString().split('T')[0]);

      if (overdueMilestones.length > 0) {
        result.canTransition = false;
        result.blockers.push(`${overdueMilestones.length} overdue milestone(s) must be completed`);
        result.reasons.push('Overdue milestones block stage transition');
      }

      // Additional stage-specific checks
      await this.performStageSpecificChecks(projectId, currentStageName, result);

      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Error checking stage transition eligibility');
    }
  }

  /**
   * Perform stage-specific validation checks
   * @param {number} projectId - Project ID
   * @param {string} currentStageName - Current stage name
   * @param {Object} result - Validation result object
   */
  static async performStageSpecificChecks(projectId, currentStageName, result) {
    switch (currentStageName) {
      case 'lead':
        // Check if opportunity is qualified
        const hasQualifiedOpportunity = await this.checkLeadQualification(projectId);
        if (!hasQualifiedOpportunity) {
          result.canTransition = false;
          result.blockers.push('Lead qualification not completed');
        }
        break;

      case 'poc':
        // Check if POC success criteria are met
        const pocCompleted = await this.checkPOCCompletion(projectId);
        if (!pocCompleted) {
          result.canTransition = false;
          result.blockers.push('POC success criteria not met');
        }
        break;

      case 'implementation':
        // Check if implementation prerequisites are met
        const implementationReady = await this.checkImplementationReadiness(projectId);
        if (!implementationReady) {
          result.canTransition = false;
          result.blockers.push('Implementation prerequisites not met');
        }
        break;

      case 'go live':
        // Check if go-live checklist is complete
        const goLiveReady = await this.checkGoLiveReadiness(projectId);
        if (!goLiveReady) {
          result.canTransition = false;
          result.blockers.push('Go-live prerequisites not met');
        }
        break;

      case 'hypercare':
        // No specific checks for hypercare (final stage)
        break;
    }
  }

  /**
   * Transition project to next stage
   * @param {number} projectId - Project ID
   * @param {number} requestedBy - User ID requesting transition
   * @returns {Promise<Object>} Updated project information
   */
  static async transitionToNextStage(projectId, requestedBy) {
    try {
      // Get current stage
      const currentStage = await this.getCurrentStage(projectId);
      
      // Get next stage
      const nextStage = await db('lifecycle_stages')
        .where('display_order', currentStage.display_order + 1)
        .first();

      if (!nextStage) {
        throw new ValidationError('Project is already in the final stage');
      }

      // Check if transition is allowed
      const canTransition = await this.canTransitionToStage(projectId, nextStage.id);
      
      if (!canTransition.canTransition) {
        throw new ValidationError(`Cannot transition to ${nextStage.name}: ${canTransition.blockers.join(', ')}`);
      }

      // Perform the transition
      const [updatedProject] = await db('projects')
        .where('id', projectId)
        .update({
          current_stage_id: nextStage.id,
          updated_at: new Date()
        })
        .returning('*');

      // Log the transition
      await this.logStageTransition(projectId, currentStage.id, nextStage.id, requestedBy);

      return updatedProject;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Error transitioning to next stage');
    }
  }

  /**
   * Log stage transition for audit trail
   * @param {number} projectId - Project ID
   * @param {number} fromStageId - From stage ID
   * @param {number} toStageId - To stage ID
   * @param {number} requestedBy - User ID who requested transition
   */
  static async logStageTransition(projectId, fromStageId, toStageId, requestedBy) {
    try {
      await db('activity_log').insert({
        project_id: projectId,
        action: 'stage_transition',
        details: JSON.stringify({
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          requested_by: requestedBy,
          timestamp: new Date()
        }),
        created_at: new Date()
      });
    } catch (error) {
      // Log error but don't throw - this is not critical
      console.error('Error logging stage transition:', error);
    }
  }

  // Helper methods for stage-specific checks
  static async checkLeadQualification(projectId) {
    // Check if project has qualified lead status
    const project = await db('projects')
      .where('id', projectId)
      .first();
    
    return project && project.status !== 'cancelled';
  }

  static async checkPOCCompletion(projectId) {
    // Check if POC milestones are completed
    const completedMilestones = await db('milestones')
      .where({
        project_id: projectId,
        status: 'completed'
      })
      .count('* as count');

    return completedMilestones[0].count > 0;
  }

  static async checkImplementationReadiness(projectId) {
    // Check if implementation prerequisites are met
    const hasImplementationPlan = await db('milestones')
      .where({
        project_id: projectId,
        status: 'completed'
      })
      .where('name', 'ilike', '%implementation%')
      .first();

    return !!hasImplementationPlan;
  }

  static async checkGoLiveReadiness(projectId) {
    // Check if go-live prerequisites are met
    const allTasksCompleted = await db('tasks')
      .where({
        project_id: projectId,
        status: 'completed'
      })
      .count('* as count');

    const totalTasks = await db('tasks')
      .where('project_id', projectId)
      .count('* as count');

    return allTasksCompleted[0].count === totalTasks[0].count;
  }
}

module.exports = LifecycleEngine;
