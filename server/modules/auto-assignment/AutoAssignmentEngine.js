const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidatorEnhanced');
const { ValidationError } = require('joi');

/**
 * Auto Assignment Engine
 * Intelligent project setup with role-based task assignment
 */
class AutoAssignmentEngine {
  /**
   * Get available project templates
   * @returns {Promise<Array>} Array of active templates
   */
  static async getProjectTemplates() {
    try {
      const templates = await db('project_templates')
        .select(
          'project_templates.*',
          'users.name as created_by_name',
          'users.email as created_by_email'
        )
        .leftJoin('users', 'project_templates.created_by', 'users.id')
        .where('project_templates.is_active', true)
        .orderBy('project_templates.industry_type', 'ASC')
        .orderBy('project_templates.name', 'ASC');

      // Get template tasks for each template
      for (const template of templates) {
        template.tasks = await db('template_tasks')
          .where('template_id', template.id)
          .orderBy('template_tasks.display_order', 'ASC');
      }

      return templates;
    } catch (error) {
      throw new Error(`Error fetching project templates: ${error.message}`);
    }
  }

  /**
   * Create project from template
   * @param {number} templateId - Template ID
   * @param {Object} projectData - Project data
   * @param {number} userId - User creating the project
   * @returns {Promise<Object>} Created project with tasks
   */
  static async createProjectFromTemplate(templateId, projectData, userId) {
    try {
      // Get template details
      const template = await db('project_templates')
        .where('id', templateId)
        .first();

      if (!template) {
        throw new ValidationError('Template not found');
      }

      // Validate project data
      const { name, client_name, industry_type } = projectData;
      if (!name || !client_name || !industry_type) {
        throw new ValidationError('Project name, client name, and industry type are required');
      }

      // Create project
      const [newProject] = await db('projects')
        .insert({
          name,
          client_name,
          industry_type,
          current_stage_id: 1, // Lead stage
          owner_id: userId,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // Create tasks from template
      const templateTasks = await db('template_tasks')
        .where('template_id', templateId)
        .orderBy('display_order', 'ASC');

      const createdTasks = [];
      for (const task of templateTasks) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (task.default_due_offset_days || 0));
        
        const [newTask] = await db('tasks')
          .insert({
            project_id: newProject.id,
            title: task.title,
            description: task.description,
            status: 'todo',
            owner_id: userId,
            accountable_id: userId, // Self-accountable for initial tasks
            due_date: dueDate.toISOString().split('T')[0],
            estimated_hours: task.estimated_hours,
            sla_hours: task.estimated_hours, // Set SLA for critical tasks
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');

        createdTasks.push(newTask);
      }

      // Create role assignments
      const templateRoles = await db('template_roles')
        .where('template_id', templateId)
        .orderBy('created_at', 'DESC'); // Get most recent assignments

      // Assign primary role
      const primaryRoles = templateRoles.filter(role => role.is_primary);
      for (const role of primaryRoles) {
        await db('project_team_members').insert({
          project_id: newProject.id,
          user_id: userId,
          role: role.role,
          is_primary: role.is_primary,
          assigned_at: new Date(),
          assigned_by: userId
        });
      }

      return {
        project: newProject,
        tasks: createdTasks,
        template: template,
        assignments: primaryRoles
      };
    } catch (error) {
      throw new Error(`Error creating project from template: ${error.message}`);
    }
  }

  /**
   * Get auto-assignment suggestions for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Assignment suggestions
   */
  static async getAssignmentSuggestions(projectId) {
    try {
      // Get project details
      const project = await db('projects')
        .select(
          'projects.*',
          'users.name as owner_name',
          'users.role as owner_role',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      const suggestions = {
        stage_specific: {},
        overdue_tasks: [],
        unassigned_tasks: [],
        workload_balance: {},
        role_gaps: []
      };

      // Get current tasks for this project
      const currentTasks = await db('tasks')
        .select(
          'tasks.*',
          'users.name as owner_name',
          'users.role as owner_role',
          'users.email as owner_email'
        )
        .leftJoin('users', 'tasks.owner_id', 'users.id')
        .where('tasks.project_id', projectId)
        .where('tasks.status', 'in', ['todo', 'in_progress', 'at_risk'])
        .orderBy('tasks.due_date', 'ASC');

      // Get template for current stage
      let template = null;
      if (project.industry_type) {
        const templates = await this.getProjectTemplates();
        template = templates.find(t => t.industry_type === project.industry_type);
      }

      // Analyze stage-specific requirements
      switch (project.current_stage_name?.toLowerCase()) {
        case 'lead':
          suggestions.stage_specific = {
            required_tasks: ['Client Kickoff', 'Requirements gathering'],
            missing_roles: ['CSM'],
            urgency: 'high'
          };
          break;

        case 'poc':
          suggestions.stage_specific = {
            required_tasks: ['Technical Discovery', 'Solution Architecture'],
            missing_roles: ['PM'],
            urgency: 'medium'
          };
          break;

        case 'implementation':
          suggestions.stage_specific = {
            required_tasks: ['Project Setup', 'Configuration', 'Testing'],
            missing_roles: ['PM', 'CSM'],
            urgency: 'medium'
          };
          break;

        case 'go live':
          suggestions.stage_specific = {
            required_tasks: ['Go-live Support', 'Monitoring', 'Documentation'],
            missing_roles: ['CSM', 'Client'],
            urgency: 'low'
          };
          break;
      }

      // Analyze overdue tasks
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      suggestions.overdue_tasks = currentTasks.filter(task => 
        task.due_date < todayStr && ['todo', 'in_progress'].includes(task.status)
      );

      // Analyze unassigned tasks
      suggestions.unassigned_tasks = currentTasks.filter(task => !task.owner_id);

      // Analyze workload balance
      const workloadByRole = {};
      for (const task of currentTasks) {
        if (task.owner_id && task.owner_id) {
          workloadByRole[task.owner_id] = (workloadByRole[task.owner_id] || 0) + 1;
        }
      }
      suggestions.workload_balance = workloadByRole;

      // Check for role gaps
      const currentRoles = new Set(currentTasks.map(t => t.owner_id));
      const templateRoles = template ? await db('template_roles').where('template_id', template.id) : [];
      const requiredRoles = new Set(templateRoles.map(r => r.role));

      for (const role of requiredRoles) {
        if (!currentRoles.has(role.role)) {
          suggestions.role_gaps.push(role.role);
        }
      }

      return suggestions;
    } catch (error) {
      throw new Error(`Error getting assignment suggestions: ${error.message}`);
    }
  }

  /**
   * Auto-assign tasks to users based on workload and availability
   * @param {number} projectId - Project ID
   * @param {Object} options - Assignment options
   * @returns {Promise<Object>} Assignment results
   */
  static async autoAssignTasks(projectId, options = {}) {
    try {
      const {
        max_hours_per_user = 40,
        prioritize_critical = true,
        consider_skills = true
      } = options;

      // Get unassigned tasks
      const unassignedTasks = await db('tasks')
        .where('project_id', projectId)
        .whereNull('owner_id')
        .where('status', 'todo')
        .orderBy('due_date', 'ASC')
        .limit(20);

      if (unassignedTasks.length === 0) {
        return { message: 'No unassigned tasks available for assignment', assignments: [] };
      }

      // Get users and their current workload
      const users = await db('users')
        .select(
          'users.id',
          'users.name',
          'users.role',
          'users.email',
          'users.department',
          db.raw(`
            (SELECT COUNT(*) as task_count 
             FROM tasks 
             WHERE tasks.owner_id = users.id 
             AND tasks.status IN ('todo', 'in_progress')
             AND tasks.created_at >= NOW() - INTERVAL '30 days'
            ) as recent_task_count
          `)
        )
        .where('users.is_active', true)
        .orderBy('recent_task_count', 'ASC');

      // Calculate current workload
      const userWorkload = {};
      for (const user of users) {
        userWorkload[user.id] = {
          current_tasks: user.recent_task_count,
          max_capacity: max_hours_per_user,
          available_capacity: Math.max(0, max_hours_per_user - user.recent_task_count)
        };
      }

      // Assignment algorithm
      const assignments = [];
      for (const task of unassignedTasks) {
        // Find best matching user based on skills and workload
        let bestUser = null;
        let bestScore = -1;

        for (const user of users) {
          if (consider_skills && userWorkload[user.id].available_capacity <= 0) {
            continue; // Skip users at capacity
          }

          let score = 0;
          
          // Prioritize critical tasks
          if (prioritize_critical && task.estimated_hours > 8) {
            score += 50;
          }

          // Consider workload balance
          score += (userWorkload[user.id].available_capacity * 2);

          // Random factor to distribute tasks
          score += Math.random() * 10;

          if (score > bestScore) {
            bestScore = score;
            bestUser = user;
          }
        }

        if (bestUser) {
          const [assignedTask] = await db('tasks')
            .where('id', task.id)
            .update({
              owner_id: bestUser.id,
              accountable_id: bestUser.id,
              assigned_at: new Date(),
              updated_at: new Date()
            })
            .returning('*');

          assignments.push({
            task_id: task.id,
            user_id: bestUser.id,
            user_name: bestUser.name,
            user_email: bestUser.email,
            user_role: bestUser.role,
            task_title: task.title,
            estimated_hours: task.estimated_hours,
            assigned_at: new Date()
          });

          // Create assignment notification
          await db('notifications').insert({
            user_id: bestUser.id,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned a new task: ${task.title}`,
            is_read: false,
            project_id: projectId,
            created_at: new Date()
          });
        }
      }

      return {
        message: `Successfully assigned ${assignments.length} tasks to ${assignments.length} users`,
        assignments,
        unassigned_count: Math.max(0, unassignedTasks.length - assignments.length)
      };
    } catch (error) {
      throw new Error(`Error in auto-assignment: ${error.message}`);
    }
  }
}

module.exports = AutoAssignmentEngine;
