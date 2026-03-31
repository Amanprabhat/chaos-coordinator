const db = require('../../database/connection');
const { ValidationError } = require('joi');
const LifecycleEngine = require('../lifecycle/LifecycleEngineEnhanced');
const AutoAssignmentEngine = require('../auto-assignment/AutoAssignmentEngine');

/**
 * Guided Workflow System
 * Provides step-by-step guidance for project workflows
 */
class GuidedWorkflow {
  /**
   * Get guided workflow for a project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Guided workflow data
   */
  static async getProjectWorkflow(projectId, userId) {
    try {
      // Get project details
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order',
          'lifecycle_stages.requirements',
          'users.name as owner_name',
          'users.role as owner_role'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      // Get current stage requirements
      const stageRequirements = this.parseStageRequirements(project.requirements);

      // Get project tasks and milestones
      const projectTasks = await this.getProjectTasks(projectId);
      const projectMilestones = await this.getProjectMilestones(projectId);

      // Get blocking issues
      const blockingIssues = await this.getBlockingIssues(projectId);

      // Get next required actions
      const nextActions = await this.getNextRequiredActions(project, projectTasks, projectMilestones, blockingIssues);

      // Get workflow progress
      const workflowProgress = await this.getWorkflowProgress(project, projectTasks, projectMilestones);

      return {
        project: {
          id: project.id,
          name: project.name,
          client_name: project.client_name,
          current_stage: project.current_stage,
          stage_order: project.stage_order,
          owner: project.owner_name,
          owner_role: project.owner_role
        },
        current_stage: {
          name: project.current_stage,
          requirements: stageRequirements,
          progress: workflowProgress.stage_progress
        },
        next_actions: nextActions,
        blocking_issues: blockingIssues,
        workflow_progress: workflowProgress,
        guidance: {
          title: this.getStageGuidanceTitle(project.current_stage),
          description: this.getStageGuidanceDescription(project.current_stage),
          tips: this.getStageTips(project.current_stage),
          checklists: stageRequirements.checklists || []
        }
      };
    } catch (error) {
      throw new Error(`Error getting project workflow: ${error.message}`);
    }
  }

  /**
   * Get action recommendations for a project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Action recommendations
   */
  static async getActionRecommendations(projectId, userId) {
    try {
      const recommendations = [];

      // Get project details
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'users.role as owner_role'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.id', projectId)
        .first();

      // Check for orphaned tasks
      const orphanedTasks = await db('tasks')
        .where('project_id', projectId)
        .whereNull('owner_id')
        .count('* as count');

      if (orphanedTasks[0].count > 0) {
        recommendations.push({
          type: 'critical',
          title: 'Assign Orphaned Tasks',
          description: `Assign owners to ${orphanedTasks[0].count} tasks without owners`,
          action: 'assign_tasks',
          priority: 'high',
          estimated_time: '15 min'
        });
      }

      // Check for overdue tasks
      const overdueTasks = await db('tasks')
        .where('project_id', projectId)
        .where('due_date', '<', new Date().toISOString().split('T')[0])
        .where('status', 'in', ['todo', 'in_progress'])
        .count('* as count');

      if (overdueTasks[0].count > 0) {
        recommendations.push({
          type: 'warning',
          title: 'Address Overdue Tasks',
          description: `${overdueTasks[0].count} tasks are overdue and need attention`,
          action: 'review_overdue',
          priority: 'medium',
          estimated_time: '30 min'
        });
      }

      // Check for incomplete handovers
      const incompleteHandovers = await db('handover_notes')
        .where('project_id', projectId)
        .where('checklist_completed', false)
        .count('* as count');

      if (incompleteHandovers[0].count > 0) {
        recommendations.push({
          type: 'info',
          title: 'Complete Handover Checklist',
          description: `Complete handover checklist for ${incompleteHandovers[0].count} handovers`,
          action: 'complete_handover',
          priority: 'medium',
          estimated_time: '20 min'
        });
      }

      // Check for critical risks
      const criticalRisks = await db('risks')
        .where('project_id', projectId)
        .where('severity', 'critical')
        .where('status', 'open')
        .count('* as count');

      if (criticalRisks[0].count > 0) {
        recommendations.push({
          type: 'critical',
          title: 'Resolve Critical Risks',
          description: `${criticalRisks[0].count} critical risks need immediate attention`,
          action: 'resolve_risks',
          priority: 'high',
          estimated_time: '45 min'
        });
      }

      // Check for stage readiness
      const stageReadiness = await this.checkStageReadiness(projectId, project.current_stage);
      if (!stageReadiness.ready) {
        recommendations.push({
          type: 'warning',
          title: 'Complete Stage Requirements',
          description: `Complete ${stageReadiness.missing_items.length} items to advance to next stage`,
          action: 'complete_requirements',
          priority: 'high',
          estimated_time: '60 min'
        });
      }

      // Role-specific recommendations
      const roleRecommendations = await this.getRoleSpecificRecommendations(project, userId);
      recommendations.push(...roleRecommendations);

      // Sort by priority
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      return {
        project_id: projectId,
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
        total_recommendations: recommendations.length,
        next_best_action: recommendations[0] || null
      };
    } catch (error) {
      throw new Error(`Error getting action recommendations: ${error.message}`);
    }
  }

