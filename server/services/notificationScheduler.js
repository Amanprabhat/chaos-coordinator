const cron = require('node-cron');
const Task = require('../database/models/Task');
const Project = require('../database/models/Project');
const NotificationService = require('./notificationService');

class NotificationScheduler {
  static initialize() {
    this.scheduleOverdueTaskChecks();
    this.scheduleDailyDigests();
    this.scheduleWeeklyReports();
  }

  static scheduleOverdueTaskChecks() {
    cron.schedule('0 9 * * *', async () => {
      console.log('Running overdue task check...');
      await this.checkOverdueTasks();
    });

    cron.schedule('0 13 * * *', async () => {
      console.log('Running afternoon overdue task check...');
      await this.checkOverdueTasks();
    });
  }

  static scheduleDailyDigests() {
    cron.schedule('0 8 * * *', async () => {
      console.log('Sending daily digests...');
      await this.sendDailyDigests();
    });
  }

  static scheduleWeeklyReports() {
    cron.schedule('0 9 * * 1', async () => {
      console.log('Sending weekly reports...');
      await this.sendWeeklyReports();
    });
  }

  static async checkOverdueTasks() {
    try {
      const overdueTasks = await Task.getOverdueTasks();
      
      for (const task of overdueTasks) {
        await NotificationService.sendOverdueTaskNotification(task);
      }

      console.log(`Processed ${overdueTasks.length} overdue tasks`);
    } catch (error) {
      console.error('Error checking overdue tasks:', error);
    }
  }

  static async sendDailyDigests() {
    try {
      const User = require('../database/models/User');
      const users = await User.getActiveUsers();

      for (const user of users) {
        await this.sendUserDailyDigest(user);
      }
    } catch (error) {
      console.error('Error sending daily digests:', error);
    }
  }

  static async sendUserDailyDigest(user) {
    try {
      let digestContent = '';
      
      switch (user.role) {
        case 'pm':
          digestContent = await this.getPMDigest(user.id);
          break;
        case 'sales':
          digestContent = await this.getSalesDigest(user.id);
          break;
        case 'csm':
          digestContent = await this.getCSMDigest(user.id);
          break;
        default:
          return;
      }

      if (digestContent) {
        await NotificationService.sendEmail(
          user.email,
          'Daily Digest - Chaos Coordinator',
          digestContent
        );
      }
    } catch (error) {
      console.error(`Error sending daily digest to ${user.email}:`, error);
    }
  }

