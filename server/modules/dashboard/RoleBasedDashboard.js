const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Role-Based Dashboard System
 * Personalized dashboard experience based on user role
 */
class RoleBasedDashboard {
  /**
   * Get role-based dashboard data
   * @param {number} userId - User ID
   * @param {string} userRole - User role (Sales, CSM, PM, Client)
   * @returns {Promise<Object>} Role-specific dashboard data
   */
  static async getRoleDashboard(userId, userRole) {
    try {
      switch (userRole.toLowerCase()) {
        case 'sales':
          return await this.getSalesDashboard(userId);
        case 'csm':
          return await this.getCSMDashboard(userId);
        case 'pm':
          return await this.getPMDashboard(userId);
        case 'client':
          return await this.getClientDashboard(userId);
        default:
          throw new ValidationError('Invalid user role');
      }
    } catch (error) {
      throw new Error(`Error getting role dashboard: ${error.message}`);
    }
  }

  /**
   * Sales Dashboard
   * Focus: POCs, leads, handover pending
   */
  static async getSalesDashboard(userId) {
    try {
      // Get POCs owned by sales user
      const pocs = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'in', ['Lead', 'POC'])
        .orderBy('projects.updated_at', 'desc');

      // Get pending handovers from sales
      const pendingHandovers = await db('handover_notes')
        .select(
          'handover_notes.*',
          'projects.name as project_name',
          'projects.client_name',
          'lifecycle_stages.name as current_stage'
        )
        .join('projects', 'handover_notes.project_id', 'projects.id')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('handover_notes.from_role', 'Sales')
        .where('handover_notes.checklist_completed', false)
        .orderBy('handover_notes.created_at', 'desc');

      // Get recent leads
      const recentLeads = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'Lead')
        .orderBy('projects.created_at', 'desc')
        .limit(5);

      // Get conversion metrics
      const conversionMetrics = await this.getSalesConversionMetrics(userId);

