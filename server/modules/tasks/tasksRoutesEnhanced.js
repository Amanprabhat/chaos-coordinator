const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidatorEnhanced');
const SLAEngine = require('../sla/SLAEngine');
const { body, validationResult } = require('express-validator');

/**
 * Enhanced Tasks API Routes
 * Base: /api/tasks
 */

// GET /api/tasks - Get all tasks with enhanced filters and SLA status
router.get('/', async (req, res) => {
  try {
    const { 
      project_id, 
      milestone_id, 
      status, 
      owner_id, 
      accountable_id,
      sla_breached,
      due_date_from, 
      due_date_to,
      has_sla 
    } = req.query;
    
    let query = db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'milestones.name as milestone_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'accountable.name as accountable_name',
        'accountable.email as accountable_email',
        db.raw(`
          CASE 
            WHEN tasks.sla_hours > 0 THEN 
              CASE 
                WHEN tasks.sla_breached = true THEN 'breached'
                WHEN tasks.sla_paused = true THEN 'paused'
                WHEN tasks.status = 'completed' THEN 'completed'
                ELSE 'active'
              END
            ELSE 'no_sla'
          END as sla_status
        `),
        db.raw(`
          CASE 
            WHEN tasks.sla_hours > 0 AND tasks.sla_breached = true THEN 
              EXTRACT(EPOCH FROM (tasks.due_date - tasks.sla_start_time)) / 3600
            ELSE NULL
          END as hours_overdue
        `)
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('milestones', 'tasks.milestone_id', 'milestones.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .leftJoin('users as accountable', 'tasks.accountable_id', 'accountable.id')
      .orderBy('tasks.due_date', 'asc');

    // Apply filters
    if (project_id) query = query.where('tasks.project_id', project_id);
    if (milestone_id) query = query.where('tasks.milestone_id', milestone_id);
    if (status) query = query.where('tasks.status', status);
    if (owner_id) query = query.where('tasks.owner_id', owner_id);
    if (accountable_id) query = query.where('tasks.accountable_id', accountable_id);
    if (sla_breached) query = query.where('tasks.sla_breached', sla_breached === 'true');
    if (has_sla) query = query.where('tasks.sla_hours', '>', 0);
    if (due_date_from) query = query.where('tasks.due_date', '>=', due_date_from);
    if (due_date_to) query = query.where('tasks.due_date', '<=', due_date_to);

    const tasks = await query;
    
    // Calculate SLA status for each task
    for (const task of tasks) {
      task.sla_status = SLAEngine.calculateSLAStatus(task);
    }

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - Create new task with enhanced validation and SLA setup
router.post('/', [
  body('title').notEmpty().withMessage('Task title is required'),
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('owner_id').isInt({ min: 1 }).withMessage('Task owner is mandatory'),
  body('accountable_id').optional().isInt({ min: 1 }).withMessage('Valid accountable ID is required'),
  body('milestone_id').optional().isInt({ min: 1 }).withMessage('Invalid milestone ID'),
  body('description').optional().isString(),
  body('status').optional().isIn(['todo', 'in_progress', 'completed', 'blocked', 'at_risk', 'reopened']).withMessage('Invalid status'),
  body('sla_hours').optional().isInt({ min: 0, max: 168 }).withMessage('SLA hours must be between 0 and 168'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date format'),
  body('estimated_hours').optional().isInt({ min: 0 }).withMessage('Estimated hours must be positive'),
  body('completion_comment').optional().isString(),
  body('watchers').optional().isArray().withMessage('Watchers must be an array'),
  body('dependencies').optional().isArray().withMessage('Dependencies must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskData = req.body;

    // Validate enhanced ownership
    OwnershipValidator.validateTaskOwnership(taskData);
    await OwnershipValidator.validateUserExists(taskData.owner_id, db);

    // Validate accountable person if provided
    if (taskData.accountable_id) {
      await OwnershipValidator.validateUserExists(taskData.accountable_id, db);
    }

    // Validate SLA setup
    if (taskData.sla_hours) {
      SLAEngine.validateSLASetup(taskData);
    }

    // Validate dependencies
    if (taskData.dependencies) {
      OwnershipValidator.validateTaskDependencies(taskData.dependencies);
    }

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

    // Validate watchers if provided
    if (taskData.watchers && taskData.watchers.length > 0) {
      for (const watcherId of taskData.watchers) {
        await OwnershipValidator.validateUserExists(watcherId, db);
      }
    }

    const [newTask] = await db('tasks')
      .insert({
        ...taskData,
        status: taskData.status || 'todo',
        sla_breached: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Create task dependencies if provided
    if (taskData.dependencies && taskData.dependencies.length > 0) {
      await db('task_dependencies')
        .insert(
          taskData.dependencies.map(dep => ({
            task_id: newTask.id,
            depends_on_task_id: dep.depends_on_task_id,
            dependency_type: dep.dependency_type || 'finish_to_start',
            created_at: new Date()
          }))
        );
    }

    // Start SLA tracking if task is moving to in_progress
    if (taskData.status === 'in_progress') {
      await SLAEngine.startSLATracking(newTask.id, taskData.owner_id);
    }

    // Log task creation
    await db('audit_logs').insert({
      entity_type: 'task',
      entity_id: newTask.id,
      action: 'task_created',
      new_values: {
        title: taskData.title,
        owner_id: taskData.owner_id,
        accountable_id: taskData.accountable_id,
        sla_hours: taskData.sla_hours,
        has_dependencies: taskData.dependencies ? taskData.dependencies.length : 0
      },
      performed_by: taskData.owner_id,
      timestamp: new Date()
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    if (error.message.includes('owner') || error.message.includes('User') || error.message.includes('not found') || error.message.includes('dependency')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task with enhanced validation
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Task title cannot be empty'),
  body('owner_id').optional().isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('accountable_id').optional().isInt({ min: 1 }).withMessage('Valid accountable ID is required'),
  body('status').optional().isIn(['todo', 'in_progress', 'completed', 'blocked', 'at_risk', 'reopened']).withMessage('Invalid status'),
  body('sla_hours').optional().isInt({ min: 0, max: 168 }).withMessage('SLA hours must be between 0 and 168'),
  body('due_date').optional().isISO8601().withMessage('Invalid due date format'),
  body('estimated_hours').optional().isInt({ min: 0 }).withMessage('Estimated hours must be positive'),
  body('actual_hours').optional().isInt({ min: 0 }).withMessage('Actual hours must be positive'),
  body('completion_comment').optional().isString(),
  body('watchers').optional().isArray().withMessage('Watchers must be an array')
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

    // Validate state transition
    if (updateData.status && existingTask.status !== updateData.status) {
      OwnershipValidator.validateStateTransition(existingTask.status, updateData.status, {
        task_id: id,
        reopen_reason: updateData.reopen_reason
      });
    }

    // Validate enhanced ownership
    if (updateData.owner_id) {
      OwnershipValidator.validateTaskOwnership(updateData);
      await OwnershipValidator.validateUserExists(updateData.owner_id, db);
    }

    // Validate accountable person if being updated
    if (updateData.accountable_id) {
      await OwnershipValidator.validateUserExists(updateData.accountable_id, db);
    }

    // Validate completion comment quality
    if (updateData.status === 'completed' && updateData.completion_comment) {
      OwnershipValidator.validateCommentQuality(updateData.completion_comment, 'completion_comment');
    }

    // Auto-set completion date and handle SLA
    let finalUpdateData = { ...updateData, updated_at: new Date() };
    
    if (updateData.status === 'completed' && existingTask.status !== 'completed') {
      finalUpdateData.completion_date = new Date().toISOString().split('T')[0];
      finalUpdateData.sla_breached = existingTask.sla_breached; // Preserve existing breach status
    }

    if (updateData.status === 'in_progress' && existingTask.status !== 'in_progress') {
      finalUpdateData.sla_start_time = new Date();
      finalUpdateData.sla_paused = false;
      finalUpdateData.sla_pause_reason = null;
    }

    const [updatedTask] = await db('tasks')
      .where('id', id)
      .update(finalUpdateData)
      .returning('*');

    // Log task update
    await db('audit_logs').insert({
      entity_type: 'task',
      entity_id: id,
      action: 'task_updated',
      old_values: {
        status: existingTask.status,
        owner_id: existingTask.owner_id
      },
      new_values: updateData,
      performed_by: updateData.owner_id || existingTask.owner_id,
      timestamp: new Date()
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.message.includes('owner') || error.message.includes('User') || error.message.includes('Invalid') || error.message.includes('transition')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /api/tasks/:id/reopen - Reopen a completed task
router.post('/:id/reopen', [
  body('reopen_reason').isLength({ min: 10 }).withMessage('Reopen reason must be at least 10 characters'),
  body('reopened_by').isInt({ min: 1 }).withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { reopen_reason, reopened_by } = req.body;

    // Check if task exists and is completed
    const existingTask = await db('tasks').where('id', id).first();
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (existingTask.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed tasks can be reopened' });
    }

    // Validate user
    await OwnershipValidator.validateUserExists(reopened_by, db);

    const [reopenedTask] = await db('tasks')
      .where('id', id)
      .update({
        status: 'reopened',
        reopened: true,
        reopen_reason,
        reopen_date: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Log task reopening
    await db('audit_logs').insert({
      entity_type: 'task',
      entity_id: id,
      action: 'task_reopened',
      new_values: {
        status: 'reopened',
        reopened: true,
        reopen_reason: reopen_reason
      },
      performed_by: reopened_by,
      timestamp: new Date()
    });

    res.json({
      message: 'Task reopened successfully',
      task: reopenedTask
    });
  } catch (error) {
    console.error('Error reopening task:', error);
    res.status(500).json({ error: 'Failed to reopen task' });
  }
});

// GET /api/tasks/:id/dependencies - Get task dependencies
router.get('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dependencies = await db('task_dependencies')
      .select(
        'task_dependencies.*',
        'dep_task.title as depends_on_task_title',
        'dep_task.owner.name as depends_on_task_owner',
        'dep_task_status.status as depends_on_task_status'
      )
      .leftJoin('tasks as dep_task', 'task_dependencies.depends_on_task_id', 'dep_task.id')
      .leftJoin('users as dep_task_owner', 'dep_task.owner_id', 'dep_task_owner.id')
      .leftJoin('tasks as dep_task_status', 'task_dependencies.task_id', 'dep_task_status.id')
      .where('task_dependencies.task_id', id)
      .orderBy('task_dependencies.created_at', 'asc');

    res.json(dependencies);
  } catch (error) {
    console.error('Error fetching task dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch task dependencies' });
  }
});

// POST /api/tasks/:id/dependencies - Add task dependencies
router.post('/:id/dependencies', [
  body('dependencies').isArray({ min: 1 }).withMessage('Dependencies array is required'),
  body('dependencies.*.depends_on_task_id').isInt({ min: 1 }).withMessage('Valid task ID is required'),
  body('dependencies.*.dependency_type').optional().isIn(['finish_to_start', 'start_to_start', 'finish_to_finish']).withMessage('Invalid dependency type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { dependencies } = req.body;

    // Check if task exists
    const existingTask = await db('tasks').where('id', id).first();
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Validate dependencies
    OwnershipValidator.validateTaskDependencies(dependencies);

    // Insert dependencies
    await db('task_dependencies')
      .insert(
        dependencies.map(dep => ({
          task_id: id,
          depends_on_task_id: dep.depends_on_task_id,
          dependency_type: dep.dependency_type || 'finish_to_start',
          created_at: new Date()
        }))
      );

    // Log dependency addition
    await db('audit_logs').insert({
      entity_type: 'task',
      entity_id: id,
      action: 'dependencies_added',
      new_values: { dependencies_count: dependencies.length },
      performed_by: existingTask.owner_id,
      timestamp: new Date()
    });

    res.json({
      message: `${dependencies.length} dependencies added successfully`,
      dependencies_added: dependencies.length
    });
  } catch (error) {
    console.error('Error adding task dependencies:', error);
    res.status(500).json({ error: 'Failed to add task dependencies' });
  }
});

// GET /api/tasks/sla-breaches - Get SLA breaches with escalation info
router.get('/sla-breaches', async (req, res) => {
  try {
    const { project_id, severity } = req.query;
    
    let whereClause = 'tasks.sla_breached = true';
    if (project_id) whereClause += ` AND tasks.project_id = ${project_id}`;
    if (severity) whereClause += ` AND tasks.sla_status = '${severity}'`;

    const breachedTasks = await db('tasks')
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_name',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'owner.manager_id',
        'manager.name as manager_name',
        'manager.email as manager_email',
        db.raw('EXTRACT(EPOCH FROM (tasks.due_date - tasks.sla_start_time)) / 3600 as hours_overdue')
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('users as owner', 'tasks.owner_id', 'owner.id')
      .leftJoin('users as manager', 'users.manager_id', 'manager.id')
      .whereRaw(whereClause)
      .orderBy('tasks.sla_breach_duration', 'desc');

    // Add escalation recommendations
    for (const task of breachedTasks) {
      task.escalation_level = task.hours_overdue > 72 ? 'project_owner' : (task.hours_overdue > 48 ? 'manager' : 'owner');
      task.escalation_recommended = task.hours_overdue > 72;
    }

    res.json({
      message: 'SLA breaches',
      count: breachedTasks.length,
      tasks: breachedTasks
    });
  } catch (error) {
    console.error('Error fetching SLA breaches:', error);
    res.status(500).json({ error: 'Failed to fetch SLA breaches' });
  }
});

module.exports = router;
