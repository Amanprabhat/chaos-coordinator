const { ValidationError } = require('joi');

/**
 * Enhanced Ownership Validation Service
 * Enforces strict ownership rules and human-behavior handling
 */
class OwnershipValidator {
  /**
   * Generic word rejection list
   */
  static GENERIC_WORDS = [
    'done', 'ok', 'complete', 'completed', 'finished', 'good', 'nice', 
    'yes', 'y', 'no', 'n', 'test', 'asdf', '123', 'xxx'
  ];

  /**
   * Validate comment quality
   * @param {string} comment - Comment to validate
   * @throws {ValidationError} If comment quality is poor
   */
  static validateCommentQuality(comment, fieldName = 'comment') {
    if (!comment) return true;
    
    const trimmedComment = comment.trim();
    
    // Check minimum length
    if (trimmedComment.length < 15) {
      throw new ValidationError(`${fieldName} must be at least 15 characters. Current: ${trimmedComment.length}`);
    }

    // Check for generic words
    const words = trimmedComment.toLowerCase().split(/\s+/);
    const genericWordsFound = words.filter(word => 
      this.GENERIC_WORDS.includes(word) && word.length > 2
    );

    if (genericWordsFound.length > 0) {
      throw new ValidationError(`${fieldName} contains generic words: ${genericWordsFound.join(', ')}. Please provide specific details.`);
    }

    // Check for repeated characters
    const repeatedChars = trimmedComment.match(/(.)\1{3,}/);
    if (repeatedChars) {
      throw new ValidationError(`${fieldName} contains repeated characters. Please provide meaningful content.`);
    }

    return true;
  }

  /**
   * Validate task with enhanced rules
   * @param {Object} taskData - Task data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateTaskOwnership(taskData) {
    if (!taskData.owner_id) {
      throw new ValidationError('Task owner is mandatory. Please assign an owner to this task.');
    }

    if (typeof taskData.owner_id !== 'number' || taskData.owner_id <= 0) {
      throw new ValidationError('Invalid owner ID. Owner must be a valid user.');
    }

    // Validate accountable person if provided
    if (taskData.accountable_id) {
      if (typeof taskData.accountable_id !== 'number' || taskData.accountable_id <= 0) {
        throw new ValidationError('Invalid accountable ID. Accountable person must be a valid user.');
      }
    }

    // Validate SLA hours
    if (taskData.sla_hours && taskData.sla_hours < 0) {
      throw new ValidationError('SLA hours must be positive.');
    }

    // Validate completion comment if task is being completed
    if (taskData.status === 'completed' && taskData.completion_comment) {
      this.validateCommentQuality(taskData.completion_comment, 'completion_comment');
    }

    return true;
  }

  /**
   * Validate milestone with enhanced rules
   * @param {Object} milestoneData - Milestone data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateMilestoneOwnership(milestoneData) {
    if (!milestoneData.owner_id) {
      throw new ValidationError('Milestone owner is mandatory. Please assign an owner to this milestone.');
    }

    if (typeof milestoneData.owner_id !== 'number' || milestoneData.owner_id <= 0) {
      throw new ValidationError('Invalid owner ID. Owner must be a valid user.');
    }

    // Validate accountable person if provided
    if (milestoneData.accountable_id) {
      if (typeof milestoneData.accountable_id !== 'number' || milestoneData.accountable_id <= 0) {
        throw new ValidationError('Invalid accountable ID. Accountable person must be a valid user.');
      }
    }

    return true;
  }

  /**
   * Validate project with enhanced rules
   * @param {Object} projectData - Project data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateProjectOwnership(projectData) {
    if (!projectData.owner_id) {
      throw new ValidationError('Project owner is mandatory. Please assign an owner to this project.');
    }

    if (typeof projectData.owner_id !== 'number' || projectData.owner_id <= 0) {
      throw new ValidationError('Invalid owner ID. Owner must be a valid user.');
    }

    // Validate knowledge readiness score
    if (projectData.knowledge_readiness_score !== undefined) {
      if (typeof projectData.knowledge_readiness_score !== 'number' || 
          projectData.knowledge_readiness_score < 0 || 
          projectData.knowledge_readiness_score > 100) {
        throw new ValidationError('Knowledge readiness score must be between 0 and 100.');
      }
    }

    return true;
  }

  /**
   * Validate handover with enhanced checklist requirements
   * @param {Object} handoverData - Handover data to validate
   * @param {Array} checklistItems - Checklist items for this handover
   * @throws {ValidationError} If validation fails
   */
  static validateHandoverCompletion(handoverData, checklistItems = []) {
    if (!handoverData.checklist_completed) {
      throw new ValidationError('Handover checklist completion status is required.');
    }

    if (handoverData.checklist_completed) {
      // Check all mandatory checklist items are completed
      const mandatoryItems = checklistItems.filter(item => item.is_mandatory);
      const incompleteMandatory = mandatoryItems.filter(item => !item.is_completed);
      
      if (incompleteMandatory.length > 0) {
        throw new ValidationError(`Cannot approve handover. ${incompleteMandatory.length} mandatory checklist items incomplete: ${incompleteMandatory.map(item => item.title).join(', ')}`);
      }

      // Validate handover document is uploaded
      if (!handoverData.handover_document_url) {
        throw new ValidationError('Handover document must be uploaded before approval.');
      }
    }

    return true;
  }