      return {
        role: 'Sales',
        summary: {
          total_pocs: pocs.length,
          pending_handovers: pendingHandovers.length,
          recent_leads: recentLeads.length,
          conversion_rate: conversionMetrics.conversion_rate
        },
        sections: {
          pocs: {
            title: 'My POCs',
            items: pocs,
            actions: ['Create POC', 'Submit Handover']
          },
          pending_handovers: {
            title: 'Pending Handovers',
            items: pendingHandovers,
            actions: ['Complete Checklist', 'Submit to CSM']
          },
          recent_leads: {
            title: 'Recent Leads',
            items: recentLeads,
            actions: ['Convert to POC', 'Schedule Demo']
          }
        },
        metrics: conversionMetrics,
        quick_actions: [
          { type: 'create_poc', label: 'Create New POC', icon: 'plus' },
          { type: 'submit_handover', label: 'Submit Handover', icon: 'arrow-right' },
          { type: 'view_pipeline', label: 'View Pipeline', icon: 'bar-chart' }
        ]
      };
    } catch (error) {
      throw new Error(`Error getting sales dashboard: ${error.message}`);
    }
  }

  /**
   * CSM Dashboard
   * Focus: Onboarding projects, pending handovers
   */
  static async getCSMDashboard(userId) {
    try {
      // Get onboarding projects
      const onboardingProjects = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'in', ['Implementation', 'Go Live'])
        .orderBy('projects.updated_at', 'desc');

      // Get pending handovers to CSM
      const pendingHandovers = await db('handover_notes')
        .select(
          'handover_notes.*',
          'projects.name as project_name',
          'projects.client_name',
          'lifecycle_stages.name as current_stage',
          'from_user.name as from_user_name',
          'from_user.email as from_user_email'
        )
        .join('projects', 'handover_notes.project_id', 'projects.id')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users as from_user', 'handover_notes.from_user_id', 'from_user.id')
        .where('handover_notes.to_role', 'CSM')
        .where('handover_notes.checklist_completed', true)
        .where('handover_notes.approved_by', null)
        .orderBy('handover_notes.created_at', 'desc');

      // Get POCs ready for conversion
      const readyPOCs = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('lifecycle_stages.name', 'POC')
        .whereNot('projects.owner_id', userId)
        .orderBy('projects.updated_at', 'desc')
        .limit(5);

      // Get onboarding metrics
      const onboardingMetrics = await this.getCSMMetrics(userId);

      return {
        role: 'CSM',
        summary: {
          active_onboarding: onboardingProjects.length,
          pending_handovers: pendingHandovers.length,
          ready_pocs: readyPOCs.length,
          onboarding_rate: onboardingMetrics.onboarding_rate
        },
        sections: {
          onboarding_projects: {
            title: 'Active Onboarding',
            items: onboardingProjects,
            actions: ['View Details', 'Manage Tasks', 'Schedule Check-in']
          },
          pending_handovers: {
            title: 'Pending Handovers',
            items: pendingHandovers,
            actions: ['Accept Handover', 'Request Info', 'Reject']
          },
          ready_pocs: {
            title: 'POCs Ready for Conversion',
            items: readyPOCs,
            actions: ['Accept POC', 'Create Project', 'Schedule Meeting']
          }
        },
        metrics: onboardingMetrics,
        quick_actions: [
          { type: 'accept_handover', label: 'Accept Handover', icon: 'check' },
          { type: 'create_project', label: 'Create Project', icon: 'plus' },
          { type: 'schedule_checkin', label: 'Schedule Check-in', icon: 'calendar' }
        ]
      };
    } catch (error) {
      throw new Error(`Error getting CSM dashboard: ${error.message}`);
    }
  }

  /**
   * PM Dashboard
   * Focus: Active projects, delayed milestones, SLA breaches
   */
  static async getPMDashboard(userId) {
    try {
      // Get active projects
      const activeProjects = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .join('users', 'projects.owner_id', 'users.id')
        .where('projects.owner_id', userId)
        .where('projects.status', 'active')
        .orderBy('projects.updated_at', 'desc');

      // Get delayed milestones
      const delayedMilestones = await db('milestones')
        .select(
          'milestones.*',
          'projects.name as project_name',
          'projects.client_name',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('projects', 'milestones.project_id', 'projects.id')
        .join('users', 'milestones.owner_id', 'users.id')
        .where('milestones.due_date', '<', new Date().toISOString().split('T')[0])
        .where('milestones.status', 'in', ['pending', 'in_progress'])
        .orderBy('milestones.due_date', 'asc');

      // Get SLA breaches
      const slaBreaches = await db('tasks')
        .select(
          'tasks.*',
          'projects.name as project_name',
          'projects.client_name',
          'users.name as owner_name',
          'users.email as owner_email'
        )
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('users', 'tasks.owner_id', 'users.id')
        .where('tasks.sla_breached', true)
        .where('tasks.project_id', 'in', activeProjects.map(p => p.id))
        .orderBy('tasks.due_date', 'asc');

      // Get project health scores
      const projectHealth = await this.getProjectHealthScores(activeProjects.map(p => p.id));

      return {
        role: 'PM',
        summary: {
          active_projects: activeProjects.length,
          delayed_milestones: delayedMilestones.length,
          sla_breaches: slaBreaches.length,
          avg_health_score: projectHealth.avg_score
        },
        sections: {
          active_projects: {
            title: 'Active Projects',
            items: activeProjects,
            actions: ['View Details', 'Manage Tasks', 'Trigger Stage Transition']
          },
          delayed_milestones: {
            title: 'Delayed Milestones',
            items: delayedMilestones,
            actions: ['Update Milestone', 'Assign Resources', 'Escalate']
          },
          sla_breaches: {
            title: 'SLA Breaches',
            items: slaBreaches,
            actions: ['Assign Owner', 'Pause SLA', 'Escalate']
          }
        },
        metrics: projectHealth,
        quick_actions: [
          { type: 'assign_tasks', label: 'Assign Tasks', icon: 'user-plus' },
          { type: 'manage_milestones', label: 'Manage Milestones', icon: 'flag' },
          { type: 'trigger_transition', label: 'Stage Transition', icon: 'arrow-right' }
        ]
      };
    } catch (error) {
      throw new Error(`Error getting PM dashboard: ${error.message}`);
    }
  }

  /**
   * Client Dashboard
   * Focus: Simplified project progress, approvals
   */
  static async getClientDashboard(userId) {
    try {
      // Get client projects
      const clientProjects = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as current_stage',
          'lifecycle_stages.display_order as stage_order'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.client_id', userId) // Assuming client_id field
        .orderBy('projects.updated_at', 'desc');

      // Get project milestones (simplified view)
      const projectMilestones = await db('milestones')
        .select(
          'milestones.*',
          'projects.name as project_name'
        )
        .join('projects', 'milestones.project_id', 'projects.id')
        .where('projects.client_id', userId)
        .orderBy('milestones.due_date', 'asc');

      // Get pending approvals
      const pendingApprovals = await db('knowledge_assets')
        .select(
          'knowledge_assets.*',
          'projects.name as project_name'
        )
        .join('projects', 'knowledge_assets.project_id', 'projects.id')
        .where('projects.client_id', userId)
        .where('knowledge_assets.approved_by_client', false)
        .orderBy('knowledge_assets.created_at', 'desc');

      // Calculate project progress
      const projectProgress = await this.getClientProjectProgress(clientProjects.map(p => p.id));

      return {
        role: 'Client',
        summary: {
          active_projects: clientProjects.length,
          pending_approvals: pendingApprovals.length,
          avg_progress: projectProgress.avg_progress
        },
        sections: {
          projects: {
            title: 'My Projects',
            items: clientProjects,
            actions: ['View Progress', 'View Milestones', 'Contact Team']
          },
          milestones: {
            title: 'Upcoming Milestones',
            items: projectMilestones,
            actions: ['View Details', 'Add Comment']
          },
          approvals: {
            title: 'Pending Approvals',
            items: pendingApprovals,
            actions: ['Approve', 'Request Changes', 'View Details']
          }
        },
        metrics: projectProgress,
        quick_actions: [
          { type: 'approve_asset', label: 'Approve Asset', icon: 'check' },
          { type: 'view_progress', label: 'View Progress', icon: 'bar-chart' },
          { type: 'contact_team', label: 'Contact Team', icon: 'message' }
        ]
      };
    } catch (error) {
      throw new Error(`Error getting client dashboard: ${error.message}`);
    }
  }

  /**
   * Get sales conversion metrics
   */
  static async getSalesConversionMetrics(userId) {
    try {
      const totalLeads = await db('projects')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'Lead')
        .count('* as count');

      const totalPOCs = await db('projects')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'POC')
        .count('* as count');

      const conversionRate = totalLeads[0].count > 0 ? 
        ((totalPOCs[0].count / totalLeads[0].count) * 100).toFixed(2) : '0.00';

      return {
        total_leads: totalLeads[0].count,
        total_pocs: totalPOCs[0].count,
        conversion_rate: parseFloat(conversionRate)
      };
    } catch (error) {
      throw new Error(`Error getting sales metrics: ${error.message}`);
    }
  }

  /**
   * Get CSM metrics
   */
  static async getCSMMetrics(userId) {
    try {
      const activeOnboarding = await db('projects')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'in', ['Implementation', 'Go Live'])
        .count('* as count');

      const completedOnboarding = await db('projects')
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .where('projects.owner_id', userId)
        .where('lifecycle_stages.name', 'Hypercare')
        .count('* as count');

      const onboardingRate = (activeOnboarding[0].count + completedOnboarding[0].count) > 0 ? 
        ((completedOnboarding[0].count / (activeOnboarding[0].count + completedOnboarding[0].count)) * 100).toFixed(2) : '0.00';

      return {
        active_onboarding: activeOnboarding[0].count,
        completed_onboarding: completedOnboarding[0].count,
        onboarding_rate: parseFloat(onboardingRate)
      };
    } catch (error) {
      throw new Error(`Error getting CSM metrics: ${error.message}`);
    }
  }

  /**
   * Get project health scores
   */
  static async getProjectHealthScores(projectIds) {
    try {
      if (projectIds.length === 0) {
        return { avg_score: 0, projects: [] };
      }

      // This would integrate with the ProjectHealthScoring module
      // For now, return mock data
      return {
        avg_score: 75.5,
        projects: projectIds.map(id => ({
          project_id: id,
          health_score: Math.floor(Math.random() * 40) + 60,
          health_status: 'good'
        }))
      };
    } catch (error) {
      throw new Error(`Error getting project health: ${error.message}`);
    }
  }

  /**
   * Get client project progress
   */
  static async getClientProjectProgress(projectIds) {
    try {
      if (projectIds.length === 0) {
        return { avg_progress: 0, projects: [] };
      }

      // Calculate progress based on completed milestones and tasks
      const progress = await db('projects')
        .select(
          'projects.id',
          db.raw(`
            (SELECT COUNT(*) FROM milestones WHERE milestones.project_id = projects.id AND milestones.status = 'completed') * 100.0 / 
            (SELECT COUNT(*) FROM milestones WHERE milestones.project_id = projects.id) as progress_percentage
          `)
        )
        .whereIn('projects.id', projectIds);

      const avgProgress = progress.length > 0 ? 
        (progress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / progress.length).toFixed(2) : '0.00';

      return {
        avg_progress: parseFloat(avgProgress),
        projects: progress
      };
    } catch (error) {
      throw new Error(`Error getting client progress: ${error.message}`);
    }
  }
}

module.exports = RoleBasedDashboard;
