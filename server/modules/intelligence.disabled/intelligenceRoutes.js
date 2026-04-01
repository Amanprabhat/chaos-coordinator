const express = require('express');
const router = express.Router();
const DecisionTrackingSystem = require('../decisions/DecisionTrackingSystem');
const ResponsibilityTimeline = require('../responsibility/ResponsibilityTimeline');
const MeetingNotesSystem = require('../meetings/MeetingNotesSystem');
const DelayTrackingSystem = require('../analytics/DelayTrackingSystem');
const ProjectSummarySystem = require('../summary/ProjectSummarySystem');
const { body, validationResult } = require('express-validator');

/**
 * Decision Tracking API Routes
 * Base: /api/decisions
 */

// POST /api/decisions - Create a new decision
router.post('/', [
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('title').notEmpty().withMessage('Decision title is required'),
  body('description').notEmpty().withMessage('Decision description is required'),
  body('taken_by').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('impact_area').isIn(['scope', 'timeline', 'tech', 'process', 'budget', 'quality']).withMessage('Valid impact area is required'),
  body('stakeholders').optional().isArray().withMessage('Stakeholders must be an array'),
  body('decision_date').optional().isISO8601().withMessage('Invalid decision date format'),
  body('related_task_id').optional().isInt({ min: 1 }).withMessage('Valid task ID is required'),
  body('justification').optional().isString(),
  body('alternatives_considered').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const decision = await DecisionTrackingSystem.createDecision(req.body);
    res.status(201).json(decision);
  } catch (error) {
    console.error('Error creating decision:', error);
    res.status(500).json({ error: 'Failed to create decision' });
  }
});

// GET /api/decisions/project/:projectId - Get project decisions
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { impact_area, decision_status, start_date, end_date, limit } = req.query;

    const decisions = await DecisionTrackingSystem.getProjectDecisions(parseInt(projectId), {
      impact_area,
      decision_status,
      start_date,
      end_date,
      limit: parseInt(limit) || 50
    });

    res.json(decisions);
  } catch (error) {
    console.error('Error getting project decisions:', error);
    res.status(500).json({ error: 'Failed to get project decisions' });
  }
});

// PUT /api/decisions/:id - Update decision status
router.put('/:id', [
  body('decision_status').isIn(['active', 'reversed', 'superseded', 'implemented']).withMessage('Valid decision status is required'),
  body('updated_by').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('justification').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updatedDecision = await DecisionTrackingSystem.updateDecision(parseInt(id), req.body);
    res.json(updatedDecision);
  } catch (error) {
    console.error('Error updating decision:', error);
    res.status(500).json({ error: 'Failed to update decision' });
  }
});

// GET /api/decisions/analytics/:projectId - Get decision analytics
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const analytics = await DecisionTrackingSystem.getDecisionAnalytics(parseInt(projectId));
    res.json(analytics);
  } catch (error) {
    console.error('Error getting decision analytics:', error);
    res.status(500).json({ error: 'Failed to get decision analytics' });
  }
});

// GET /api/decisions/conflicts/:projectId - Get decision conflicts
router.get('/conflicts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const conflicts = await DecisionTrackingSystem.getDecisionConflicts(parseInt(projectId));
    res.json(conflicts);
  } catch (error) {
    console.error('Error getting decision conflicts:', error);
    res.status(500).json({ error: 'Failed to get decision conflicts' });
  }
});

/**
 * Responsibility Timeline API Routes
 * Base: /api/responsibility
 */

// POST /api/responsibility/log - Log responsibility change
router.post('/log', [
  body('entity_type').isIn(['task', 'milestone', 'project', 'risk']).withMessage('Valid entity type is required'),
  body('entity_id').isInt({ min: 1 }).withMessage('Valid entity ID is required'),
  body('new_owner').isInt({ min: 1 }).withMessage('Valid new owner ID is required'),
  body('changed_by').isInt({ min: 1 }).withMessage('Valid changed by user ID is required'),
  body('previous_owner').optional().isInt({ min: 1 }).withMessage('Valid previous owner ID is required'),
  body('change_reason').optional().isString(),
  body('context').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const logEntry = await ResponsibilityTimeline.logResponsibilityChange(req.body);
    res.status(201).json(logEntry);
  } catch (error) {
    console.error('Error logging responsibility change:', error);
    res.status(500).json({ error: 'Failed to log responsibility change' });
  }
});

// GET /api/responsibility/timeline/:entityType/:entityId - Get responsibility timeline
router.get('/timeline/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const timeline = await ResponsibilityTimeline.getResponsibilityTimeline(entityType, parseInt(entityId));
    res.json(timeline);
  } catch (error) {
    console.error('Error getting responsibility timeline:', error);
    res.status(500).json({ error: 'Failed to get responsibility timeline' });
  }
});

