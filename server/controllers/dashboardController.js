const User = require('../database/models/User');

class DashboardController {
  static async getDashboard(req, res) {
    try {
      const { role } = req.user;
      
      // Get basic project and task data
      const db = require('../database/connection');
      
      // Get sample data for now (will be replaced with real data later)
      const projects = await db('projects').select('*').limit(5);
      const tasks = await db('tasks').select('*').limit(10);
      const users = await db('users').select('*').where('is_active', true);
      
      const dashboardData = {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: role
        },
        overview: {
          total_projects: projects.length,
          active_projects: projects.filter(p => p.status === 'active').length,
          total_tasks: tasks.length,
          completed_tasks: tasks.filter(t => t.status === 'completed').length,
          total_users: users.length,
          active_users: users.filter(u => u.is_active).length
        },
        recent_projects: projects.map(project => ({
          id: project.id,
          name: project.name || 'Untitled Project',
          status: project.status || 'planning',
          stage: project.stage || 'kickoff',
          start_date: project.created_at,
          pm_name: project.pm_name || 'Unassigned',
          client_name: project.client_name || 'No Client',
          client_id: project.client_id,
          deal_id: project.deal_id,
          priority: project.priority || 'medium',
          target_date: project.target_date,
          actual_date: project.actual_date,
          budget: project.budget,
          pm_id: project.pm_id
        })),
        recent_tasks: tasks.map(task => ({
          id: task.id,
          title: task.title || 'Untitled Task',
          status: task.status || 'pending',
          priority: task.priority || 'medium',
          due_date: task.due_date,
          assignee: task.assignee_name || 'Unassigned',
          project_id: task.project_id,
          project_name: task.project_name || 'No Project',
          created_at: task.created_at,
          completed_at: task.completed_at
        })),
        team_members: users.map(user => ({
          id: user.id,
          name: user.name,
          role: user.role,
          department: user.department || 'Not specified',
          is_active: user.is_active,
          email: user.email
        }))
      };

      res.json(dashboardData);
    } catch (error) {
      console.error('Get dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getPMDashboard(pmId) {
    const projects = await Project.getProjectsByPM(pmId);
    const overdueTasks = await Task.getOverdueTasks().filter(task => 
      projects.some(project => project.id === task.project_id)
    );
    const blockedTasks = await Task.getBlockedTasks().filter(task => 
      projects.some(project => project.id === task.project_id)
    );

    const myTasks = await Task.getTasksByAssignee(pmId);
    const recentActivity = await ActivityLog.getRecentActivity(10);

    return {
      overview: {
        total_projects: projects.length,
        active_projects: projects.filter(p => p.status === 'active').length,
        overdue_tasks: overdueTasks.length,
        blocked_tasks: blockedTasks.length,
        my_pending_tasks: myTasks.filter(t => t.status !== 'completed').length
      },
      projects: projects.slice(0, 5),
      overdue_tasks: overdueTasks.slice(0, 5),
      blocked_tasks: blockedTasks.slice(0, 5),
      my_tasks: myTasks.slice(0, 5),
      recent_activity: recentActivity
    };
  }

  static async getSalesDashboard(salesRepId) {
    const deals = await Deal.getDealsBySalesRep(salesRepId);
    const closedDeals = deals.filter(d => d.status === 'closed_won');
    const pendingHandoffs = closedDeals.filter(d => d.handoff_status === 'pending');
    
    const myProjects = await Promise.all(
      pendingHandoffs.map(async (deal) => {
        const projects = await Project.findAll({ deal_id: deal.id });
        return projects[0];
      })
    ).filter(Boolean);

    const recentActivity = await ActivityLog.getUserActivity(salesRepId, 10);

    return {
      overview: {
        total_deals: deals.length,
        closed_deals: closedDeals.length,
        pending_handoffs: pendingHandoffs.length,
        total_value: closedDeals.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0),
        conversion_rate: deals.length > 0 ? (closedDeals.length / deals.length * 100).toFixed(1) : 0
      },
      recent_deals: deals.slice(0, 5),
      pending_handoffs: pendingHandoffs.slice(0, 5),
      projects: myProjects.slice(0, 5),
      recent_activity: recentActivity
    };
  }

  static async getCSMDashboard(csmId) {
    const User = require('../database/models/User');
    const csm = await User.findById(csmId);
    
    const db = require('../database/connection');
    const clients = await db('clients')
      .where('csm_id', csmId)
      .select('*');

    const clientProjects = await Promise.all(
      clients.map(async (client) => {
        const projects = await Project.findAll({ client_id: client.id });
        return { client, projects };
      })
    );

    const activeProjects = clientProjects.flatMap(cp => cp.projects)
      .filter(p => p.status === 'active');

    const recentActivity = await ActivityLog.getRecentActivity(10);

    return {
      overview: {
        total_clients: clients.length,
        active_clients: clients.filter(c => c.status === 'active').length,
        at_risk_clients: clients.filter(c => c.status === 'at_risk').length,
        active_projects: activeProjects.length,
        average_health_score: clients.length > 0 
          ? (clients.reduce((sum, c) => sum + c.health_score, 0) / clients.length).toFixed(1)
          : 0
      },
      clients: clients.slice(0, 5),
      projects: activeProjects.slice(0, 5),
      recent_activity: recentActivity
    };
  }

