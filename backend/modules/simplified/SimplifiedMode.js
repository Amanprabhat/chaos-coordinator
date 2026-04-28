const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Simplified Mode System
 * Provides flexible validation and reduced blockers for gradual adoption
 */
class SimplifiedMode {
  /**
   * Get project simplified mode settings
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Simplified mode settings
   */
  static async getProjectSimplifiedMode(projectId) {
    try {
      const project = await db('projects')
        .where('id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      const simplifiedMode = {
        strict_mode: project.strict_mode !== false, // Default to true
        relaxed_validation: project.strict_mode === false,
        flexible_updates: project.strict_mode === false,
        reduced_blockers: project.strict_mode === false
      };

      return {
        project_id: projectId,
        simplified_mode: simplifiedMode,
        settings: {
          ownership_validation: simplifiedMode.strict_mode,
          dependency_validation: simplifiedMode.strict_mode,
          comment_quality_validation: simplifiedMode.strict_mode,
          sla_enforcement: simplifiedMode.strict_mode,
          stage_transition_blocks: simplifiedMode.strict_mode
        },
        benefits: simplifiedMode.strict_mode ? [
          'Full data quality enforcement',
          'Complete audit trail',
          'Strict compliance',
          'Maximum accountability'
        ] : [
          'Faster task updates',
          'Flexible workflows',
          'Reduced validation overhead',
          'Gradual adoption support'
        ]
      };
    } catch (error) {
      throw new Error(`Error getting simplified mode: ${error.message}`);
    }
  }

  /**
   * Update project simplified mode settings
   * @param {number} projectId - Project ID
   * @param {Object} settings - Simplified mode settings
   * @param {number} userId - User ID making the change
   * @returns {Promise<Object>} Updated settings
   */
  static async updateSimplifiedMode(projectId, settings, userId) {
    try {
      const { strict_mode } = settings;

      // Validate settings
      if (typeof strict_mode !== 'boolean') {
        throw new ValidationError('strict_mode must be a boolean');
      }

      // Update project
      const [updatedProject] = await db('projects')
        .where('id', projectId)
        .update({
          strict_mode,
          updated_at: new Date()
        })
        .returning('*');

      // Log the change
      await db('audit_logs').insert({
        entity_type: 'project',
        entity_id: projectId,
        action: 'simplified_mode_updated',
        old_values: { strict_mode: !strict_mode },
        new_values: { strict_mode },
        performed_by: userId,
        timestamp: new Date()
      });

      return {
        project_id: projectId,
        strict_mode: updatedProject.strict_mode,
        updated_by: userId,
        updated_at: new Date()
      };
    } catch (error) {
      throw new Error(`Error updating simplified mode: ${error.message}`);
    }
  }

  /**
   * Get validation rules based on simplified mode
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Validation rules
   */
  static async getValidationRules(projectId) {
    try {
      const simplifiedMode = await this.getProjectSimplifiedMode(projectId);
      const isStrict = simplifiedMode.simplified_mode.strict_mode;

      const validationRules = {
        task_creation: {
          owner_required: isStrict,
          accountable_required: isStrict,
          description_required: isStrict,
          due_date_required: !isStrict, // More flexible in simplified mode
          estimated_hours_required: !isStrict
        },
        task_completion: {
          comment_required: isStrict,
          comment_min_length: isStrict ? 15 : 5,
          actual_hours_required: !isStrict,
          completion_date_required: true
        },
        stage_transition: {
          all_tasks_complete: isStrict,
          all_milestones_complete: isStrict,
          no_critical_risks: isStrict,
          handover_completed: isStrict,
          knowledge_ready: isStrict
        },
        dependencies: {
          circular_check: isStrict,
          completion_check: isStrict,
          type_validation: isStrict
        },
        sla: {
          breach_enforcement: isStrict,
          pause_allowed: !isStrict,
          escalation_enabled: isStrict
        },
        comments: {
          quality_validation: isStrict,
          generic_words_blocked: isStrict,
          length_validation: isStrict
        }
      };

      return {
        project_id: projectId,
        strict_mode: isStrict,
        validation_rules: validationRules,
        description: isStrict ? 
          'Strict validation enabled - all business rules enforced' :
          'Simplified mode enabled - reduced validation for faster workflows'
      };
    } catch (error) {
      throw new Error(`Error getting validation rules: ${error.message}`);
    }
  }

  /**
   * Validate task creation based on simplified mode
   * @param {number} projectId - Project ID
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Validation result
   */
  static async validateTaskCreation(projectId, taskData) {
    try {
      const validationRules = await this.getValidationRules(projectId);
      const rules = validationRules.validation_rules.task_creation;
      const errors = [];
      const warnings = [];

      // Owner validation
      if (rules.owner_required && !taskData.owner_id) {
        errors.push('Task owner is required');
      } else if (!rules.owner_required && !taskData.owner_id) {
        warnings.push('Task owner is recommended but not required');
      }

      // Accountable validation
      if (rules.accountable_required && !taskData.accountable_id) {
        errors.push('Task accountable person is required');
      }

      // Description validation
      if (rules.description_required && !taskData.description) {
        errors.push('Task description is required');
      }

      // Due date validation
      if (rules.due_date_required && !taskData.due_date) {
        errors.push('Task due date is required');
      }

      // Estimated hours validation
      if (rules.estimated_hours_required && !taskData.estimated_hours) {
        errors.push('Estimated hours are required');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        strict_mode: validationRules.strict_mode
      };
    } catch (error) {
      throw new Error(`Error validating task creation: ${error.message}`);
    }
  }