// GET /api/responsibility/analytics/:projectId - Get responsibility analytics
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const analytics = await ResponsibilityTimeline.getResponsibilityAnalytics(parseInt(projectId));
    res.json(analytics);
  } catch (error) {
    console.error('Error getting responsibility analytics:', error);
    res.status(500).json({ error: 'Failed to get responsibility analytics' });
  }
});

// GET /api/responsibility/user/:userId - Get user accountability timeline
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { start_date, end_date, entity_type, limit } = req.query;

    const timeline = await ResponsibilityTimeline.getUserAccountabilityTimeline(parseInt(userId), {
      start_date,
      end_date,
      entity_type,
      limit: parseInt(limit) || 100
    });

    res.json(timeline);
  } catch (error) {
    console.error('Error getting user accountability timeline:', error);
    res.status(500).json({ error: 'Failed to get user accountability timeline' });
  }
});

// GET /api/responsibility/orphaned/:projectId - Get orphaned entities
router.get('/orphaned/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const orphaned = await ResponsibilityTimeline.getOrphanedEntities(parseInt(projectId));
    res.json(orphaned);
  } catch (error) {
    console.error('Error getting orphaned entities:', error);
    res.status(500).json({ error: 'Failed to get orphaned entities' });
  }
});

// GET /api/responsibility/handover-recommendations/:projectId - Get handover recommendations
router.get('/handover-recommendations/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const recommendations = await ResponsibilityTimeline.getHandoverRecommendations(parseInt(projectId));
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting handover recommendations:', error);
    res.status(500).json({ error: 'Failed to get handover recommendations' });
  }
});

/**
 * Meeting Notes API Routes
 * Base: /api/meetings
 */

// POST /api/meetings - Create a new meeting
router.post('/', [
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('title').notEmpty().withMessage('Meeting title is required'),
  body('meeting_date').isISO8601().withMessage('Valid meeting date is required'),
  body('created_by').isInt({ min: 1 }).withMessage('Valid created by user ID is required'),
  body('participants').optional().isArray().withMessage('Participants must be an array'),
  body('notes').optional().isString(),
  body('meeting_type').optional().isIn(['general', 'kickoff', 'review', 'planning', 'retrospective', 'escalation']).withMessage('Valid meeting type is required'),
  body('duration_minutes').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('location').optional().isString(),
  body('virtual_meeting_url').optional().isURL().withMessage('Valid meeting URL is required'),
  body('agenda').optional().isString(),
  body('outcomes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const meeting = await MeetingNotesSystem.createMeeting(req.body);
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// GET /api/meetings/project/:projectId - Get project meetings
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { meeting_type, start_date, end_date, limit, include_participants, include_action_items } = req.query;

    const meetings = await MeetingNotesSystem.getProjectMeetings(parseInt(projectId), {
      meeting_type,
      start_date,
      end_date,
      limit: parseInt(limit) || 50,
      include_participants: include_participants === 'true',
      include_action_items: include_action_items === 'true'
    });

    res.json(meetings);
  } catch (error) {
    console.error('Error getting project meetings:', error);
    res.status(500).json({ error: 'Failed to get project meetings' });
  }
});

// POST /api/meetings/action-items - Create action items
router.post('/action-items', [
  body('action_items').isArray().withMessage('Action items must be an array'),
  body('action_items.*.meeting_id').isInt({ min: 1 }).withMessage('Valid meeting ID is required'),
  body('action_items.*.description').notEmpty().withMessage('Action item description is required'),
  body('action_items.*.owner_id').isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('action_items.*.due_date').optional().isISO8601().withMessage('Valid due date is required'),
  body('action_items.*.priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid priority is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const actionItems = await MeetingNotesSystem.createActionItems(req.body.action_items);
    res.status(201).json(actionItems);
  } catch (error) {
    console.error('Error creating action items:', error);
    res.status(500).json({ error: 'Failed to create action items' });
  }
});

// PUT /api/meetings/action-items/:id - Update action item status
router.put('/action-items/:id', [
  body('status').isIn(['pending', 'in_progress', 'completed', 'cancelled']).withMessage('Valid status is required'),
  body('updated_by').isInt({ min: 1 }).withMessage('Valid updated by user ID is required'),
  body('completion_notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updatedItem = await MeetingNotesSystem.updateActionItem(parseInt(id), req.body);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating action item:', error);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// GET /api/meetings/analytics/:projectId - Get meeting analytics
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const analytics = await MeetingNotesSystem.getMeetingAnalytics(parseInt(projectId));
    res.json(analytics);
  } catch (error) {
    console.error('Error getting meeting analytics:', error);
    res.status(500).json({ error: 'Failed to get meeting analytics' });
  }
});

