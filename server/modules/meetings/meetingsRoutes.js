const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const { body, validationResult } = require('express-validator');
const { updateProjectStatus } = require('../projects/projectStateEngine');

/**
 * Meetings API Routes
 * Base: /api/meetings
 */

// GET /api/meetings - Get all meetings with optional filters
router.get('/', async (req, res) => {
  try {
    const { project_id, status, from_date, to_date } = req.query;
    
    let query = db('meetings')
      .select(
        'meetings.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.status as project_status',
        'creator.name as creator_name',
        'creator.email as creator_email'
      )
      .leftJoin('projects', 'meetings.project_id', 'projects.id')
      .leftJoin('users as creator', 'meetings.created_by', 'creator.id')
      .orderBy('meetings.meeting_time', 'asc');

    // Apply filters
    if (project_id) {
      query = query.where('meetings.project_id', project_id);
    }
    if (status) {
      query = query.where('meetings.status', status);
    }
    if (from_date) {
      query = query.where('meetings.meeting_time', '>=', from_date);
    }
    if (to_date) {
      query = query.where('meetings.meeting_time', '<=', to_date);
    }

    const meetings = await query;
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// GET /api/meetings/:id - Get single meeting with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const meeting = await db('meetings')
      .select(
        'meetings.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.status as project_status',
        'creator.name as creator_name',
        'creator.email as creator_email'
      )
      .leftJoin('projects', 'meetings.project_id', 'projects.id')
      .leftJoin('users as creator', 'meetings.created_by', 'creator.id')
      .where('meetings.id', id)
      .first();

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

// POST /api/meetings - Schedule new meeting
router.post('/', [
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('meeting_time').isISO8601().withMessage('Valid meeting time is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('meeting_type').optional().isIn(['kickoff', 'review', 'planning', 'status', 'other']).withMessage('Invalid meeting type'),
  body('agenda').optional().isString(),
  body('attendees').optional().isArray().withMessage('Attendees must be an array'),
  body('created_by').isInt({ min: 1 }).withMessage('Valid creator user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const meetingData = req.body;

    // Validate project exists
    const project = await db('projects').where('id', meetingData.project_id).first();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    // Validate creator exists
    const creator = await db('users').where('id', meetingData.created_by).first();
    if (!creator) {
      return res.status(400).json({ error: 'Creator user not found' });
    }

    // Validate meeting time is in the future
    const meetingTime = new Date(meetingData.meeting_time);
    const now = new Date();
    if (meetingTime <= now) {
      return res.status(400).json({ error: 'Meeting time must be in the future' });
    }

    const [newMeeting] = await db('meetings')
      .insert({
        ...meetingData,
        status: 'scheduled',
        attendees: meetingData.attendees ? JSON.stringify(meetingData.attendees) : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Update project status to MEETING_SCHEDULED
    await updateProjectStatus(meetingData.project_id, 'MEETING_SCHEDULED', meetingData.created_by);

    // Log meeting scheduling
    await db('activity_log').insert({
      project_id: meetingData.project_id,
      action: 'meeting_scheduled',
      details: JSON.stringify({
        meeting_id: newMeeting.id,
        meeting_time: meetingData.meeting_time,
        created_by: meetingData.created_by,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    console.log(`[MEETINGS] Scheduled meeting ${newMeeting.id} for project ${meetingData.project_id}, status updated to MEETING_SCHEDULED`);

    res.status(201).json(newMeeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// PUT /api/meetings/:id - Update meeting
router.put('/:id', [
  body('meeting_time').optional().isISO8601().withMessage('Valid meeting time is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('agenda').optional().isString(),
  body('attendees').optional().isArray().withMessage('Attendees must be an array'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if meeting exists
    const existingMeeting = await db('meetings').where('id', id).first();
    if (!existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Handle attendees array conversion
    if (updateData.attendees) {
      updateData.attendees = JSON.stringify(updateData.attendees);
    }

    const [updatedMeeting] = await db('meetings')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      })
      .returning('*');

    // If meeting is being completed, update project status
    if (updateData.status === 'completed' && existingMeeting.status !== 'completed') {
      await updateProjectStatus(existingMeeting.project_id, 'MEETING_COMPLETED');
      
      console.log(`[MEETINGS] Completed meeting ${id} for project ${existingMeeting.project_id}, status updated to MEETING_COMPLETED`);
    }

    // Log meeting update
    await db('activity_log').insert({
      project_id: existingMeeting.project_id,
      action: 'meeting_updated',
      details: JSON.stringify({
        meeting_id: id,
        updated_fields: Object.keys(updateData),
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.json(updatedMeeting);
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// POST /api/meetings/:id/complete - Complete meeting and add notes
router.post('/:id/complete', [
  body('completed_by').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('meeting_notes').optional().isString(),
  body('action_items').optional().isArray().withMessage('Action items must be an array'),
  body('attendees_present').optional().isArray().withMessage('Attendees present must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { completed_by, meeting_notes, action_items, attendees_present } = req.body;

    // Check if meeting exists
    const existingMeeting = await db('meetings').where('id', id).first();
    if (!existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (existingMeeting.status === 'completed') {
      return res.status(400).json({ error: 'Meeting already completed' });
    }

    // Validate meeting time has passed
    const meetingTime = new Date(existingMeeting.meeting_time);
    const now = new Date();
    if (now < meetingTime) {
      return res.status(400).json({ error: 'Cannot complete meeting before scheduled time' });
    }

    const [updatedMeeting] = await db('meetings')
      .where('id', id)
      .update({
        status: 'completed',
        notes: meeting_notes,
        action_items: action_items ? JSON.stringify(action_items) : null,
        attendees_present: attendees_present ? JSON.stringify(attendees_present) : null,
        completed_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Update project status to MEETING_COMPLETED
    await updateProjectStatus(existingMeeting.project_id, 'MEETING_COMPLETED', completed_by);

    // Log meeting completion
    await db('activity_log').insert({
      project_id: existingMeeting.project_id,
      action: 'meeting_completed',
      details: JSON.stringify({
        meeting_id: id,
        completed_by: completed_by,
        meeting_notes: meeting_notes,
        action_items: action_items,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    console.log(`[MEETINGS] Completed meeting ${id} for project ${existingMeeting.project_id}, status updated to MEETING_COMPLETED`);

    res.json({
      message: 'Meeting completed successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Error completing meeting:', error);
    res.status(500).json({ error: 'Failed to complete meeting' });
  }
});

// GET /api/meetings/project/:projectId - Get all meetings for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const meetings = await db('meetings')
      .select(
        'meetings.*',
        'creator.name as creator_name',
        'creator.email as creator_email'
      )
      .leftJoin('users as creator', 'meetings.created_by', 'creator.id')
      .where('meetings.project_id', projectId)
      .orderBy('meetings.meeting_time', 'desc');

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching project meetings:', error);
    res.status(500).json({ error: 'Failed to fetch project meetings' });
  }
});

// GET /api/meetings/upcoming - Get upcoming meetings
router.get('/upcoming', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const upcomingMeetings = await db('meetings')
      .select(
        'meetings.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.status as project_status',
        'creator.name as creator_name',
        'creator.email as creator_email'
      )
      .leftJoin('projects', 'meetings.project_id', 'projects.id')
      .leftJoin('users as creator', 'meetings.created_by', 'creator.id')
      .where('meetings.status', 'scheduled')
      .where('meetings.meeting_time', '>', new Date())
      .orderBy('meetings.meeting_time', 'asc')
      .limit(parseInt(limit));

    res.json(upcomingMeetings);
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming meetings' });
  }
});

module.exports = router;
