const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidator');
const { body, validationResult } = require('express-validator');

/**
 * Tasks API Routes
 * Base: /api/tasks
 */

// GET /api/tasks - Get all tasks with optional filters
router.get('/', async (req, res) => {
  try {
    const { project_id, milestone_id, status, owner_id, due_date_from, due_date_to } = req.query;
    
    let query = db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'milestones.name as milestone_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.role as owner_role'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('milestones', 'tasks.milestone_id', 'milestones.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .orderBy('tasks.due_date', 'asc');

    // Apply filters
    if (project_id) {
      query = query.where('tasks.project_id', project_id);
    }
    if (milestone_id) {
      query = query.where('tasks.milestone_id', milestone_id);
    }
    if (status) {
      query = query.where('tasks.status', status);
    }
    if (owner_id) {
      query = query.where('tasks.owner_id', owner_id);
    }
    if (due_date_from) {
      query = query.where('tasks.due_date', '>=', due_date_from);
    }
    if (due_date_to) {
      query = query.where('tasks.due_date', '<=', due_date_to);
    }

    const tasks = await query;
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:id - Get single task with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'milestones.name as milestone_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.role as owner_role'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('milestones', 'tasks.milestone_id', 'milestones.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .where('tasks.id', id)
      .first();

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get contributor details if any
    if (task.contributors && task.contributors.length > 0) {
      const contributors = await db('users')
        .select('id', 'name', 'email', 'role')
        .whereIn('id', task.contributors);
      task.contributor_details = contributors;
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks - Create new task with mandatory owner
router.post('/', [
  body('title').notEmpty().withMessage('Task title is required'),
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('owner_id').isInt({ min: 1 }).withMessage('Task owner is mandatory'),
  body('milestone_id').optional().isInt({ min: 1 }).withMessage('Invalid milestone ID'),
  body('description').optional().isString(),
  body('status').optional().isIn(['todo', 'in_progress', 'completed', 'blocked']).withMessage('Invalid status'),
  body('contributors').optional().isArray().withMessage('Contributors must be an array'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date format'),
  body('estimated_hours').optional().isInt({ min: 0 }).withMessage('Estimated hours must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskData = req.body;

    // Validate mandatory ownership
    OwnershipValidator.validateTaskOwnership(taskData);
    await OwnershipValidator.validateUserExists(taskData.owner_id, db);

    // Validate project exists
    const project = await db('projects').where('id', taskData.project_id).first();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    // Validate milestone if provided
    if (taskData.milestone_id) {
      const milestone = await db('milestones')
        .where({ id: taskData.milestone_id, project_id: taskData.project_id })
        .first();
      if (!milestone) {
        return res.status(400).json({ error: 'Milestone not found or does not belong to this project' });
      }
    }

    // Validate contributors if provided
    if (taskData.contributors && taskData.contributors.length > 0) {
      for (const contributorId of taskData.contributors) {
        await OwnershipValidator.validateUserExists(contributorId, db);
      }
    }

    const [newTask] = await db('tasks')
      .insert({
        ...taskData,
        status: taskData.status || 'todo',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    if (error.message.includes('owner') || error.message.includes('User') || error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Task title cannot be empty'),
  body('owner_id').optional().isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'completed', 'blocked']).withMessage('Invalid status'),
  body('contributors').optional().isArray().withMessage('Contributors must be an array'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date format'),
  body('estimated_hours').optional().isInt({ min: 0 }).withMessage('Estimated hours must be positive'),
  body('actual_hours').optional().isInt({ min: 0 }).withMessage('Actual hours must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if task exists
    const existingTask = await db('tasks').where('id', id).first();
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate ownership if being updated
    if (updateData.owner_id) {
      OwnershipValidator.validateTaskOwnership(updateData);
      await OwnershipValidator.validateUserExists(updateData.owner_id, db);
    }

    // Validate contributors if being updated
    if (updateData.contributors) {
      for (const contributorId of updateData.contributors) {
        await OwnershipValidator.validateUserExists(contributorId, db);
      }
    }

    // Auto-set completion date if status is being set to completed
    if (updateData.status === 'completed' && existingTask.status !== 'completed') {
      updateData.completion_date = new Date().toISOString().split('T')[0];
    }

    const [updatedTask] = await db('tasks')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      })
      .returning('*');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTask = await db('tasks').where('id', id).del();
    
    if (deletedTask === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/batch - Create multiple tasks at once
router.post('/batch', [
  body('tasks').isArray({ min: 1 }).withMessage('Tasks array is required'),
  body('tasks.*.title').notEmpty().withMessage('Task title is required'),
  body('tasks.*.project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('tasks.*.owner_id').isInt({ min: 1 }).withMessage('Task owner is mandatory')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tasks } = req.body;

    // Validate all tasks have mandatory owners
    OwnershipValidator.validateMultipleTasks(tasks);

    // Validate all users exist
    const userIds = new Set();
    tasks.forEach(task => {
      userIds.add(task.owner_id);
      if (task.contributors) {
        task.contributors.forEach(id => userIds.add(id));
      }
    });

    for (const userId of userIds) {
      await OwnershipValidator.validateUserExists(userId, db);
    }

    // Insert all tasks
    const insertedTasks = await db('tasks')
      .insert(
        tasks.map(task => ({
          ...task,
          status: task.status || 'todo',
          created_at: new Date(),
          updated_at: new Date()
        }))
      )
      .returning('*');

    res.status(201).json({
      message: `${insertedTasks.length} tasks created successfully`,
      tasks: insertedTasks
    });
  } catch (error) {
    console.error('Error creating batch tasks:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create batch tasks' });
  }
});

// GET /api/tasks/orphaned - Get tasks without owners (should return empty due to validation)
router.get('/orphaned', async (req, res) => {
  try {
    const orphanedTasks = await db('tasks')
      .whereNull('owner_id')
      .select('*');

    // This should always return empty due to database constraint
    res.json({
      message: 'Orphaned tasks (should be empty due to validation)',
      count: orphanedTasks.length,
      tasks: orphanedTasks
    });
  } catch (error) {
    console.error('Error fetching orphaned tasks:', error);
    res.status(500).json({ error: 'Failed to fetch orphaned tasks' });
  }
});

// GET /api/tasks/overdue - Get overdue tasks
router.get('/overdue', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const overdueTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .where('tasks.due_date', '<', today)
      .where('tasks.status', 'in', ['todo', 'in_progress'])
      .orderBy('tasks.due_date', 'asc');

    res.json({
      message: 'Overdue tasks',
      count: overdueTasks.length,
      tasks: overdueTasks
    });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    res.status(500).json({ error: 'Failed to fetch overdue tasks' });
  }
});

// POST /api/tasks/:id/assign - Assign task to new owner
router.post('/:id/assign', [
  body('owner_id').isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('assigned_by').isInt({ min: 1 }).withMessage('Valid assigned by user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { owner_id, assigned_by } = req.body;

    // Validate new owner
    OwnershipValidator.validateTaskOwnership({ owner_id });
    await OwnershipValidator.validateUserExists(owner_id, db);
    await OwnershipValidator.validateUserExists(assigned_by, db);

    // Check if task exists
    const existingTask = await db('tasks').where('id', id).first();
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const [updatedTask] = await db('tasks')
      .where('id', id)
      .update({
        owner_id,
        updated_at: new Date()
      })
      .returning('*');

    // Log assignment change
    await db('activity_log').insert({
      project_id: existingTask.project_id,
      action: 'task_assigned',
      details: JSON.stringify({
        task_id: id,
        old_owner_id: existingTask.owner_id,
        new_owner_id: owner_id,
        assigned_by: assigned_by,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.json({
      message: 'Task assigned successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error assigning task:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

module.exports = router;
