const Task = require('../database/models/Task');
const Project = require('../database/models/Project');
const { validationResult } = require('express-validator');

class TaskController {
  static async createTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { project_id } = req.body;
      
      const project = await Project.findById(project_id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (req.user.role !== 'admin' && project.pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const taskData = {
        ...req.body,
        creator_id: req.user.id
      };

      const task = await Task.create(taskData);

      await this.logActivity({
        entity_type: 'task',
        entity_id: task.id,
        user_id: req.user.id,
        content: `Task "${task.title}" created in project "${project.name}"`,
        action_type: 'created'
      });

      if (task.assignee_id) {
        await this.notifyAssignee(task, 'created');
      }

      res.status(201).json({
        message: 'Task created successfully',
        task
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTasks(req, res) {
    try {
      const { project_id, assignee_id, status } = req.query;
      let tasks;

      if (assignee_id) {
        tasks = await Task.getTasksByAssignee(assignee_id);
      } else if (project_id) {
        tasks = await Task.getTasksByProject(project_id);
      } else {
        tasks = await Task.findAll({ project_id, assignee_id, status });
      }

      res.json({ tasks });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTask(req, res) {
    try {
      const { id } = req.params;
      const task = await Task.getTaskDetails(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await Project.findById(task.project_id);
      if (req.user.role !== 'admin' && 
          project.pm_id !== req.user.id && 
          task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ task });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const task = await Task.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await Project.findById(task.project_id);
      if (req.user.role !== 'admin' && 
          project.pm_id !== req.user.id && 
          task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedTask = await Task.update(id, req.body);

      await this.logActivity({
        entity_type: 'task',
        entity_id: id,
        user_id: req.user.id,
        content: `Task "${updatedTask.title}" updated`,
        action_type: 'updated'
      });

      if (req.body.assignee_id && req.body.assignee_id !== task.assignee_id) {
        await this.notifyAssignee(updatedTask, 'assigned');
      }

      res.json({
        message: 'Task updated successfully',
        task: updatedTask
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateTaskStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['todo', 'in_progress', 'blocked', 'review', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const task = await Task.findById(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await Project.findById(task.project_id);
      if (req.user.role !== 'admin' && 
          project.pm_id !== req.user.id && 
          task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedTask = await Task.updateStatus(id, status);

      await this.logActivity({
        entity_type: 'task',
        entity_id: id,
        user_id: req.user.id,
        content: `Task "${updatedTask.title}" status changed to ${status}`,
        action_type: 'status_change'
      });

      if (status === 'completed') {
        await this.checkDependencies(id);
      }

      res.json({
        message: 'Task status updated successfully',
        task: updatedTask
      });
    } catch (error) {
      console.error('Update task status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async completeTask(req, res) {
    try {
      const { id } = req.params;
      const task = await Task.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await Project.findById(task.project_id);
      if (req.user.role !== 'admin' && 
          project.pm_id !== req.user.id && 
          task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const completedTask = await Task.completeTask(id);

      await this.logActivity({
        entity_type: 'task',
        entity_id: id,
        user_id: req.user.id,
        content: `Task "${completedTask.title}" completed`,
        action_type: 'completed'
      });

      await this.checkDependencies(id);

      res.json({
        message: 'Task completed successfully',
        task: completedTask
      });
    } catch (error) {
      console.error('Complete task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getOverdueTasks(req, res) {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'pm') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const tasks = await Task.getOverdueTasks();
      res.json({ tasks });
    } catch (error) {
      console.error('Get overdue tasks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getBlockedTasks(req, res) {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'pm') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const tasks = await Task.getBlockedTasks();
      res.json({ tasks });
    } catch (error) {
      console.error('Get blocked tasks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async checkDependencies(completedTaskId) {
    const db = require('../database/connection');
    
    const dependentTasks = await db('dependencies')
      .join('tasks', 'tasks.id', 'dependencies.task_id')
      .where('dependencies.depends_on_task_id', completedTaskId)
      .select('tasks.*');

    for (const task of dependentTasks) {
      const remainingDeps = await db('dependencies')
        .where('task_id', task.id)
        .join('tasks', 'tasks.id', 'dependencies.depends_on_task_id')
        .where('tasks.status', '!=', 'completed')
        .count('* as count');

      if (remainingDeps[0].count == 0) {
        await Task.updateStatus(task.id, 'todo');
      }
    }
  }

  static async notifyAssignee(task, action) {
    const NotificationService = require('../services/notificationService');
    await NotificationService.sendTaskNotification(task, action);
  }

  static async logActivity(activityData) {
    const ActivityLog = require('../database/models/ActivityLog');
    await ActivityLog.create(activityData);
  }
}

module.exports = TaskController;
