const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidator');
const { body, validationResult } = require('express-validator');

/**
 * Milestones API Routes
 * Base: /api/milestones
 */

// GET /api/milestones - Get all milestones with optional filters
router.get('/', async (req, res) => {
  try {
    const { project_id, status, owner_id, due_date_from, due_date_to } = req.query;
    
    let query = db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.role as owner_role'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .orderBy('milestones.due_date', 'asc');

    // Apply filters
    if (project_id) {
      query = query.where('milestones.project_id', project_id);
    }
    if (status) {
      query = query.where('milestones.status', status);
    }
    if (owner_id) {
      query = query.where('milestones.owner_id', owner_id);
    }
    if (due_date_from) {
      query = query.where('milestones.due_date', '>=', due_date_from);
    }
    if (due_date_to) {
      query = query.where('milestones.due_date', '<=', due_date_to);
    }

    const milestones = await query;
    res.json(milestones);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// GET /api/milestones/:id - Get single milestone with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const milestone = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.current_stage_id',
        'lifecycle_stages.name as project_stage',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.role as owner_role'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.id', id)
      .first();

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Get tasks for this milestone
    const tasks = await db('tasks')
      .select(
        'tasks.*',
        'users.name as owner_name',
        'users.email as owner_email'
      )
      .leftJoin('users', 'tasks.owner_id', 'users.id')
      .where('tasks.milestone_id', id)
      .orderBy('tasks.due_date', 'asc');

    milestone.tasks = tasks;

    // Calculate milestone progress
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalTasks = tasks.length;
    milestone.progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    res.json(milestone);
  } catch (error) {
    console.error('Error fetching milestone:', error);
    res.status(500).json({ error: 'Failed to fetch milestone' });
  }
});

