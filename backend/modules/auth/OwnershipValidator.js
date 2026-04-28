const { ValidationError } = require('joi');

/**
 * Ownership Validation Service
 * Enforces mandatory ownership rules across the system
 */

class OwnershipValidator {
  /**
   * Validate that a task has a mandatory owner
   * @param {Object} taskData - Task data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateTaskOwnership(taskData) {
    if (!taskData.owner_id) {
      throw new ValidationError('Task owner is mandatory. Please assign an owner to this task.');
    }

    // Validate owner exists in users table (this would be checked in the controller/service layer)
    if (typeof taskData.owner_id !== 'number' || taskData.owner_id <= 0) {
      throw new ValidationError('Invalid owner ID. Owner must be a valid user.');
    }

    return true;
  }

  /**
   * Validate milestone ownership
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

    return true;
  }

  /**
   * Validate project ownership
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

    return true;
  }

  /**
   * Validate risk ownership
   * @param {Object} riskData - Risk data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateRiskOwnership(riskData) {
    if (!riskData.owner_id) {
      throw new ValidationError('Risk owner is mandatory. Please assign an owner to this risk.');
    }

    if (typeof riskData.owner_id !== 'number' || riskData.owner_id <= 0) {
      throw new ValidationError('Invalid owner ID. Owner must be a valid user.');
    }

    return true;
  }

  /**
   * Validate change request ownership
   * @param {Object} changeData - Change request data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateChangeOwnership(changeData) {
    if (!changeData.requested_by) {
      throw new ValidationError('Change request must specify who requested it.');
    }

    if (typeof changeData.requested_by !== 'number' || changeData.requested_by <= 0) {
      throw new ValidationError('Invalid requester ID. Must be a valid user.');
    }

    return true;
  }

  /**
   * Batch validate multiple tasks
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
        .where({ id: userId })
        .first();

      if (!user) {
        throw new ValidationError(`User with ID ${userId} does not exist.`);
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
        .where({ id: userId })
        .first();

      if (!user) {
        throw new ValidationError(`User with ID ${userId} does not exist.`);
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
}

module.exports = OwnershipValidator;