  /**
   * Validate knowledge asset with approval rules
   * @param {Object} assetData - Knowledge asset data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateKnowledgeAsset(assetData) {
    if (!assetData.owner_id) {
      throw new ValidationError('Knowledge asset owner is mandatory.');
    }

    if (assetData.status === 'published') {
      // Check client approval for client-facing assets
      if (assetData.is_client_facing && !assetData.approved_by_client) {
        throw new ValidationError('Client-facing assets must be approved by client before publishing.');
      }

      // Check internal approval for all assets
      if (!assetData.approved_by_internal) {
        throw new ValidationError('Knowledge assets must be approved internally before publishing.');
      }
    }

    return true;
  }

  /**
   * Validate task dependencies for circular references
   * @param {Array} dependencies - Array of task dependencies
   * @throws {ValidationError} If validation fails
   */
  static validateTaskDependencies(dependencies) {
    if (!Array.isArray(dependencies)) {
      throw new ValidationError('Dependencies must be provided as an array.');
    }

    // Check for circular dependencies
    const visited = new Set();
    const checkCircular = (taskId, path = []) => {
      if (visited.has(taskId)) {
        return true; // Circular dependency detected
      }
      visited.add(taskId);
      
      const directDeps = dependencies
        .filter(dep => dep.task_id === taskId)
        .map(dep => dep.depends_on_task_id);
      
      for (const depId of directDeps) {
        if (checkCircular(depId, [...path, taskId])) {
          return true;
        }
      }
      
      visited.delete(taskId);
      return false;
    };

    for (const dep of dependencies) {
      visited.clear();
      if (checkCircular(dep.task_id)) {
        throw new ValidationError(`Circular dependency detected for task ${dep.task_id}. Task cannot depend on itself.`);
      }
    }

    return true;
  }

  /**
   * Validate SLA breach conditions
   * @param {Object} taskData - Task data with SLA info
   * @throws {ValidationError} If SLA setup is invalid
   */
  static validateSLASetup(taskData) {
    if (taskData.sla_hours && taskData.sla_hours <= 0) {
      throw new ValidationError('SLA hours must be positive.');
    }

    // Validate SLA start time if task is in progress
    if (taskData.status === 'in_progress' && !taskData.sla_start_time) {
      throw new ValidationError('SLA start time is required when task is in progress.');
    }

    return true;
  }

  /**
   * Validate user hierarchy
   * @param {Object} userData - User data to validate
   * @param {Object} db - Database connection
   * @throws {ValidationError} If validation fails
   */
  static async validateUserHierarchy(userData, db) {
    // Check if manager exists if manager_id is provided
    if (userData.manager_id) {
      const manager = await db('users')
        .where('id', userData.manager_id)
        .first();

      if (!manager) {
        throw new ValidationError(`Manager with ID ${userData.manager_id} does not exist.`);
      }

      // Prevent circular manager references
      if (userData.manager_id === userData.id) {
        throw new ValidationError('User cannot be their own manager.');
      }
    }

    return true;
  }

