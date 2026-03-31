const express = require('express');
const router = express.Router();
const RoleBasedDashboard = require('../dashboard/RoleBasedDashboard');
const GuidedWorkflow = require('../workflow/GuidedWorkflow');
const SimplifiedMode = require('../simplified/SimplifiedMode');
const AutoAssignmentEngine = require('../auto-assignment/AutoAssignmentEngine');
const SmartNotificationSystem = require('../notifications/SmartNotificationSystem');
const ProjectHealthScoring = require('../health/ProjectHealthScoring');
const ActivityTimeline = require('../activity/ActivityTimeline');

/**
 * Enhanced Dashboard API Routes
 * Base: /api/dashboard/enhanced
 */

// GET /api/dashboard/enhanced/role/:userId - Get role-based dashboard
router.get('/role/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { user_role } = req.query;

    if (!user_role) {
      return res.status(400).json({ error: 'User role is required' });
    }

    const dashboard = await RoleBasedDashboard.getRoleDashboard(parseInt(userId), user_role);
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting role dashboard:', error);
    res.status(500).json({ error: 'Failed to get role dashboard' });
  }
});

// GET /api/dashboard/enhanced/workflow/:projectId - Get guided workflow
router.get('/workflow/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const workflow = await GuidedWorkflow.getProjectWorkflow(parseInt(projectId), parseInt(user_id));
    res.json(workflow);
  } catch (error) {
    console.error('Error getting guided workflow:', error);
    res.status(500).json({ error: 'Failed to get guided workflow' });
  }
});

// GET /api/dashboard/enhanced/recommendations/:projectId - Get action recommendations
router.get('/recommendations/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const recommendations = await GuidedWorkflow.getActionRecommendations(parseInt(projectId), parseInt(user_id));
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting action recommendations:', error);
    res.status(500).json({ error: 'Failed to get action recommendations' });
  }
});

// GET /api/dashboard/enhanced/empty-state/:userRole - Get empty state guidance
router.get('/empty-state/:userRole', async (req, res) => {
  try {
    const { userRole } = req.params;
    const guidance = await GuidedWorkflow.getEmptyStateGuidance(userRole);
    res.json(guidance);
  } catch (error) {
    console.error('Error getting empty state guidance:', error);
    res.status(500).json({ error: 'Failed to get empty state guidance' });
  }
});

// GET /api/dashboard/enhanced/simplified-mode/:projectId - Get simplified mode settings
router.get('/simplified-mode/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const simplifiedMode = await SimplifiedMode.getProjectSimplifiedMode(parseInt(projectId));
    res.json(simplifiedMode);
  } catch (error) {
    console.error('Error getting simplified mode:', error);
    res.status(500).json({ error: 'Failed to get simplified mode' });
  }
});

// PUT /api/dashboard/enhanced/simplified-mode/:projectId - Update simplified mode settings
router.put('/simplified-mode/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { strict_mode, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const updatedSettings = await SimplifiedMode.updateSimplifiedMode(parseInt(projectId), { strict_mode }, parseInt(user_id));
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating simplified mode:', error);
    res.status(500).json({ error: 'Failed to update simplified mode' });
  }
});

// GET /api/dashboard/enhanced/validation-rules/:projectId - Get validation rules
router.get('/validation-rules/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const validationRules = await SimplifiedMode.getValidationRules(parseInt(projectId));
    res.json(validationRules);
  } catch (error) {
    console.error('Error getting validation rules:', error);
    res.status(500).json({ error: 'Failed to get validation rules' });
  }
});

// POST /api/dashboard/enhanced/validate-task/:projectId - Validate task creation
router.post('/validate-task/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const taskData = req.body;

    const validation = await SimplifiedMode.validateTaskCreation(parseInt(projectId), taskData);
    res.json(validation);
  } catch (error) {
    console.error('Error validating task creation:', error);
    res.status(500).json({ error: 'Failed to validate task creation' });
  }
});

// POST /api/dashboard/enhanced/validate-completion/:projectId - Validate task completion
router.post('/validate-completion/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const taskData = req.body;

    const validation = await SimplifiedMode.validateTaskCompletion(parseInt(projectId), taskData);
    res.json(validation);
  } catch (error) {
    console.error('Error validating task completion:', error);
    res.status(500).json({ error: 'Failed to validate task completion' });
  }
});

// POST /api/dashboard/enhanced/validate-transition/:projectId - Validate stage transition
router.post('/validate-transition/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { target_stage } = req.body;

    if (!target_stage) {
      return res.status(400).json({ error: 'Target stage is required' });
    }

    const validation = await SimplifiedMode.validateStageTransition(parseInt(projectId), target_stage);
    res.json(validation);
  } catch (error) {
    console.error('Error validating stage transition:', error);
    res.status(500).json({ error: 'Failed to validate stage transition' });
  }
});

// GET /api/dashboard/enhanced/health/:projectId - Get project health score
router.get('/health/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const healthScore = await ProjectHealthScoring.calculateProjectHealth(parseInt(projectId));
    res.json(healthScore);
  } catch (error) {
    console.error('Error calculating project health:', error);
    res.status(500).json({ error: 'Failed to calculate project health' });
  }
});