  /**
   * Validate task completion based on simplified mode
   * @param {number} projectId - Project ID
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Validation result
   */
  static async validateTaskCompletion(projectId, taskData) {
    try {
      const validationRules = await this.getValidationRules(projectId);
      const rules = validationRules.validation_rules.task_completion;
      const errors = [];
      const warnings = [];

      // Comment validation
      if (rules.comment_required && !taskData.completion_comment) {
        errors.push('Completion comment is required');
      } else if (taskData.completion_comment) {
        if (taskData.completion_comment.length < rules.comment_min_length) {
          errors.push(`Comment must be at least ${rules.comment_min_length} characters`);
        }

        // Quality validation (only in strict mode)
        if (rules.quality_validation) {
          const genericWords = ['done', 'ok', 'complete', 'finished', 'good'];
          const commentLower = taskData.completion_comment.toLowerCase();
          
          if (genericWords.some(word => commentLower.includes(word))) {
            errors.push('Comment contains generic words - please provide more specific details');
          }

          // Check for repeated characters
          if (/(.)\1{2,}/.test(taskData.completion_comment)) {
            errors.push('Comment contains repeated characters - please provide meaningful content');
          }
        }
      }

      // Actual hours validation
      if (rules.actual_hours_required && !taskData.actual_hours) {
        errors.push('Actual hours are required');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        strict_mode: validationRules.strict_mode
      };
    } catch (error) {
      throw new Error(`Error validating task completion: ${error.message}`);
    }
  }

  /**
   * Validate stage transition based on simplified mode
   * @param {number} projectId - Project ID
   * @param {string} targetStage - Target stage
   * @returns {Promise<Object>} Validation result
   */
  static async validateStageTransition(projectId, targetStage) {
    try {
      const validationRules = await this.getValidationRules(projectId);
      const rules = validationRules.validation_rules.stage_transition;
      const errors = [];
      const warnings = [];
      const blockers = [];

      // Get project data for validation
      const project = await db('projects')
        .where('id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      // Check all tasks complete (in strict mode)
      if (rules.all_tasks_complete) {
        const incompleteTasks = await db('tasks')
          .where('project_id', projectId)
          .where('status', 'in', ['todo', 'in_progress'])
          .count('* as count');

        if (incompleteTasks[0].count > 0) {
          blockers.push({
            type: 'incomplete_tasks',
            message: `${incompleteTasks[0].count} tasks are not complete`,
            count: incompleteTasks[0].count
          });
        }
      }

      // Check all milestones complete (in strict mode)
      if (rules.all_milestones_complete) {
        const incompleteMilestones = await db('milestones')
          .where('project_id', projectId)
          .where('status', 'in', ['pending', 'in_progress'])
          .count('* as count');

        if (incompleteMilestones[0].count > 0) {
          blockers.push({
            type: 'incomplete_milestones',
            message: `${incompleteMilestones[0].count} milestones are not complete`,
            count: incompleteMilestones[0].count
          });
        }
      }

      // Check critical risks (in strict mode)
      if (rules.no_critical_risks) {
        const criticalRisks = await db('risks')
          .where('project_id', projectId)
          .where('severity', 'critical')
          .where('status', 'open')
          .count('* as count');

        if (criticalRisks[0].count > 0) {
          blockers.push({
            type: 'critical_risks',
            message: `${criticalRisks[0].count} critical risks are open`,
            count: criticalRisks[0].count
          });
        }
      }

      // Check handover completion (in strict mode)
      if (rules.handover_completed && targetStage !== 'Lead') {
        const incompleteHandovers = await db('handover_notes')
          .where('project_id', projectId)
          .where('checklist_completed', false)
          .count('* as count');

        if (incompleteHandovers[0].count > 0) {
          blockers.push({
            type: 'incomplete_handovers',
            message: `${incompleteHandovers[0].count} handovers are not complete`,
            count: incompleteHandovers[0].count
          });
        }
      }

      // Check knowledge readiness (in strict mode)
      if (rules.knowledge_ready && targetStage === 'Go Live') {
        const unapprovedAssets = await db('knowledge_assets')
          .where('project_id', projectId)
          .where('approved_by_client', false)
          .orWhere('approved_by_internal', false)
          .count('* as count');

        if (unapprovedAssets[0].count > 0) {
          blockers.push({
            type: 'unapproved_knowledge',
            message: `${unapprovedAssets[0].count} knowledge assets need approval`,
            count: unapprovedAssets[0].count
          });
        }
      }

      const hasBlockers = blockers.length > 0;
      const canTransition = validationRules.strict_mode ? !hasBlockers : true;

      return {
        can_transition: canTransition,
        blockers: blockers,
        warnings: warnings,
        strict_mode: validationRules.strict_mode,
        message: hasBlockers && validationRules.strict_mode ? 
          'Stage transition blocked - complete required items first' :
          'Stage transition allowed'
      };
    } catch (error) {
      throw new Error(`Error validating stage transition: ${error.message}`);
    }
  }

  /**
   * Get simplified mode statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getSimplifiedModeStats() {
    try {
      const totalProjects = await db('projects').count('* as count');
      const strictProjects = await db('projects').where('strict_mode', true).count('* as count');
      const simplifiedProjects = await db('projects').where('strict_mode', false).count('* as count');

      const stats = {
        total_projects: totalProjects[0].count,
        strict_mode_projects: strictProjects[0].count,
        simplified_mode_projects: simplifiedProjects[0].count,
        strict_mode_percentage: totalProjects[0].count > 0 ? 
          ((strictProjects[0].count / totalProjects[0].count) * 100).toFixed(2) : '0.00',
        simplified_mode_percentage: totalProjects[0].count > 0 ? 
          ((simplifiedProjects[0].count / totalProjects[0].count) * 100).toFixed(2) : '0.00'
      };

      return stats;
    } catch (error) {
      throw new Error(`Error getting simplified mode stats: ${error.message}`);
    }
  }
}

module.exports = SimplifiedMode;
