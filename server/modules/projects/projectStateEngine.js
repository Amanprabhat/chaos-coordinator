const db = require('../../database/connection');

/**
 * Project State Engine - Central status management system
 * Controls all project status transitions with validation rules
 */

const VALID_STATUSES = [
  'INTAKE_CREATED',
  'MEETING_SCHEDULED', 
  'MEETING_COMPLETED',
  'HANDOVER_PENDING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'ACTIVE'
];

/**
 * Update project status with validation
 * @param {number} projectId - Project ID
 * @param {string} nextStatus - New status to transition to
 * @param {number} userId - User making the change
 * @returns {Promise<Object>} Updated project
 */
async function updateProjectStatus(projectId, nextStatus, userId = null) {
  try {
    console.log(`[PROJECT_STATE_ENGINE] Updating project ${projectId} status to ${nextStatus}`);
    
    // Validate status
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw new Error(`Invalid status: ${nextStatus}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Fetch current project
    const project = await db('projects').where('id', projectId).first();
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    console.log(`[PROJECT_STATE_ENGINE] Current status: ${project.status}, Next status: ${nextStatus}`);

    // Validate transition rules
    await validateTransition(project, nextStatus);

    // Update status
    await db('projects')
      .where('id', projectId)
      .update({
        status: nextStatus,
        updated_at: new Date()
      });
    const updatedProject = await db('projects').where('id', projectId).first();

    // Log the change
    await logStatusChange(projectId, project.status, nextStatus, userId);

    console.log(`[PROJECT_STATE_ENGINE] Successfully updated project ${projectId} to ${nextStatus}`);
    
    return updatedProject;

  } catch (error) {
    console.error(`[PROJECT_STATE_ENGINE] Error updating project ${projectId} status:`, error);
    throw error;
  }
}

/**
 * Validate status transition rules
 * @param {Object} project - Current project data
 * @param {string} nextStatus - Status to transition to
 */
async function validateTransition(project, nextStatus) {
  const currentStatus = project.status;

  // MEETING_SCHEDULED validation
  if (nextStatus === 'MEETING_SCHEDULED') {
    const meeting = await db('meetings')
      .where('project_id', project.id)
      .first();
    
    if (!meeting) {
      throw new Error('Cannot schedule meeting status: No meeting exists for this project');
    }
  }

  // MEETING_COMPLETED validation
  if (nextStatus === 'MEETING_COMPLETED') {
    const meeting = await db('meetings')
      .where('project_id', project.id)
      .first();
    
    if (!meeting) {
      throw new Error('Cannot complete meeting: No meeting exists for this project');
    }
    
    const currentTime = new Date();
    const meetingTime = new Date(meeting.meeting_time);
    
    if (currentTime < meetingTime) {
      throw new Error('Cannot complete meeting: Meeting time has not passed yet');
    }
  }

  // HANDOVER_PENDING validation
  if (nextStatus === 'HANDOVER_PENDING') {
    if (currentStatus !== 'MEETING_COMPLETED') {
      throw new Error('Cannot start handover: Meeting must be completed first');
    }
  }

  // AWAITING_APPROVAL validation
  if (nextStatus === 'AWAITING_APPROVAL') {
    // Check if MOM is uploaded
    const momDocument = await db('documents')
      .where('project_id', project.id)
      .where('document_type', 'MOM')
      .first();
    
    if (!momDocument) {
      throw new Error('Cannot await approval: Minutes of Meeting (MOM) must be uploaded');
    }

    // Check if SOW is uploaded (if required)
    const sowDocument = await db('documents')
      .where('project_id', project.id)
      .where('document_type', 'SOW')
      .first();
    
    // Note: SOW requirement check can be made conditional based on project type
    // For now, we'll make it optional
  }

  // APPROVED validation
  if (nextStatus === 'APPROVED') {
    // This should only be triggered by CTO role - check user role if userId provided
    if (currentStatus !== 'AWAITING_APPROVAL') {
      throw new Error('Cannot approve project: Project must be awaiting approval first');
    }
  }

  // ACTIVE validation
  if (nextStatus === 'ACTIVE') {
    if (currentStatus !== 'APPROVED') {
      throw new Error('Cannot activate project: Project must be approved first');
    }
  }
}

/**
 * Log status changes for audit trail
 * @param {number} projectId - Project ID
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {number} userId - User who made the change
 */
async function logStatusChange(projectId, oldStatus, newStatus, userId) {
  try {
    await db('project_status_log').insert({
      project_id: projectId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: userId,
      changed_at: new Date()
    });
    
    console.log(`[PROJECT_STATE_ENGINE] Logged status change for project ${projectId}: ${oldStatus} -> ${newStatus}`);
  } catch (error) {
    console.error(`[PROJECT_STATE_ENGINE] Error logging status change:`, error);
    // Don't throw here - logging failure shouldn't break the main operation
  }
}

/**
 * Check if meeting should be auto-completed
 * @param {Object} project - Project data
 * @returns {Promise<boolean>} Whether meeting was auto-completed
 */
async function checkMeetingCompletion(project) {
  try {
    if (project.status !== 'MEETING_SCHEDULED') {
      return false;
    }

    const meeting = await db('meetings')
      .where('project_id', project.id)
      .first();
    
    if (!meeting) {
      return false;
    }

    const currentTime = new Date();
    const meetingTime = new Date(meeting.meeting_time);
    
    if (currentTime > meetingTime) {
      await updateProjectStatus(project.id, 'MEETING_COMPLETED');
      console.log(`[PROJECT_STATE_ENGINE] Auto-completed meeting for project ${project.id}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[PROJECT_STATE_ENGINE] Error checking meeting completion:`, error);
    return false;
  }
}

/**
 * Get valid next statuses for current project status
 * @param {string} currentStatus - Current project status
 * @returns {string[]} Array of valid next statuses
 */
function getValidNextStatuses(currentStatus) {
  const statusTransitions = {
    'INTAKE_CREATED': ['MEETING_SCHEDULED'],
    'MEETING_SCHEDULED': ['MEETING_COMPLETED'],
    'MEETING_COMPLETED': ['HANDOVER_PENDING'],
    'HANDOVER_PENDING': ['AWAITING_APPROVAL'],
    'AWAITING_APPROVAL': ['APPROVED'],
    'APPROVED': ['ACTIVE'],
    'ACTIVE': [] // Terminal state
  };
  
  return statusTransitions[currentStatus] || [];
}

module.exports = {
  updateProjectStatus,
  validateTransition,
  checkMeetingCompletion,
  getValidNextStatuses,
  VALID_STATUSES
};
