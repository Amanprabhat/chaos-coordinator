const db = require('../../database/connection');
const { ValidationError } = require('joi');
const OwnershipValidator = require('../auth/OwnershipValidatorEnhanced');

/**
 * Enhanced Lifecycle Engine
 * Strict lifecycle enforcement with real-world business rules
 */
class LifecycleEngine {
  /**
   * Get all lifecycle stages with enhanced properties
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
          'projects.*',
          'lifecycle_stages.name as stage_name',
          'lifecycle_stages.display_order',
          'lifecycle_stages.description',
          'lifecycle_stages.requires_handover',
          'lifecycle_stages.requires_knowledge_approval'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.id', projectId)
        .first();

      if (!stage) {
        throw new ValidationError('Project not found or has no current stage');
      }

      return stage;
    } catch (error) {
      throw new Error('Error fetching current stage');
    }
  }

  /**
   * Check if project can transition to next stage with strict validation
   * @param {number} projectId - Project ID
   * @param {number} targetStageId - Target stage ID
   * @returns {Promise<Object>} Validation result with detailed blockers
   */
  static async canTransitionToStage(projectId, targetStageId) {
    try {
      const result = {
        canTransition: true,
        reasons: [],
        blockers: [],
        critical_issues: [],
        warnings: []
      };

      // Get current project and stage information
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage_name',
          'lifecycle_stages.display_order as current_stage_order',
          'lifecycle_stages.requires_handover',
          'lifecycle_stages.requires_knowledge_approval'
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

      // Check if it's immediate next stage
      const nextStageOrder = project.current_stage_order + 1;
      if (targetStage.display_order !== nextStageOrder) {
        result.canTransition = false;
        result.blockers.push('Can only transition to immediate next stage');
        return result;
      }

      // HARD BLOCK 1: Check for tasks without owners
      const orphanedTasks = await db('tasks')
        .where({
          project_id: projectId,
          owner_id: null
        })
        .count('* as count');

      if (orphanedTasks[0].count > 0) {
        result.canTransition = false;
        result.critical_issues.push(`${orphanedTasks[0].count} task(s) without owners`);
        result.blockers.push('All tasks must have assigned owners before stage transition');
      }

      // HARD BLOCK 2: Check for tasks without accountable persons
      const unaccountableTasks = await db('tasks')
        .where({
          project_id: projectId,
          accountable_id: null
        })
        .count('* as count');

      if (unaccountableTasks[0].count > 0) {
        result.canTransition = false;
        result.critical_issues.push(`${unaccountableTasks[0].count} task(s) without accountable persons`);
        result.blockers.push('All tasks must have accountable persons assigned before stage transition');
      }

      // HARD BLOCK 3: Check for blocked milestones
      const blockedMilestones = await db('milestones')
        .where({
          project_id: projectId,
          status: 'blocked'
        })
        .count('* as count');

      if (blockedMilestones[0].count > 0) {
        result.canTransition = false;
        result.critical_issues.push(`${blockedMilestones[0].count} blocked milestone(s)`);
        result.blockers.push('All milestones must be unblocked before stage transition');
      }

      // HARD BLOCK 4: Check for open critical risks
      const criticalRisks = await db('risks')
        .where({
          project_id: projectId,
          severity: 'critical',
          status: 'open'
        })
        .count('* as count');

      if (criticalRisks[0].count > 0) {
        result.canTransition = false;
        result.critical_issues.push(`${criticalRisks[0].count} open critical risk(s)`);
        result.blockers.push('All critical risks must be resolved before stage transition');
      }

      // HARD BLOCK 5: Check for mandatory handover completion
      if (project.current_stage_name.toLowerCase() !== 'hypercare') { // Only check handover for non-final stages
        const pendingHandovers = await db('handover_notes')
          .where({
            project_id: projectId,
            checklist_completed: false
          })
          .count('* as count');

        if (pendingHandovers[0].count > 0) {
          result.canTransition = false;
          result.critical_issues.push(`${pendingHandovers[0].count} incomplete handover(s)`);
          result.blockers.push('All mandatory handovers must be completed before stage transition');
        }
      }

      // HARD BLOCK 6: Check for overdue milestones in current stage
      const today = new Date().toISOString().split('T')[0];
      const overdueMilestones = await db('milestones')
        .where({
          project_id: projectId,
          status: ['pending', 'in_progress'],
          due_date: ['<', today]
        })
        .count('* as count');

      if (overdueMilestones[0].count > 0) {
        result.canTransition = false;
        result.critical_issues.push(`${overdueMilestones[0].count} overdue milestone(s)`);
        result.blockers.push('All overdue milestones must be completed before stage transition');
      }

      // STAGE-SPECIFIC VALIDATIONS
      await this.performStageSpecificValidations(projectId, project, result);

      return result;
    } catch (error) {
      throw new Error('Error checking stage transition eligibility');
    }
  }