  /**
   * Validate state transition
   * @param {string} fromStatus - Current status
   * @param {string} toStatus - Target status
   * @param {Object} context - Additional context for validation
   * @throws {ValidationError} If transition is invalid
   */
  static validateStateTransition(fromStatus, toStatus, context = {}) {
    const validTransitions = {
      'todo': ['in_progress', 'blocked'],
      'in_progress': ['completed', 'blocked', 'reopened'],
      'blocked': ['in_progress', 'reopened'],
      'completed': ['reopened'],
      'reopened': ['in_progress'],
      'at_risk': ['in_progress', 'blocked', 'reopened']
    };

    const allowedTransitions = validTransitions[fromStatus] || [];
    
    if (!allowedTransitions.includes(toStatus)) {
      throw new ValidationError(`Invalid status transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`);
    }

    // Special validation for completed -> reopened
    if (fromStatus === 'completed' && toStatus === 'reopened') {
      if (!context.reopen_reason || context.reopen_reason?.trim().length < 10) {
        throw new ValidationError('Reopen reason must be at least 10 characters explaining why task was reopened.');
      }
    }

    return true;
  }

  /**
   * Batch validate multiple tasks with enhanced rules
   * @param {Array} tasks - Array of task objects to validate
   * @throws {ValidationError} If any task fails validation
   */
  static validateMultipleTasks(tasks) {
    if (!Array.isArray(tasks)) {
      throw new ValidationError('Tasks must be provided as an array.');
    }

    for (let i = 0; i < tasks.length; i++) {
      try {
        this.validateTaskOwnership(tasks[i]);
        
        // Validate completion comments for completed tasks
        if (tasks[i].status === 'completed') {
          this.validateCommentQuality(tasks[i].completion_comment, `tasks[${i}].completion_comment`);
        }
      } catch (error) {
        throw new ValidationError(`Task at index ${i}: ${error.message}`);
      }
    }

    return true;
  }

  /**
   * Check if user exists and is active
   * @param {number} userId - User ID to check
   * @param {Object} db - Database connection
   * @returns {Promise<boolean>} True if user exists and is active
   */
  static async validateUserExists(userId, db) {
    try {
      const user = await db('users')
        .where({ id: userId, is_active: true })
        .first();

      if (!user) {
        throw new ValidationError(`User with ID ${userId} does not exist or is inactive.`);
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Error validating user existence.');
    }
  }

  /**
   * Validate user role for specific operations
   * @param {number} userId - User ID
   * @param {Array} allowedRoles - Array of allowed roles
   * @param {Object} db - Database connection
   * @returns {Promise<boolean>} True if user has allowed role
   */
  static async validateUserRole(userId, allowedRoles, db) {
    try {
      const user = await db('users')
        .where({ id: userId, is_active: true })
        .first();

      if (!user) {
        throw new ValidationError(`User with ID ${userId} does not exist or is inactive.`);
      }

      if (!allowedRoles.includes(user.role)) {
        throw new ValidationError(`User role '${user.role}' is not allowed for this operation. Allowed roles: ${allowedRoles.join(', ')}`);
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Error validating user role.');
    }
  }

  /**
   * Validate escalation rules
   * @param {Object} escalationData - Escalation data
   * @throws {ValidationError} If escalation is invalid
   */
  static validateEscalation(escalationData) {
    if (!escalationData.escalated_to_user_id) {
      throw new ValidationError('Escalation must specify target user.');
    }

    if (escalationData.escalated_to_user_id === escalationData.escalated_by_user_id) {
      throw new ValidationError('Cannot escalate to yourself.');
    }

    if (!escalationData.escalation_reason || escalationData.escalation_reason?.trim().length < 20) {
      throw new ValidationError('Escalation reason must be at least 20 characters.');
    }

    return true;
  }
}

module.exports = OwnershipValidator;