  /**
   * Get empty state guidance
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Empty state guidance
   */
  static async getEmptyStateGuidance(userRole) {
    try {
      const guidance = {
        role: userRole,
        title: '',
        description: '',
        actions: [],
        tips: []
      };

      switch (userRole.toLowerCase()) {
        case 'sales':
          guidance.title = 'Start Your First Lead';
          guidance.description = 'Create your first lead to begin tracking opportunities in Chaos Coordinator.';
          guidance.actions = [
            { label: 'Create First Lead', action: 'create_lead', primary: true },
            { label: 'Import Leads', action: 'import_leads', primary: false },
            { label: 'View Templates', action: 'view_templates', primary: false }
          ];
          guidance.tips = [
            'Start with basic client information',
            'Add contact details for follow-up',
            'Set realistic conversion timelines'
          ];
          break;

        case 'csm':
          guidance.title = 'Welcome to Customer Success';
          guidance.description = 'Accept your first handover to begin managing customer onboarding.';
          guidance.actions = [
            { label: 'View Pending Handovers', action: 'view_handovers', primary: true },
            { label: 'Create Project', action: 'create_project', primary: false },
            { label: 'Schedule Check-in', action: 'schedule_checkin', primary: false }
          ];
          guidance.tips = [
            'Review handover details carefully',
            'Schedule onboarding calls',
            'Set clear success criteria'
          ];
          break;

        case 'pm':
          guidance.title = 'Project Management Dashboard';
          guidance.description = 'Assign your first tasks and start managing project timelines.';
          guidance.actions = [
            { label: 'View Active Projects', action: 'view_projects', primary: true },
            { label: 'Assign Tasks', action: 'assign_tasks', primary: false },
            { label: 'Create Milestone', action: 'create_milestone', primary: false }
          ];
          guidance.tips = [
            'Break down large projects into milestones',
            'Assign clear owners for each task',
            'Set realistic deadlines'
          ];
          break;

        case 'client':
          guidance.title = 'Your Project Portal';
          guidance.description = 'View your project progress and approve knowledge assets.';
          guidance.actions = [
            { label: 'View My Projects', action: 'view_projects', primary: true },
            { label: 'Approve Assets', action: 'approve_assets', primary: false },
            { label: 'Contact Team', action: 'contact_team', primary: false }
          ];
          guidance.tips = [
            'Check project progress regularly',
            'Approve knowledge assets promptly',
            'Provide feedback to improve collaboration'
          ];
          break;
      }

      return guidance;
    } catch (error) {
      throw new Error(`Error getting empty state guidance: ${error.message}`);
    }
  }

  /**
   * Helper methods
   */
  static parseStageRequirements(requirements) {
    try {
      return typeof requirements === 'string' ? JSON.parse(requirements) : requirements || {};
    } catch (error) {
      return {};
    }
  }

  static async getProjectTasks(projectId) {
    return await db('tasks')
      .where('project_id', projectId)
      .select('*')
      .orderBy('due_date', 'asc');
  }

  static async getProjectMilestones(projectId) {
    return await db('milestones')
      .where('project_id', projectId)
      .select('*')
      .orderBy('due_date', 'asc');
  }

  static async getBlockingIssues(projectId) {
    const issues = [];

    // Check for orphaned tasks
    const orphanedTasks = await db('tasks')
      .where('project_id', projectId)
      .whereNull('owner_id')
      .count('* as count');

    if (orphanedTasks[0].count > 0) {
      issues.push({
        type: 'orphaned_tasks',
        title: 'Tasks Without Owners',
        description: `${orphanedTasks[0].count} tasks need owners assigned`,
        severity: 'high',
        count: orphanedTasks[0].count
      });
    }

    // Check for blocked milestones
    const blockedMilestones = await db('milestones')
      .where('project_id', projectId)
      .where('status', 'blocked')
      .count('* as count');

    if (blockedMilestones[0].count > 0) {
      issues.push({
        type: 'blocked_milestones',
        title: 'Blocked Milestones',
        description: `${blockedMilestones[0].count} milestones are blocked`,
        severity: 'medium',
        count: blockedMilestones[0].count
      });
    }

    // Check for critical risks
    const criticalRisks = await db('risks')
      .where('project_id', projectId)
      .where('severity', 'critical')
      .where('status', 'open')
      .count('* as count');

    if (criticalRisks[0].count > 0) {
      issues.push({
        type: 'critical_risks',
        title: 'Critical Risks',
        description: `${criticalRisks[0].count} critical risks need attention`,
        severity: 'high',
        count: criticalRisks[0].count
      });
    }

    return issues;
  }