  /**
   * Perform stage-specific validation with strict rules
   * @param {number} projectId - Project ID
   * @param {Object} project - Project data
   * @param {Object} result - Validation result to update
   */
  static async performStageSpecificValidations(projectId, project, result) {
    const currentStageName = project.current_stage_name.toLowerCase();

    switch (currentStageName) {
      case 'lead':
        await this.validateLeadStage(projectId, result);
        break;

      case 'poc':
        await this.validatePOCStage(projectId, result);
        break;

      case 'implementation':
        await this.validateImplementationStage(projectId, result);
        break;

      case 'go live':
        await this.validateGoLiveStage(projectId, result);
        break;

      case 'hypercare':
        // Final stage - no specific validations needed
        break;
    }
  }

  /**
   * Validate Lead stage requirements
   * @param {number} projectId - Project ID
   * @param {Object} result - Validation result to update
   */
  static async validateLeadStage(projectId, result) {
    // Check if lead qualification is complete
    const hasQualifiedOpportunity = await db('projects')
      .where({
        id: projectId,
        status: 'active'
      })
      .first();

    if (!hasQualifiedOpportunity) {
      result.canTransition = false;
      result.blockers.push('Lead must be qualified and active to move to POC');
    }
  }

  /**
   * Validate POC stage requirements
   * @param {number} projectId - Project ID
   * @param {Object} result - Validation result to update
   */
  static async validatePOCStage(projectId, result) {
    // Check if POC milestones are completed
    const completedPOCMilestones = await db('milestones')
      .where({
        project_id: projectId,
        status: 'completed'
      })
      .whereRaw('LOWER(name) ILIKE ?', '%poc%')
      .count('* as count');

    if (completedPOCMilestones[0].count === 0) {
      result.canTransition = false;
      result.blockers.push('POC milestones must be completed before moving to Implementation');
    }
  }

  /**
   * Validate Implementation stage requirements
   * @param {number} projectId - Project ID
   * @param {Object} result - Validation result to update
   */
  static async validateImplementationStage(projectId, result) {
    // Check if implementation plan exists and is approved
    const implementationPlan = await db('knowledge_assets')
      .where({
        project_id: projectId,
        asset_type: 'guide',
        status: 'approved'
      })
      .whereRaw('LOWER(title) ILIKE ?', '%implementation%')
      .first();

    if (!implementationPlan) {
      result.canTransition = false;
      result.blockers.push('Implementation plan must be created and approved before moving to Go Live');
    }

    // Check if all critical and high risks are mitigated
    const unmitigatedRisks = await db('risks')
      .where({
        project_id: projectId,
        severity: ['critical', 'high'],
        status: ['open', 'mitigating']
      })
      .count('* as count');

    if (unmitigatedRisks[0].count > 0) {
      result.canTransition = false;
      result.blockers.push(`${unmitigatedRisks[0].count} high/critical risks must be mitigated before Go Live`);
    }
  }

  /**
   * Validate Go Live stage requirements
   * @param {number} projectId - Project ID
   * @param {Object} result - Validation result to update
   */
  static async validateGoLiveStage(projectId, result) {
    // Check knowledge readiness score
    const project = await db('projects')
      .select('knowledge_readiness_score')
      .where('id', projectId)
      .first();

    if (!project || project.knowledge_readiness_score < 80) {
      result.canTransition = false;
      result.blockers.push(`Knowledge readiness score must be at least 80%. Current: ${project.knowledge_readiness_score}%`);
    }

    // Check if all client-facing knowledge assets are approved
    const unapprovedClientAssets = await db('knowledge_assets')
      .where({
        project_id: projectId,
        is_client_facing: true,
        status: ['draft', 'review']
      })
      .count('* as count');

    if (unapprovedClientAssets[0].count > 0) {
      result.canTransition = false;
      result.blockers.push(`${unapprovedClientAssets[0].count} client-facing knowledge assets must be approved`);
    }
  }