// POST /api/milestones - Create new milestone
router.post('/', [
  body('name').notEmpty().withMessage('Milestone name is required'),
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('owner_id').isInt({ min: 1 }).withMessage('Milestone owner is mandatory'),
  body('due_date').isISO8601().withMessage('Valid due date is required'),
  body('description').optional().isString(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'blocked']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const milestoneData = req.body;

    // Validate ownership
    OwnershipValidator.validateMilestoneOwnership(milestoneData);
    await OwnershipValidator.validateUserExists(milestoneData.owner_id, db);

    // Validate project exists
    const project = await db('projects').where('id', milestoneData.project_id).first();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    const [newMilestone] = await db('milestones')
      .insert({
        ...milestoneData,
        status: milestoneData.status || 'pending',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    res.status(201).json(newMilestone);
  } catch (error) {
    console.error('Error creating milestone:', error);
    if (error.message.includes('owner') || error.message.includes('User') || error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// PUT /api/milestones/:id - Update milestone
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Milestone name cannot be empty'),
  body('owner_id').optional().isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'blocked']).withMessage('Invalid status'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if milestone exists
    const existingMilestone = await db('milestones').where('id', id).first();
    if (!existingMilestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Validate ownership if being updated
    if (updateData.owner_id) {
      OwnershipValidator.validateMilestoneOwnership(updateData);
      await OwnershipValidator.validateUserExists(updateData.owner_id, db);
    }

    // Auto-set completion date if status is being set to completed
    if (updateData.status === 'completed' && existingMilestone.status !== 'completed') {
      updateData.completion_date = new Date().toISOString().split('T')[0];
    }

    const [updatedMilestone] = await db('milestones')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      })
      .returning('*');

    res.json(updatedMilestone);
  } catch (error) {
    console.error('Error updating milestone:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// DELETE /api/milestones/:id - Delete milestone
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if milestone has tasks
    const taskCount = await db('tasks').where('milestone_id', id).count('* as count');
    if (taskCount[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete milestone with associated tasks',
        taskCount: taskCount[0].count
      });
    }

    const deletedMilestone = await db('milestones').where('id', id).del();
    
    if (deletedMilestone === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// GET /api/milestones/project/:projectId - Get all milestones for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const milestones = await db('milestones')
      .select(
        'milestones.*',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.project_id', projectId)
      .orderBy('milestones.due_date', 'asc');

    // Add task counts and progress for each milestone
    for (const milestone of milestones) {
      const tasks = await db('tasks')
        .where('milestone_id', milestone.id)
        .select('status');
      
      milestone.task_stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        todo: tasks.filter(t => t.status === 'todo').length,
        blocked: tasks.filter(t => t.status === 'blocked').length
      };
      
      milestone.progress = tasks.length > 0 
        ? (milestone.task_stats.completed / tasks.length) * 100 
        : 0;
    }

    res.json(milestones);
  } catch (error) {
    console.error('Error fetching project milestones:', error);
    res.status(500).json({ error: 'Failed to fetch project milestones' });
  }
});

// GET /api/milestones/blocked - Get blocked milestones
router.get('/blocked', async (req, res) => {
  try {
    const blockedMilestones = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.status', 'blocked')
      .orderBy('milestones.due_date', 'asc');

    // Get blocking tasks for each milestone
    for (const milestone of blockedMilestones) {
      const blockingTasks = await db('tasks')
        .where({
          milestone_id: milestone.id,
          status: 'blocked'
        })
        .select('title', 'description', 'owner_id');
      
      milestone.blocking_tasks = blockingTasks;
    }

    res.json({
      message: 'Blocked milestones',
      count: blockedMilestones.length,
      milestones: blockedMilestones
    });
  } catch (error) {
    console.error('Error fetching blocked milestones:', error);
    res.status(500).json({ error: 'Failed to fetch blocked milestones' });
  }
});

// GET /api/milestones/overdue - Get overdue milestones
router.get('/overdue', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const overdueMilestones = await db('milestones')
      .select(
        'milestones.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'milestones.project_id', 'projects.id')
      .leftJoin('users as owner', 'milestones.owner_id', 'owner.id')
      .where('milestones.due_date', '<', today)
      .where('milestones.status', 'in', ['pending', 'in_progress'])
      .orderBy('milestones.due_date', 'asc');

    // Calculate days overdue
    for (const milestone of overdueMilestones) {
      const dueDate = new Date(milestone.due_date);
      const todayDate = new Date(today);
      milestone.days_overdue = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
    }

    res.json({
      message: 'Overdue milestones',
      count: overdueMilestones.length,
      milestones: overdueMilestones
    });
  } catch (error) {
    console.error('Error fetching overdue milestones:', error);
    res.status(500).json({ error: 'Failed to fetch overdue milestones' });
  }
});

// POST /api/milestones/:id/complete - Mark milestone as complete
router.post('/:id/complete', [
  body('completed_by').isInt({ min: 1 }).withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { completed_by } = req.body;

    // Validate user
    await OwnershipValidator.validateUserExists(completed_by, db);

    // Check if milestone exists
    const existingMilestone = await db('milestones').where('id', id).first();
    if (!existingMilestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (existingMilestone.status === 'completed') {
      return res.status(400).json({ error: 'Milestone is already completed' });
    }

    const [updatedMilestone] = await db('milestones')
      .where('id', id)
      .update({
        status: 'completed',
        completion_date: new Date().toISOString().split('T')[0],
        updated_at: new Date()
      })
      .returning('*');

    // Log milestone completion
    await db('activity_log').insert({
      project_id: existingMilestone.project_id,
      action: 'milestone_completed',
      details: JSON.stringify({
        milestone_id: id,
        milestone_name: existingMilestone.name,
        completed_by: completed_by,
        completion_date: updatedMilestone.completion_date,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.json({
      message: 'Milestone completed successfully',
      milestone: updatedMilestone
    });
  } catch (error) {
    console.error('Error completing milestone:', error);
    if (error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

module.exports = router;