  static async getNextRequiredActions(project, tasks, milestones, blockingIssues) {
    const actions = [];

    // Stage-specific actions
    switch (project.current_stage.toLowerCase()) {
      case 'lead':
        actions.push({
          title: 'Convert to POC',
          description: 'Convert this lead to a Proof of Concept',
          action: 'convert_to_poc',
          priority: 'high'
        });
        break;

      case 'poc':
        actions.push({
          title: 'Complete POC Requirements',
          description: 'Finish all POC requirements before handover',
          action: 'complete_poc',
          priority: 'high'
        });
        break;

      case 'implementation':
        actions.push({
          title: 'Complete Implementation Tasks',
          description: 'Finish all implementation tasks',
          action: 'complete_implementation',
          priority: 'medium'
        });
        break;

      case 'go live':
        actions.push({
          title: 'Prepare for Go Live',
          description: 'Complete go-live checklist and approvals',
          action: 'prepare_golive',
          priority: 'high'
        });
        break;
    }

    // Blocking issue actions
    blockingIssues.forEach(issue => {
      actions.push({
        title: `Resolve ${issue.title}`,
        description: issue.description,
        action: `resolve_${issue.type}`,
        priority: issue.severity === 'high' ? 'high' : 'medium'
      });
    });

    return actions;
  }

  static async getWorkflowProgress(project, tasks, milestones) {
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;

    const stageProgress = {
      tasks: {
        total: tasks.length,
        completed: completedTasks,
        percentage: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0
      },
      milestones: {
        total: milestones.length,
        completed: completedMilestones,
        percentage: milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0
      },
      overall: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0
    };

    return {
      stage_progress: stageProgress,
      overall_progress: stageProgress.overall
    };
  }

  static getStageGuidanceTitle(stage) {
    const titles = {
      'Lead': 'Lead Management',
      'POC': 'Proof of Concept',
      'Implementation': 'Project Implementation',
      'Go Live': 'Go Live Preparation',
      'Hypercare': 'Post-Launch Support'
    };
    return titles[stage] || 'Project Workflow';
  }

  static getStageGuidanceDescription(stage) {
    const descriptions = {
      'Lead': 'Manage and convert leads into opportunities',
      'POC': 'Demonstrate value through proof of concept',
      'Implementation': 'Execute project implementation plan',
      'Go Live': 'Prepare and execute successful go-live',
      'Hypercare': 'Provide post-launch support and optimization'
    };
    return descriptions[stage] || 'Follow the project workflow';
  }

  static getStageTips(stage) {
    const tips = {
      'Lead': [
        'Qualify leads carefully',
        'Document client requirements',
        'Set realistic expectations'
      ],
      'POC': [
        'Focus on key value propositions',
        'Gather feedback continuously',
        'Document success metrics'
      ],
      'Implementation': [
        'Follow project plan closely',
        'Communicate progress regularly',
        'Address issues promptly'
      ],
      'Go Live': [
        'Complete all testing',
        'Prepare rollback plan',
        'Schedule go-live support'
      ],
      'Hypercare': [
        'Monitor system performance',
        'Address user issues quickly',
        'Gather improvement feedback'
      ]
    };
    return tips[stage] || [];
  }

  static async checkStageReadiness(projectId, currentStage) {
    try {
      // This would integrate with LifecycleEngineEnhanced
      // For now, return mock data
      return {
        ready: Math.random() > 0.3,
        missing_items: ['Task completion', 'Risk resolution', 'Handover checklist']
      };
    } catch (error) {
      return { ready: false, missing_items: [] };
    }
  }

  static async getRoleSpecificRecommendations(project, userId) {
    const recommendations = [];
    
    // Get user role
    const user = await db('users')
      .where('id', userId)
      .first();

    if (!user) return recommendations;

    switch (user.role.toLowerCase()) {
      case 'sales':
        if (project.current_stage === 'Lead') {
          recommendations.push({
            type: 'info',
            title: 'Schedule Demo',
            description: 'Schedule a product demo to move lead forward',
            action: 'schedule_demo',
            priority: 'medium',
            estimated_time: '30 min'
          });
        }
        break;

      case 'csm':
        if (project.current_stage === 'Implementation') {
          recommendations.push({
            type: 'info',
            title: 'Schedule Check-in',
            description: 'Schedule regular check-ins with client',
            action: 'schedule_checkin',
            priority: 'medium',
            estimated_time: '15 min'
          });
        }
        break;

      case 'pm':
        if (project.current_stage === 'Implementation') {
          recommendations.push({
            type: 'info',
            title: 'Review Task Assignments',
            description: 'Review and optimize task assignments',
            action: 'review_assignments',
            priority: 'medium',
            estimated_time: '45 min'
          });
        }
        break;
    }

    return recommendations;
  }
}

module.exports = GuidedWorkflow;