// GET /api/meetings/upcoming/:projectId - Get upcoming meetings
router.get('/upcoming/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    const meetings = await MeetingNotesSystem.getUpcomingMeetings(parseInt(projectId), userId ? parseInt(userId) : null);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting upcoming meetings:', error);
    res.status(500).json({ error: 'Failed to get upcoming meetings' });
  }
});

// GET /api/meetings/summary/:id - Generate meeting summary
router.get('/summary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await MeetingNotesSystem.generateMeetingSummary(parseInt(id));
    res.json(summary);
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({ error: 'Failed to generate meeting summary' });
  }
});

/**
 * Delay Tracking API Routes
 * Base: /api/delays
 */

// POST /api/delays/tasks/:id/log - Log task delay
router.post('/tasks/:id/log', [
  body('delay_reason').notEmpty().withMessage('Delay reason is required'),
  body('delay_category').isIn(['dependency', 'client', 'internal', 'external', 'resource', 'technical', 'unknown']).withMessage('Valid delay category is required'),
  body('delay_impact_hours').optional().isInt({ min: 0 }).withMessage('Delay impact hours must be positive'),
  body('updated_by').isInt({ min: 1 }).withMessage('Valid updated by user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updatedTask = await DelayTrackingSystem.logTaskDelay(parseInt(id), req.body);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error logging task delay:', error);
    res.status(500).json({ error: 'Failed to log task delay' });
  }
});

// POST /api/delays/tasks/:id/resolve - Resolve task delay
router.post('/tasks/:id/resolve', [
  body('resolution_notes').notEmpty().withMessage('Resolution notes are required'),
  body('updated_by').isInt({ min: 1 }).withMessage('Valid updated by user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const resolvedTask = await DelayTrackingSystem.resolveTaskDelay(parseInt(id), req.body);
    res.json(resolvedTask);
  } catch (error) {
    console.error('Error resolving task delay:', error);
    res.status(500).json({ error: 'Failed to resolve task delay' });
  }
});

// GET /api/delays/analytics/:projectId - Get delay analytics
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const analytics = await DelayTrackingSystem.getDelayAnalytics(parseInt(projectId));
    res.json(analytics);
  } catch (error) {
    console.error('Error getting delay analytics:', error);
    res.status(500).json({ error: 'Failed to get delay analytics' });
  }
});

// GET /api/delays/root-cause/:projectId - Get root cause analysis
router.get('/root-cause/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rootCause = await DelayTrackingSystem.getRootCauseAnalysis(parseInt(projectId));
    res.json(rootCause);
  } catch (error) {
    console.error('Error getting root cause analysis:', error);
    res.status(500).json({ error: 'Failed to get root cause analysis' });
  }
});

// GET /api/delays/escalation-visibility - Get escalation visibility
router.get('/escalation-visibility', async (req, res) => {
  try {
    const visibility = await DelayTrackingSystem.getEscalationVisibility();
    res.json(visibility);
  } catch (error) {
    console.error('Error getting escalation visibility:', error);
    res.status(500).json({ error: 'Failed to get escalation visibility' });
  }
});

// GET /api/delays/weekly-digest/:projectId - Generate weekly digest
router.get('/weekly-digest/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const digest = await DelayTrackingSystem.generateWeeklyDigest(parseInt(projectId));
    res.json(digest);
  } catch (error) {
    console.error('Error generating weekly digest:', error);
    res.status(500).json({ error: 'Failed to generate weekly digest' });
  }
});

/**
 * Project Summary API Routes
 * Base: /api/summary
 */

// POST /api/summary/:projectId - Generate project summary
router.post('/:projectId', [
  body('user_id').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('auto_generated').optional().isBoolean().withMessage('Auto generated must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.params;
    const { user_id, auto_generated } = req.body;

    const summary = await ProjectSummarySystem.generateProjectSummary(parseInt(projectId), parseInt(user_id), {
      auto_generated: auto_generated || false
    });

    res.json(summary);
  } catch (error) {
    console.error('Error generating project summary:', error);
    res.status(500).json({ error: 'Failed to generate project summary' });
  }
});

// GET /api/summary/:projectId - Get project summary
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const summary = await ProjectSummarySystem.getProjectSummary(parseInt(projectId));
    res.json(summary);
  } catch (error) {
    console.error('Error getting project summary:', error);
    res.status(500).json({ error: 'Failed to get project summary' });
  }
});

module.exports = router;