  static async getProductDashboard() {
    const projects = await Project.findAll();
    const delayedProjects = await Project.getDelayedProjects();
    const tasks = await Task.findAll();
    const blockedTasks = await Task.getBlockedTasks();

    const projectsByStage = {
      kickoff: projects.filter(p => p.stage === 'kickoff').length,
      planning: projects.filter(p => p.stage === 'planning').length,
      execution: projects.filter(p => p.stage === 'execution').length,
      review: projects.filter(p => p.stage === 'review').length,
      delivery: projects.filter(p => p.stage === 'delivery').length
    };

    const recentActivity = await ActivityLog.getRecentActivity(10);

    return {
      overview: {
        total_projects: projects.length,
        delayed_projects: delayedProjects.length,
        blocked_tasks: blockedTasks.length,
        completion_rate: projects.length > 0 
          ? (projects.filter(p => p.status === 'completed').length / projects.length * 100).toFixed(1)
          : 0
      },
      projects_by_stage: projectsByStage,
      delayed_projects: delayedProjects.slice(0, 5),
      blocked_tasks: blockedTasks.slice(0, 5),
      recent_activity: recentActivity
    };
  }

  static async getAdminDashboard() {
    const projects = await Project.findAll();
    const deals = await Deal.findAll();
    const users = await User.getActiveUsers();
    const tasks = await Task.findAll();

    const projectsByStatus = {
      planning: projects.filter(p => p.status === 'planning').length,
      active: projects.filter(p => p.status === 'active').length,
      on_hold: projects.filter(p => p.status === 'on_hold').length,
      completed: projects.filter(p => p.status === 'completed').length
    };

    const usersByRole = {
      sales: users.filter(u => u.role === 'sales').length,
      pm: users.filter(u => u.role === 'pm').length,
      csm: users.filter(u => u.role === 'csm').length,
      product: users.filter(u => u.role === 'product').length,
      admin: users.filter(u => u.role === 'admin').length
    };

    const recentActivity = await ActivityLog.getRecentActivity(10);

    return {
      overview: {
        total_projects: projects.length,
        total_deals: deals.length,
        total_users: users.length,
        total_tasks: tasks.length,
        active_users: users.filter(u => u.is_active).length
      },
      projects_by_status: projectsByStatus,
      users_by_role: usersByRole,
      recent_activity: recentActivity
    };
  }

  static async getMetrics(req, res) {
    try {
      const { role } = req.user;
      const { metric_type, date_range } = req.query;

      // Return basic metrics for now
      const basicMetrics = {
        metric_type: metric_type || 'basic',
        date_range: date_range || '30',
        data: {
          total_projects: 0,
          completed_tasks: 0,
          active_users: 1,
          system_health: 'good'
        }
      };

      res.json({ metrics: basicMetrics });
    } catch (error) {
      console.error('Get metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProjectVelocity(dateRange = '30') {
    const db = require('../database/connection');
    const days = parseInt(dateRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const projects = await db('projects')
      .where('created_at', '>=', startDate)
      .where('status', 'completed')
      .select('created_at', 'actual_date', 'target_date');

    return {
      total_completed: projects.length,
      average_completion_time: projects.length > 0 
        ? projects.reduce((sum, p) => {
            const days = p.actual_date ? 
              Math.ceil((new Date(p.actual_date) - new Date(p.created_at)) / (1000 * 60 * 60 * 24)) : 0;
            return sum + days;
          }, 0) / projects.length
        : 0,
      on_time_delivery: projects.length > 0 
        ? (projects.filter(p => !p.actual_date || new Date(p.actual_date) <= new Date(p.target_date)).length / projects.length * 100).toFixed(1)
        : 0
    };
  }

  static async getTaskCompletion(dateRange = '30') {
    const db = require('../database/connection');
    const days = parseInt(dateRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tasks = await db('tasks')
      .where('completed_at', '>=', startDate)
      .select('completed_at', 'due_date', 'estimated_hours', 'actual_hours');

    return {
      total_completed: tasks.length,
      average_completion_time: tasks.length > 0 
        ? tasks.reduce((sum, t) => {
            const days = Math.ceil((new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / tasks.length
        : 0,
      on_time_completion: tasks.length > 0 
        ? (tasks.filter(t => !t.due_date || new Date(t.completed_at) <= new Date(t.due_date)).length / tasks.length * 100).toFixed(1)
        : 0
    };
  }

  static async getDealConversion(dateRange = '30') {
    const db = require('../database/connection');
    const days = parseInt(dateRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deals = await db('deals')
      .where('close_date', '>=', startDate)
      .select('status', 'value');

    const closedWon = deals.filter(d => d.status === 'closed_won');
    const totalValue = closedWon.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);

    return {
      total_deals: deals.length,
      closed_won: closedWon.length,
      conversion_rate: deals.length > 0 ? (closedWon.length / deals.length * 100).toFixed(1) : 0,
      total_value: totalValue,
      average_deal_size: closedWon.length > 0 ? (totalValue / closedWon.length).toFixed(2) : 0
    };
  }
}

module.exports = DashboardController;
