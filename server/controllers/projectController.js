const Project = require('../database/models/Project');
const Task = require('../database/models/Task');
const { validationResult } = require('express-validator');

class ProjectController {
  static async createProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const projectData = {
        ...req.body,
        creator_id: req.user.id
      };

      const project = await Project.create(projectData);

      await this.logActivity({
        entity_type: 'project',
        entity_id: project.id,
        user_id: req.user.id,
        content: `Project "${project.name}" created`,
        action_type: 'created'
      });

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProjects(req, res) {
    try {
      const { stage, status, pm_id } = req.query;
      let projects;

      if (req.user.role === 'pm') {
        projects = await Project.getProjectsByPM(req.user.id);
      } else if (stage) {
        projects = await Project.getProjectsByStage(stage);
      } else {
        projects = await Project.findAll({ stage, status, pm_id });
      }

      res.json({ projects });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProject(req, res) {
    try {
      const { id } = req.params;
      const project = await Project.getProjectDetails(id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (req.user.role !== 'admin' && project.pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const tasks = await Task.getTasksByProject(id);

      res.json({
        project,
        tasks
      });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const project = await Project.findById(id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (req.user.role !== 'admin' && project.pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedProject = await Project.update(id, req.body);

      await this.logActivity({
        entity_type: 'project',
        entity_id: id,
        user_id: req.user.id,
        content: `Project "${updatedProject.name}" updated`,
        action_type: 'updated'
      });

      res.json({
        message: 'Project updated successfully',
        project: updatedProject
      });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProjectStage(req, res) {
    try {
      const { id } = req.params;
      const { stage } = req.body;

      if (!['deal_closed', 'kickoff', 'planning', 'execution', 'review', 'delivery', 'post_delivery'].includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage' });
      }

      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (req.user.role !== 'admin' && project.pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedProject = await Project.updateStage(id, stage);

      await this.logActivity({
        entity_type: 'project',
        entity_id: id,
        user_id: req.user.id,
        content: `Project stage updated to ${stage}`,
        action_type: 'status_change'
      });

      res.json({
        message: 'Project stage updated successfully',
        project: updatedProject
      });
    } catch (error) {
      console.error('Update project stage error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getDelayedProjects(req, res) {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'pm') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const projects = await Project.getDelayedProjects();
      res.json({ projects });
    } catch (error) {
      console.error('Get delayed projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async logActivity(activityData) {
    const ActivityLog = require('../database/models/ActivityLog');
    await ActivityLog.create(activityData);
  }
}

module.exports = ProjectController;
