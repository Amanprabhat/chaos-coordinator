const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Meeting Notes System
 * Track project meetings with participants, notes, and action items
 */
class MeetingNotesSystem {
  /**
   * Create a new meeting record
   * @param {Object} meetingData - Meeting data
   * @returns {Promise<Object>} Created meeting
   */
  static async createMeeting(meetingData) {
    try {
      const {
        project_id,
        title,
        meeting_date,
        participants = [],
        notes,
        meeting_type = 'general',
        duration_minutes = 60,
        location,
        virtual_meeting_url,
        agenda,
        outcomes,
        created_by
      } = meetingData;

      // Validate required fields
      if (!project_id || !title || !meeting_date || !created_by) {
        throw new ValidationError('Project ID, title, meeting date, and created by are required');
      }

      // Validate meeting type
      const validMeetingTypes = ['general', 'kickoff', 'review', 'planning', 'retrospective', 'escalation'];
      if (!validMeetingTypes.includes(meeting_type)) {
        throw new ValidationError('Invalid meeting type');
      }

      // Validate participants exist
      if (participants.length > 0) {
        for (const participantId of participants) {
          const participant = await db('users').where('id', participantId).first();
          if (!participant) {
            throw new ValidationError(`Participant with ID ${participantId} not found`);
          }
        }
      }

      // Validate project exists
      const project = await db('projects').where('id', project_id).first();
      if (!project) {
        throw new ValidationError('Project not found');
      }

      const [newMeeting] = await db('meetings')
        .insert({
          project_id,
          title,
          meeting_date,
          participants,
          notes,
          meeting_type,
          duration_minutes,
          location,
          virtual_meeting_url,
          agenda,
          outcomes,
          created_by,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // Get participant details
      if (participants.length > 0) {
        newMeeting.participant_details = await db('users')
          .select('id', 'name', 'email', 'role')
          .whereIn('id', participants);
      } else {
        newMeeting.participant_details = [];
      }

      // Log the meeting creation
      await db('audit_logs').insert({
        entity_type: 'meeting',
        entity_id: newMeeting.id,
        action: 'meeting_created',
        new_values: {
          title: newMeeting.title,
          meeting_type: newMeeting.meeting_type,
          participants_count: participants.length
        },
        performed_by: created_by,
        timestamp: new Date()
      });

      // Notify participants
      if (participants.length > 0) {
        await this.notifyParticipants(newMeeting, participants);
      }

      return newMeeting;
    } catch (error) {
      throw new Error(`Error creating meeting: ${error.message}`);
    }
  }

  /**
   * Get meetings for a project
   * @param {number} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of meetings
   */
  static async getProjectMeetings(projectId, options = {}) {
    try {
      const { 
        limit = 50, 
        meeting_type, 
        start_date, 
        end_date,
        include_participants = true,
        include_action_items = true 
      } = options;

      let query = db('meetings')
        .select(
          'meetings.*',
          'users.name as created_by_name',
          'users.email as created_by_email',
          'users.role as created_by_role'
        )
        .join('users', 'meetings.created_by', 'users.id')
        .where('meetings.project_id', projectId)
        .orderBy('meetings.meeting_date', 'DESC')
        .limit(limit);

      if (meeting_type) {
        query = query.andWhere('meetings.meeting_type', meeting_type);
      }

      if (start_date) {
        query = query.andWhere('meetings.meeting_date', '>=', start_date);
      }

      if (end_date) {
        query = query.andWhere('meetings.meeting_date', '<=', end_date);
      }

      const meetings = await query;

      // Get participant information if requested
      if (include_participants) {
        for (const meeting of meetings) {
          if (meeting.participants && meeting.participants.length > 0) {
            meeting.participant_details = await db('users')
              .select('id', 'name', 'email', 'role')
              .whereIn('id', meeting.participants);
          } else {
            meeting.participant_details = [];
          }
        }
      }

      // Get action items if requested
      if (include_action_items) {
        for (const meeting of meetings) {
          meeting.action_items = await db('meeting_action_items')
            .select(
              'meeting_action_items.*',
              'users.name as owner_name',
              'users.email as owner_email',
              'users.role as owner_role'
            )
            .leftJoin('users', 'meeting_action_items.owner_id', 'users.id')
            .where('meeting_action_items.meeting_id', meeting.id)
            .orderBy('meeting_action_items.due_date', 'ASC');
        }
      }

      return meetings;
    } catch (error) {
      throw new Error(`Error getting project meetings: ${error.message}`);
    }
  }

  /**
   * Create meeting action items
   * @param {Array} actionItems - Array of action item data
   * @returns {Promise<Array>} Created action items
   */
  static async createActionItems(actionItems) {
    try {
      const createdItems = [];

      for (const itemData of actionItems) {
        const {
          meeting_id,
          task_id,
          description,
          owner_id,
          due_date,
          priority = 'medium'
        } = itemData;

        // Validate required fields
        if (!meeting_id || !description || !owner_id) {
          throw new ValidationError('Meeting ID, description, and owner ID are required');
        }

        // Validate meeting exists
        const meeting = await db('meetings').where('id', meeting_id).first();
        if (!meeting) {
          throw new ValidationError('Meeting not found');
        }

        // Validate owner exists
        const owner = await db('users').where('id', owner_id).first();
        if (!owner) {
          throw new ValidationError('Owner not found');
        }

        // Validate task if provided
        if (task_id) {
          const task = await db('tasks').where('id', task_id).first();
          if (!task) {
            throw new ValidationError('Task not found');
          }
        }

        const [newActionItem] = await db('meeting_action_items')
          .insert({
            meeting_id,
            task_id,
            description,
            owner_id,
            due_date,
            priority,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');

        // Get owner details
        newActionItem.owner_details = await db('users')
          .select('id', 'name', 'email', 'role')
          .where('id', owner_id)
          .first();

        createdItems.push(newActionItem);

        // Create notification for action item owner
        await db('notifications').insert({
          user_id: owner_id,
          project_id: meeting.project_id,
          type: 'action_item_assigned',
          title: 'New Action Item Assigned',
          message: `You have been assigned a new action item: "${description}" from meeting "${meeting.title}"`,
          send_immediately: true,
          created_at: new Date()
        });
      }

      return createdItems;
    } catch (error) {
      throw new Error(`Error creating action items: ${error.message}`);
    }
  }

  /**
   * Update action item status
   * @param {number} actionItemId - Action item ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated action item
   */
  static async updateActionItem(actionItemId, updateData) {
    try {
      const { status, completion_notes, updated_by } = updateData;

      if (!status || !updated_by) {
        throw new ValidationError('Status and updated by are required');
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid status');
      }

      const [updatedItem] = await db('meeting_action_items')
        .where('id', actionItemId)
        .update({
          status,
          completion_notes,
          completed_at: status === 'completed' ? new Date() : null,
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedItem) {
        throw new ValidationError('Action item not found');
      }

      // Get meeting details for notification
      const meeting = await db('meetings')
        .select('title', 'project_id')
        .where('id', updatedItem.meeting_id)
        .first();

      // Create notification for status update
      if (meeting) {
        await db('notifications').insert({
          user_id: updatedItem.owner_id,
          project_id: meeting.project_id,
          type: 'action_item_updated',
          title: 'Action Item Status Updated',
          message: `Action item "${updatedItem.description}" status updated to ${status}`,
          send_immediately: false,
          created_at: new Date()
        });
      }

      return updatedItem;
    } catch (error) {
      throw new Error(`Error updating action item: ${error.message}`);
    }
  }

  /**
   * Get meeting analytics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Meeting analytics
   */
  static async getMeetingAnalytics(projectId) {
    try {
      // Get meetings by type
      const meetingsByType = await db('meetings')
        .select('meeting_type')
        .count('* as count')
        .sum('duration_minutes as total_duration')
        .where('project_id', projectId)
        .groupBy('meeting_type')
        .orderBy('count', 'desc');

      // Get meetings by month
      const meetingsByMonth = await db('meetings')
        .select(
          db.raw('DATE_TRUNC(\'month\', meeting_date) as month'),
          db.raw('COUNT(*) as count'),
          db.raw('SUM(duration_minutes) as total_duration')
        )
        .where('project_id', projectId)
        .groupBy(db.raw('DATE_TRUNC(\'month\', meeting_date)'))
        .orderBy(db.raw('DATE_TRUNC(\'month\', meeting_date)'), 'desc')
        .limit(12);

      // Get top participants
      const topParticipants = await db('meetings')
        .select(
          'users.name',
          'users.email',
          db.raw('COUNT(*) as meeting_count'),
          db.raw('SUM(meetings.duration_minutes) as total_minutes')
        )
        .join('users', db.raw('ANY(meetings.participants)'), 'users.id')
        .where('meetings.project_id', projectId)
        .groupBy('users.id', 'users.name', 'users.email')
        .orderBy('meeting_count', 'desc')
        .limit(10);

      // Get action item statistics
      const actionItemStats = await db('meeting_action_items')
        .select(
          db.raw('COUNT(*) as total_items'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_items'),
          db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_items'),
          db.raw('COUNT(CASE WHEN status = \'overdue\' THEN 1 END) as overdue_items')
        )
        .join('meetings', 'meeting_action_items.meeting_id', 'meetings.id')
        .where('meetings.project_id', projectId)
        .first();

      // Get overdue action items
      const overdueActionItems = await db('meeting_action_items')
        .select(
          'meeting_action_items.*',
          'meetings.title as meeting_title',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('meetings', 'meeting_action_items.meeting_id', 'meetings.id')
        .join('users', 'meeting_action_items.owner_id', 'users.id')
        .where('meetings.project_id', projectId)
        .where('meeting_action_items.due_date', '<', new Date())
        .where('meeting_action_items.status', 'in', ['pending', 'in_progress'])
        .orderBy('meeting_action_items.due_date', 'ASC');

      return {
        project_id: projectId,
        summary: {
          total_meetings: meetingsByType.reduce((sum, item) => sum + item.count, 0),
          total_duration: meetingsByType.reduce((sum, item) => sum + (item.total_duration || 0), 0),
          by_type: meetingsByType,
          by_month: meetingsByMonth,
          top_participants: topParticipants,
          action_items: actionItemStats,
          overdue_action_items: overdueActionItems
        }
      };
    } catch (error) {
      throw new Error(`Error getting meeting analytics: ${error.message}`);
    }
  }

  /**
   * Get upcoming meetings
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID (optional)
   * @returns {Promise<Array>} Upcoming meetings
   */
  static async getUpcomingMeetings(projectId, userId = null) {
    try {
      let query = db('meetings')
        .select(
          'meetings.*',
          'users.name as created_by_name'
        )
        .join('users', 'meetings.created_by', 'users.id')
        .where('meetings.project_id', projectId)
        .where('meetings.meeting_date', '>=', new Date())
        .orderBy('meetings.meeting_date', 'ASC')
        .limit(10);

      // Filter by user if specified
      if (userId) {
        query = query.whereRaw('? = ANY(meetings.participants)', [userId]);
      }

      const meetings = await query;

      // Get participant details
      for (const meeting of meetings) {
        if (meeting.participants && meeting.participants.length > 0) {
          meeting.participant_details = await db('users')
            .select('id', 'name', 'email', 'role')
            .whereIn('id', meeting.participants);
        } else {
          meeting.participant_details = [];
        }
      }

      return meetings;
    } catch (error) {
      throw new Error(`Error getting upcoming meetings: ${error.message}`);
    }
  }

  /**
   * Notify meeting participants
   * @param {Object} meeting - Meeting object
   * @param {Array} participantIds - Array of participant IDs
   */
  static async notifyParticipants(meeting, participantIds) {
    try {
      for (const participantId of participantIds) {
        await db('notifications').insert({
          user_id: participantId,
          project_id: meeting.project_id,
          type: 'meeting_scheduled',
          title: 'Meeting Scheduled',
          message: `You have been invited to: "${meeting.title}" on ${meeting.meeting_date}`,
          send_immediately: true,
          created_at: new Date()
        });
      }
    } catch (error) {
      console.error('Error notifying participants:', error);
    }
  }

  /**
   * Generate meeting summary
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Meeting summary
   */
  static async generateMeetingSummary(meetingId) {
    try {
      const meeting = await db('meetings')
        .select(
          'meetings.*',
          'users.name as created_by_name',
          'projects.name as project_name'
        )
        .join('users', 'meetings.created_by', 'users.id')
        .join('projects', 'meetings.project_id', 'projects.id')
        .where('meetings.id', meetingId)
        .first();

      if (!meeting) {
        throw new ValidationError('Meeting not found');
      }

      // Get action items
      const actionItems = await db('meeting_action_items')
        .select(
          'meeting_action_items.*',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .leftJoin('users', 'meeting_action_items.owner_id', 'users.id')
        .where('meeting_action_items.meeting_id', meetingId)
        .orderBy('meeting_action_items.priority', 'desc')
        .orderBy('meeting_action_items.due_date', 'ASC');

      // Get participant details
      const participantDetails = meeting.participants && meeting.participants.length > 0 ? 
        await db('users')
          .select('id', 'name', 'email', 'role')
          .whereIn('id', meeting.participants) : [];

      return {
        meeting: {
          ...meeting,
          participant_details: participantDetails
        },
        action_items: actionItems,
        summary: {
          total_action_items: actionItems.length,
          completed_action_items: actionItems.filter(item => item.status === 'completed').length,
          pending_action_items: actionItems.filter(item => item.status === 'pending').length,
          overdue_action_items: actionItems.filter(item => 
            item.status === 'pending' && item.due_date < new Date()
          ).length
        }
      };
    } catch (error) {
      throw new Error(`Error generating meeting summary: ${error.message}`);
    }
  }
}

module.exports = MeetingNotesSystem;
