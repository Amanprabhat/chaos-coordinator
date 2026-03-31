const nodemailer = require('nodemailer');
const User = require('../database/models/User');

class NotificationService {
  static transporter = null;

  static initializeTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
    return this.transporter;
  }

  static async sendEmail(to, subject, htmlContent) {
    try {
      this.initializeTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      console.error('Email send error:', error);
    }
  }

  static async sendTaskNotification(task, action) {
    try {
      if (!task.assignee_id) return;

      const assignee = await User.findById(task.assignee_id);
      if (!assignee) return;

      const subject = this.getTaskSubject(action, task);
      const htmlContent = this.getTaskEmailContent(task, action, assignee);

      await this.sendEmail(assignee.email, subject, htmlContent);
    } catch (error) {
      console.error('Task notification error:', error);
    }
  }

  static async sendHandoffNotification(user, deal, notes, userType, status = null) {
    try {
      const subject = this.getHandoffSubject(userType, status);
      const htmlContent = this.getHandoffEmailContent(user, deal, notes, userType, status);

      await this.sendEmail(user.email, subject, htmlContent);
    } catch (error) {
      console.error('Handoff notification error:', error);
    }
  }

  static async sendOverdueTaskNotification(task) {
    try {
      if (!task.assignee_id) return;

      const assignee = await User.findById(task.assignee_id);
      if (!assignee) return;

      const subject = `Overdue Task: ${task.title}`;
      const htmlContent = this.getOverdueTaskEmailContent(task, assignee);

      await this.sendEmail(assignee.email, subject, htmlContent);

      const Task = require('../database/models/Task');
      const project = await Task.getTaskDetails(task.id);
      
      if (project.pm_id && project.pm_id !== task.assignee_id) {
        const pm = await User.findById(project.pm_id);
        if (pm) {
          const pmSubject = `Team Member Overdue Task: ${task.title}`;
          const pmContent = this.getPMOverdueTaskEmailContent(task, assignee, pm);
          await this.sendEmail(pm.email, pmSubject, pmContent);
        }
      }
    } catch (error) {
      console.error('Overdue task notification error:', error);
    }
  }

  static async sendEscalationNotification(entity, escalationType, reason) {
    try {
      const adminUsers = await User.findByRole('admin');
      
      const subject = `Escalation: ${escalationType}`;
      const htmlContent = this.getEscalationEmailContent(entity, escalationType, reason);

      for (const admin of adminUsers) {
        await this.sendEmail(admin.email, subject, htmlContent);
      }
    } catch (error) {
      console.error('Escalation notification error:', error);
    }
  }

  static getTaskSubject(action, task) {
    switch (action) {
      case 'created':
        return `New Task Assigned: ${task.title}`;
      case 'assigned':
        return `Task Assigned: ${task.title}`;
      case 'completed':
        return `Task Completed: ${task.title}`;
      default:
        return `Task Update: ${task.title}`;
    }
  }

  static getTaskEmailContent(task, action, user) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const taskUrl = `${baseUrl}/tasks/${task.id}`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Task ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${task.title}</h3>
          <p style="margin: 0 0 10px 0; color: #666;">${task.description || 'No description provided'}</p>
          
          <div style="display: flex; gap: 20px; margin: 15px 0;">
            <div>
              <strong>Priority:</strong> ${task.priority}
            </div>
            <div>
              <strong>Due Date:</strong> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}
            </div>
          </div>
        </div>
        
        <p style="margin: 20px 0;">
          <a href="${taskUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Task Details
          </a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          This is an automated notification from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static getHandoffSubject(userType, status) {
    if (userType === 'pm') {
      return 'New Project Handoff - Action Required';
    } else if (userType === 'sales') {
      return status === 'accepted' ? 'Handoff Accepted' : 'Handoff Rejected';
    }
    return 'Project Handoff Update';
  }

  static getHandoffEmailContent(user, deal, notes, userType, status) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const handoffUrl = `${baseUrl}/handoffs/${deal.id}`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Project Handoff ${status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Update'}</h2>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Deal: ${deal.client_name}</h3>
          <p style="margin: 0 0 10px 0; color: #666;">Value: $${deal.value || 'Not specified'}</p>
          <p style="margin: 0 0 10px 0; color: #666;">Closed: ${new Date(deal.close_date).toLocaleDateString()}</p>
          
          ${notes ? `<p style="margin: 15px 0; padding: 10px; background: white; border-left: 4px solid #007bff;"><strong>Notes:</strong> ${notes}</p>` : ''}
        </div>
        
        ${userType === 'pm' ? `
          <p style="margin: 20px 0;">
            <a href="${handoffUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
              Accept Handoff
            </a>
            <a href="${handoffUrl}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Reject Handoff
            </a>
          </p>
        ` : `
          <p style="margin: 20px 0;">
            <a href="${handoffUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Handoff Details
            </a>
          </p>
        `}
        
        <p style="color: #666; font-size: 14px;">
          This is an automated notification from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static getOverdueTaskEmailContent(task, user) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const taskUrl = `${baseUrl}/tasks/${task.id}`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Overdue Task Alert</h2>
        
        <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #f5c6cb;">
          <h3 style="margin: 0 0 10px 0; color: #721c24;">${task.title}</h3>
          <p style="margin: 0 0 10px 0; color: #721c24;">
            <strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()} (Overdue by ${Math.ceil((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24))} days)
          </p>
        </div>
        
        <p style="margin: 20px 0;">
          <a href="${taskUrl}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Update Task Status
          </a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          This is an automated notification from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static getPMOverdueTaskEmailContent(task, assignee, pm) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const taskUrl = `${baseUrl}/tasks/${task.id}`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Team Member Overdue Task</h2>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
          <h3 style="margin: 0 0 10px 0; color: #856404;">${task.title}</h3>
          <p style="margin: 0 0 10px 0; color: #856404;">
            <strong>Assigned to:</strong> ${assignee.name}
          </p>
          <p style="margin: 0 0 10px 0; color: #856404;">
            <strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()} (Overdue by ${Math.ceil((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24))} days)
          </p>
        </div>
        
        <p style="margin: 20px 0;">
          <a href="${taskUrl}" style="background: #ffc107; color: #212529; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Review Task
          </a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          This is an automated notification from Chaos Coordinator.
        </p>
      </div>
    `;
  }

  static getEscalationEmailContent(entity, escalationType, reason) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Escalation Required</h2>
        
        <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #f5c6cb;">
          <h3 style="margin: 0 0 10px 0; color: #721c24;">${escalationType}</h3>
          <p style="margin: 0 0 10px 0; color: #721c24;">
            <strong>Reason:</strong> ${reason}
          </p>
          <p style="margin: 0 0 10px 0; color: #721c24;">
            <strong>Entity:</strong> ${entity.title || entity.name || 'Unknown'}
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          This is an automated escalation notification from Chaos Coordinator.
        </p>
      </div>
    `;
  }
}

module.exports = NotificationService;