// GET /api/dashboard/enhanced/health-all - Get all project health scores
router.get('/health-all', async (req, res) => {
  try {
    const healthScores = await ProjectHealthScoring.getAllProjectHealthScores();
    res.json(healthScores);
  } catch (error) {
    console.error('Error getting all project health scores:', error);
    res.status(500).json({ error: 'Failed to get all project health scores' });
  }
});

// GET /api/dashboard/enhanced/health-needs-attention - Get projects needing attention
router.get('/health-needs-attention', async (req, res) => {
  try {
    const { threshold } = req.query;
    const projects = await ProjectHealthScoring.getProjectsNeedingAttention(parseInt(threshold) || 50);
    res.json(projects);
  } catch (error) {
    console.error('Error getting projects needing attention:', error);
    res.status(500).json({ error: 'Failed to get projects needing attention' });
  }
});

// GET /api/dashboard/enhanced/timeline/:projectId - Get project timeline
router.get('/timeline/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit, start_date, end_date, activity_type } = req.query;

    const timeline = await ActivityTimeline.getProjectTimeline(parseInt(projectId), {
      limit: parseInt(limit) || 100,
      start_date,
      end_date,
      activity_type
    });
    res.json(timeline);
  } catch (error) {
    console.error('Error getting project timeline:', error);
    res.status(500).json({ error: 'Failed to get project timeline' });
  }
});

// GET /api/dashboard/enhanced/velocity/:projectId - Get project velocity
router.get('/velocity/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days } = req.query;

    const velocity = await ActivityTimeline.getProjectVelocity(parseInt(projectId), parseInt(days) || 30);
    res.json(velocity);
  } catch (error) {
    console.error('Error getting project velocity:', error);
    res.status(500).json({ error: 'Failed to get project velocity' });
  }
});

// GET /api/dashboard/enhanced/burndown/:projectId - Get project burndown data
router.get('/burndown/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const burndown = await ActivityTimeline.getBurndownData(parseInt(projectId));
    res.json(burndown);
  } catch (error) {
    console.error('Error getting project burndown:', error);
    res.status(500).json({ error: 'Failed to get project burndown' });
  }
});

// GET /api/dashboard/enhanced/notifications/:userId - Get user notifications
router.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, unread_only, type, mark_as_read } = req.query;

    const notifications = await SmartNotificationSystem.getUserNotifications(parseInt(userId), {
      limit: parseInt(limit) || 50,
      unread_only: unread_only === 'true',
      type,
      mark_as_read: mark_as_read === 'true'
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    res.status(500).json({ error: 'Failed to get user notifications' });
  }
});

// GET /api/dashboard/enhanced/notifications/unread/:userId - Get unread count
router.get('/notifications/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await SmartNotificationSystem.getUnreadCount(parseInt(userId));
    res.json({ unread_count: count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// PUT /api/dashboard/enhanced/notifications/:notificationId/read - Mark notification as read
router.put('/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const success = await SmartNotificationSystem.markAsRead(parseInt(notificationId), parseInt(user_id));
    res.json({ success });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// GET /api/dashboard/enhanced/templates - Get project templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await AutoAssignmentEngine.getProjectTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting project templates:', error);
    res.status(500).json({ error: 'Failed to get project templates' });
  }
});

// POST /api/dashboard/enhanced/create-from-template/:templateId - Create project from template
router.post('/create-from-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { project_data, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await AutoAssignmentEngine.createProjectFromTemplate(parseInt(templateId), project_data, parseInt(user_id));
    res.json(result);
  } catch (error) {
    console.error('Error creating project from template:', error);
    res.status(500).json({ error: 'Failed to create project from template' });
  }
});

// GET /api/dashboard/enhanced/assignment-suggestions/:projectId - Get assignment suggestions
router.get('/assignment-suggestions/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const suggestions = await AutoAssignmentEngine.getAssignmentSuggestions(parseInt(projectId));
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting assignment suggestions:', error);
    res.status(500).json({ error: 'Failed to get assignment suggestions' });
  }
});

// POST /api/dashboard/enhanced/auto-assign/:projectId - Auto-assign tasks
router.post('/auto-assign/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { max_hours_per_user, prioritize_critical, consider_skills } = req.body;

    const result = await AutoAssignmentEngine.autoAssignTasks(parseInt(projectId), {
      max_hours_per_user: parseInt(max_hours_per_user) || 40,
      prioritize_critical: prioritize_critical !== false,
      consider_skills: consider_skills !== false
    });
    res.json(result);
  } catch (error) {
    console.error('Error auto-assigning tasks:', error);
    res.status(500).json({ error: 'Failed to auto-assign tasks' });
  }
});

// GET /api/dashboard/enhanced/simplified-mode-stats - Get simplified mode statistics
router.get('/simplified-mode-stats', async (req, res) => {
  try {
    const stats = await SimplifiedMode.getSimplifiedModeStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting simplified mode stats:', error);
    res.status(500).json({ error: 'Failed to get simplified mode stats' });
  }
});

module.exports = router;