  /**
   * Transition project to next stage with strict validation
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
        throw new ValidationError('Project is already in final stage');
      }

      // Perform comprehensive validation
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

      // Log the transition with detailed information
      await this.logStageTransition(projectId, currentStage.id, nextStage.id, requestedBy, {
        validation_passed: true,
        blockers_checked: canTransition.blockers,
        critical_issues_resolved: canTransition.critical_issues.length === 0,
        transition_duration_ms: Date.now()
      });

      return updatedProject;
    } catch (error) {
      throw new Error(`Error transitioning to next stage: ${error.message}`);
    }
  }

  /**
   * Log stage transition with comprehensive audit information
   * @param {number} projectId - Project ID
   * @param {number} fromStageId - From stage ID
   * @param {number} toStageId - To stage ID
   * @param {number} requestedBy - User ID who requested transition
   * @param {Object} additionalData - Additional data to log
   */
  static async logStageTransition(projectId, fromStageId, toStageId, requestedBy, additionalData = {}) {
    try {
      await db('audit_logs').insert({
        entity_type: 'project',
        entity_id: projectId,
        action: 'stage_transition',
        old_values: JSON.stringify({ current_stage_id: fromStageId }),
        new_values: JSON.stringify({ 
          current_stage_id: toStageId,
          requested_by: requestedBy,
          ...additionalData
        }),
        performed_by: requestedBy,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging stage transition:', error);
    }
  }

  /**
   * Get projects blocked in current stage (stuck projects)
   * @param {number} days - Number of days to consider as stuck
   * @returns {Promise<Array>} Array of stuck projects
   */
  static async getStuckProjects(days = 14) {
    try {
      const stuckDate = new Date();
      stuckDate.setDate(stuckDate.getDate() - days);
      const stuckDateStr = stuckDate.toISOString().split('T')[0];

      const stuckProjects = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as stage_name',
          'lifecycle_stages.display_order as stage_order',
          'owner.name as owner_name',
          'owner.email as owner_email'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.updated_at', '<', stuckDateStr)
        .whereNot('projects.status', '=', 'completed')
        .orderBy('projects.updated_at', 'asc');

      // Add stuck reason analysis
      for (const project of stuckProjects) {
        project.stuck_reason = await this.analyzeStuckReason(project.id);
      }

      return stuckProjects;
    } catch (error) {
      throw new Error('Error fetching stuck projects');
    }
  }

  /**
   * Analyze why a project is stuck in current stage
   * @param {number} projectId - Project ID
   * @returns {Promise<string>} Reason for being stuck
   */
  static async analyzeStuckReason(projectId) {
    try {
      const [
        blockedTasks,
        overdueMilestones,
        openRisks,
        pendingHandovers
      ] = await Promise.all([
        db('tasks').where({ project_id: projectId, status: 'blocked' }).count('* as count'),
        db('milestones').where({ project_id: projectId, due_date: '<', new Date().toISOString().split('T')[0], status: ['pending', 'in_progress'] }).count('* as count'),
        db('risks').where({ project_id: projectId, severity: 'critical', status: 'open' }).count('* as count'),
        db('handover_notes').where({ project_id: projectId, checklist_completed: false }).count('* as count')
      ]);

      if (blockedTasks[0].count > 0) {
        return 'Blocked tasks preventing progress';
      }

      if (overdueMilestones[0].count > 0) {
        return 'Overdue milestones blocking timeline';
      }

      if (openRisks[0].count > 0) {
        return 'Open critical risks requiring attention';
      }

      if (pendingHandovers[0].count > 0) {
        return 'Incomplete handover checklists';
      }

      return 'No specific blockers identified - requires manual review';
    } catch (error) {
      return 'Error analyzing stuck reason';
    }
  }
}

module.exports = LifecycleEngine;