  static async getPMDigest(pmId) {
    const projects = await Project.getProjectsByPM(pmId);
    const overdueTasks = await Task.getOverdueTasks().filter(task => 
      projects.some(project => project.id === task.project_id)
    );
    const myTasks = await Task.getTasksByAssignee(pmId).filter(task => 
      task.status !== 'completed'
    );

    if (overdueTasks.length === 0 && myTasks.length === 0) {
      return null;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Daily Project Digest</h2>
        <p style="color: #666;">Good morning! Here's your project update for ${new Date().toLocaleDateString()}.</p>
        
        ${overdueTasks.length > 0 ? `
          <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #721c24; margin: 0 0 10px 0;">Overdue Tasks (${overdueTasks.length})</h3>
            ${overdueTasks.slice(0, 5).map(task => `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
                <strong>${task.title}</strong> - ${task.assignee_name}<br>
                <small style="color: #666;">Due: ${new Date(task.due_date).toLocaleDateString()}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${myTasks.length > 0 ? `
          <div style="background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin: 0 0 10px 0;">Your Pending Tasks (${myTasks.length})</h3>
            ${myTasks.slice(0, 5).map(task => `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
                <strong>${task.title}</strong><br>
                <small style="color: #666;">Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Full Dashboard
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">
          This is your daily digest from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static async getSalesDigest(salesRepId) {
    const Deal = require('../database/models/Deal');
    const deals = await Deal.getDealsBySalesRep(salesRepId);
    const pendingHandoffs = deals.filter(d => d.handoff_status === 'pending');

    if (pendingHandoffs.length === 0) {
      return null;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Daily Sales Digest</h2>
        <p style="color: #666;">Good morning! Here's your sales update for ${new Date().toLocaleDateString()}.</p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #856404; margin: 0 0 10px 0;">Pending Handoffs (${pendingHandoffs.length})</h3>
          ${pendingHandoffs.map(deal => `
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
              <strong>${deal.client_name}</strong><br>
              <small style="color: #666;">Value: $${deal.value || 'Not specified'} | Closed: ${new Date(deal.close_date).toLocaleDateString()}</small>
            </div>
          `).join('')}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Full Dashboard
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">
          This is your daily digest from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static async getCSMDigest(csmId) {
    const User = require('../database/models/User');
    const db = require('../database/connection');
    
    const clients = await db('clients')
      .where('csm_id', csmId)
      .where('status', 'at_risk')
      .select('*');

    if (clients.length === 0) {
      return null;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Daily Client Health Digest</h2>
        <p style="color: #666;">Good morning! Here's your client health update for ${new Date().toLocaleDateString()}.</p>
        
        <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #721c24; margin: 0 0 10px 0;">At-Risk Clients (${clients.length})</h3>
          ${clients.map(client => `
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 3px;">
              <strong>${client.name}</strong><br>
              <small style="color: #666;">Health Score: ${client.health_score}/100</small>
            </div>
          `).join('')}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Full Dashboard
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">
          This is your daily digest from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static async sendWeeklyReports() {
    try {
      const User = require('../database/models/User');
      const adminUsers = await User.findByRole('admin');

      for (const admin of adminUsers) {
        await this.sendWeeklyReport(admin);
      }
    } catch (error) {
      console.error('Error sending weekly reports:', error);
    }
  }

  static async sendWeeklyReport(admin) {
    try {
      const projects = await Project.findAll();
      const tasks = await Task.findAll();
      const Deal = require('../database/models/Deal');
      const deals = await Deal.findAll();

      const completedProjects = projects.filter(p => p.status === 'completed');
      const delayedProjects = await Project.getDelayedProjects();
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const closedDeals = deals.filter(d => d.status === 'closed_won');

      const reportContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #333;">Weekly Performance Report</h2>
          <p style="color: #666;">Here's your weekly summary for ${new Date().toLocaleDateString()}.</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div style="background: #d4edda; padding: 20px; border-radius: 5px;">
              <h3 style="color: #155724; margin: 0 0 15px 0;">Projects</h3>
              <div style="margin: 10px 0;"><strong>Total:</strong> ${projects.length}</div>
              <div style="margin: 10px 0;"><strong>Completed:</strong> ${completedProjects.length}</div>
              <div style="margin: 10px 0;"><strong>Delayed:</strong> ${delayedProjects.length}</div>
              <div style="margin: 10px 0;"><strong>Completion Rate:</strong> ${projects.length > 0 ? (completedProjects.length / projects.length * 100).toFixed(1) : 0}%</div>
            </div>
            
            <div style="background: #d1ecf1; padding: 20px; border-radius: 5px;">
              <h3 style="color: #0c5460; margin: 0 0 15px 0;">Tasks</h3>
              <div style="margin: 10px 0;"><strong>Total:</strong> ${tasks.length}</div>
              <div style="margin: 10px 0;"><strong>Completed:</strong> ${completedTasks.length}</div>
              <div style="margin: 10px 0;"><strong>Completion Rate:</strong> ${tasks.length > 0 ? (completedTasks.length / tasks.length * 100).toFixed(1) : 0}%</div>
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 5px;">
              <h3 style="color: #856404; margin: 0 0 15px 0;">Sales</h3>
              <div style="margin: 10px 0;"><strong>Total Deals:</strong> ${deals.length}</div>
              <div style="margin: 10px 0;"><strong>Closed Won:</strong> ${closedDeals.length}</div>
              <div style="margin: 10px 0;"><strong>Total Value:</strong> $${closedDeals.reduce((sum, d) => sum + parseFloat(d.value || 0), 0).toFixed(2)}</div>
            </div>
            
            <div style="background: #f8d7da; padding: 20px; border-radius: 5px;">
              <h3 style="color: #721c24; margin: 0 0 15px 0;">Alerts</h3>
              <div style="margin: 10px 0;"><strong>Delayed Projects:</strong> ${delayedProjects.length}</div>
              <div style="margin: 10px 0;"><strong>Blocked Tasks:</strong> ${tasks.filter(t => t.status === 'blocked').length}</div>
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
            This is your weekly report from Chaos Coordinator.
          </p>
        </div>
      `;

      await NotificationService.sendEmail(
        admin.email,
        'Weekly Performance Report - Chaos Coordinator',
        reportContent
      );
    } catch (error) {
      console.error(`Error sending weekly report to ${admin.email}:`, error);
    }
  }
}

module.exports = NotificationScheduler;
