const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidator');
const LifecycleEngine = require('../lifecycle/LifecycleEngine');
const { body, validationResult } = require('express-validator');

/**
 * Projects API Routes
 * Base: /api/projects
 */

// GET /api/projects - Get all projects with optional filters
router.get('/', async (req, res) => {
  try {
    const { stage, status, owner_id } = req.query;
    let query = db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as stage_name',
        'users.name as owner_name',
        'users.email as owner_email',
        'users.role as owner_role'
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .join('users', 'projects.owner_id', 'users.id')
      .orderBy('projects.updated_at', 'desc');

    // Apply filters
    if (stage) {
      query = query.where('lifecycle_stages.name', 'ilike', `%${stage}%`);
    }
    if (status) {
      query = query.where('projects.status', status);
    }
    if (owner_id) {
      query = query.where('projects.owner_id', owner_id);
    }

    const projects = await query;
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get single project with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as stage_name',
        'lifecycle_stages.display_order as stage_order',
        'users.name as owner_name',
        'users.email as owner_email',
        'users.role as owner_role'
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .join('users', 'projects.owner_id', 'users.id')
      .where('projects.id', id)
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project statistics
    const stats = await getProjectStats(id);
    project.stats = stats;

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', [
  body('name').notEmpty().withMessage('Project name is required'),
  body('client_name').notEmpty().withMessage('Client name is required'),
  body('owner_id').isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  body('target_go_live_date').optional().isISO8601().withMessage('Invalid target go-live date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const projectData = req.body;

    // Validate ownership
    OwnershipValidator.validateProjectOwnership(projectData);
    await OwnershipValidator.validateUserExists(projectData.owner_id, db);

    // Set default stage to 'Lead' (stage with display_order = 1)
    const leadStage = await db('lifecycle_stages')
      .where('display_order', 1)
      .first();

    if (!leadStage) {
      return res.status(500).json({ error: 'Lead stage not configured' });
    }

    const [newProject] = await db('projects')
      .insert({
        ...projectData,
        current_stage_id: leadStage.id,
        status: projectData.status || 'active',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Project name cannot be empty'),
  body('client_name').optional().notEmpty().withMessage('Client name cannot be empty'),
  body('owner_id').optional().isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if project exists
    const existingProject = await db('projects').where('id', id).first();
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate ownership if being updated
    if (updateData.owner_id) {
      OwnershipValidator.validateProjectOwnership(updateData);
      await OwnershipValidator.validateUserExists(updateData.owner_id, db);
    }

    const [updatedProject] = await db('projects')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      })
      .returning('*');

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// POST /api/projects/:id/transition-stage - Transition to next stage
router.post('/:id/transition-stage', [
  body('requested_by').isInt({ min: 1 }).withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { requested_by } = req.body;

    // Validate user exists
    await OwnershipValidator.validateUserExists(requested_by, db);

    // Perform stage transition
    const updatedProject = await LifecycleEngine.transitionToNextStage(id, requested_by);

    res.json({
      message: 'Stage transition successful',
      project: updatedProject
    });
  } catch (error) {
    console.error('Error transitioning stage:', error);
    if (error.message.includes('not found') || error.message.includes('Cannot transition')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to transition stage' });
  }
});

// GET /api/projects/:id/can-transition - Check if project can transition
router.get('/:id/can-transition', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current stage
    const currentStage = await LifecycleEngine.getCurrentStage(id);
    
    // Get next stage
    const nextStage = await db('lifecycle_stages')
      .where('display_order', currentStage.display_order + 1)
      .first();

    if (!nextStage) {
      return res.json({
        canTransition: false,
        message: 'Project is already in the final stage',
        currentStage: currentStage,
        nextStage: null
      });
    }

    // Check transition eligibility
    const transitionCheck = await LifecycleEngine.canTransitionToStage(id, nextStage.id);

    res.json({
      currentStage: currentStage,
      nextStage: nextStage,
      ...transitionCheck
    });
  } catch (error) {
    console.error('Error checking transition eligibility:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to check transition eligibility' });
  }
});

// DELETE /api/projects/:id - Delete project (soft delete by setting status to cancelled)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [deletedProject] = await db('projects')
      .where('id', id)
      .update({
        status: 'cancelled',
        updated_at: new Date()
      })
      .returning('*');

    if (!deletedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project cancelled successfully', project: deletedProject });
  } catch (error) {
    console.error('Error cancelling project:', error);
    res.status(500).json({ error: 'Failed to cancel project' });
  }
});

// Helper function to get project statistics
async function getProjectStats(projectId) {
  try {
    const [
      taskStats,
      milestoneStats,
      riskStats,
      changeStats
    ] = await Promise.all([
      db('tasks')
        .where('project_id', projectId)
        .select('status')
        .then(tasks => {
          const stats = { total: tasks.length, byStatus: {} };
          tasks.forEach(task => {
            stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
          });
          return stats;
        }),
      db('milestones')
        .where('project_id', projectId)
        .select('status')
        .then(milestones => {
          const stats = { total: milestones.length, byStatus: {} };
          milestones.forEach(milestone => {
            stats.byStatus[milestone.status] = (stats.byStatus[milestone.status] || 0) + 1;
          });
          return stats;
        }),
      db('risks')
        .where('project_id', projectId)
        .select('severity', 'status')
        .then(risks => {
          const stats = { total: risks.length, bySeverity: {}, byStatus: {} };
          risks.forEach(risk => {
            stats.bySeverity[risk.severity] = (stats.bySeverity[risk.severity] || 0) + 1;
            stats.byStatus[risk.status] = (stats.byStatus[risk.status] || 0) + 1;
          });
          return stats;
        }),
      db('changes')
        .where('project_id', projectId)
        .select('status')
        .then(changes => {
          const stats = { total: changes.length, byStatus: {} };
          changes.forEach(change => {
            stats.byStatus[change.status] = (stats.byStatus[change.status] || 0) + 1;
          });
          return stats;
        })
    ]);

    return {
      tasks: taskStats,
      milestones: milestoneStats,
      risks: riskStats,
      changes: changeStats
    };
  } catch (error) {
    console.error('Error fetching project stats:', error);
    return {
      tasks: { total: 0, byStatus: {} },
      milestones: { total: 0, byStatus: {} },
      risks: { total: 0, byStatus: {}, bySeverity: {} },
      changes: { total: 0, byStatus: {} }
    };
  }
}

module.exports = router;
