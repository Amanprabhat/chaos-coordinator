const db = require('../../database/connection');
const { ValidationError } = require('joi');

/**
 * Project Health Scoring System
 * Calculates project health based on multiple factors
 */
class ProjectHealthScoring {
  /**
   * Calculate project health score (0-100)
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Health score and factors
   */
  static async calculateProjectHealth(projectId) {
    try {
      // Get project details
      const project = await db('projects')
        .select(
          'projects.*',
          'lifecycle_stages.name as stage_name',
          'lifecycle_stages.display_order as stage_order',
          'users.name as owner_name',
          'users.email as owner_email',
          'users.role as owner_role'
        )
        .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
        .leftJoin('users', 'projects.owner_id', 'users.id')
        .where('projects.id', projectId)
        .first();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      // Get project tasks
      const tasks = await db('tasks')
        .where('project_id', projectId)
        .select('status', 'estimated_hours', 'sla_hours', 'sla_breached');

      // Get project milestones
      const milestones = await db('milestones')
        .where('project_id', projectId)
        .select('status', 'due_date');

      // Get project risks
      const risks = await db('risks')
        .where('project_id', projectId)
        .select('severity', 'status');

      // Get recent changes
      const changes = await db('changes')
        .where('project_id', projectId)
        .count('* as count');

      // Calculate health factors
      const healthScore = {
        task_completion: 0,
        milestone_completion: 0,
        risk_management: 0,
        sla_compliance: 0,
        change_control: 0,
        overall: 0
      };

      // Task completion factor (0-30 points)
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const totalTasks = tasks.length;
      if (totalTasks > 0) {
        healthScore.task_completion = Math.min(30, (completedTasks.length / totalTasks) * 30);
      }

      // Milestone completion factor (0-20 points)
      const completedMilestones = milestones.filter(m => m.status === 'completed');
      const totalMilestones = milestones.length;
      if (totalMilestones > 0) {
        healthScore.milestone_completion = Math.min(20, (completedMilestones.length / totalMilestones) * 20);
      }

      // Risk management factor (0-25 points)
      const openRisks = risks.filter(r => r.status === 'open').length;
      const criticalRisks = risks.filter(r => r.severity === 'critical' && r.status === 'open').length;
      const totalRisks = risks.length;
      
      if (totalRisks > 0) {
        let riskScore = 25;
        // Deduct points for open risks
        riskScore -= openRisks.length * 5;
        
        // Extra deduction for critical risks
        riskScore -= criticalRisks.length * 10;
        
        // Bonus points for mitigated risks
        const mitigatedRisks = risks.filter(r => r.status === 'resolved').length;
        riskScore += mitigatedRisks.length * 2;
        
        healthScore.risk_management = Math.max(0, riskScore);
      }

      // SLA compliance factor (0-25 points)
      const slaTasks = tasks.filter(t => t.sla_hours > 0);
      const breachedTasks = slaTasks.filter(t => t.sla_breached === true);
      const totalSlaTasks = slaTasks.length;
      
      if (totalSlaTasks > 0) {
        let slaScore = 25;
        // Deduct points for breaches
        slaScore -= (breachedTasks.length / totalSlaTasks) * 15;
        
        healthScore.sla_compliance = Math.max(0, slaScore);
      }

      // Change control factor (0-15 points)
      if (changes > 0) {
        healthScore.change_control = Math.min(15, (10 / (changes[0].count + 1)) * 15);
      }

      // Calculate overall score
      healthScore.overall = Math.min(100, 
        healthScore.task_completion + 
        healthScore.milestone_completion + 
        healthScore.risk_management + 
        healthScore.sla_compliance + 
        healthScore.change_control
      );

      // Determine health status
      let healthStatus = 'excellent';
      if (healthScore.overall < 30) healthStatus = 'critical';
      else if (healthScore.overall < 50) healthStatus = 'poor';
      else if (healthScore.overall < 70) healthStatus = 'fair';
      else if (healthScore.overall < 85) healthStatus = 'good';

      // Get recommendations
      const recommendations = [];
      
      if (healthScore.task_completion < 20) {
        recommendations.push('Focus on completing tasks to improve project health score');
      }
      
      if (healthScore.milestone_completion < 15) {
        recommendations.push('Review milestone completion rates and remove bottlenecks');
      }
      
      if (healthScore.risk_management < 15) {
        recommendations.push('Implement risk management process and address open issues');
      }
      
      if (healthScore.sla_compliance < 70) {
        recommendations.push('Review SLA settings and improve time tracking');
      }

      return {
        project_id: projectId,
        project_name: project.name,
        health_score: healthScore.overall,
        health_status,
        factors: healthScore,
        recommendations,
        calculated_at: new Date()
      };
    } catch (error) {
      throw new Error(`Error calculating project health: ${error.message}`);
    }
  }

  /**
   * Get health scores for all projects
   * @returns {Promise<Array>} Array of project health scores
   */
  static async getAllProjectHealthScores() {
    try {
      const projects = await db('projects')
        .select(
          'projects.id',
          'projects.name',
          'projects.client_name',
          'projects.current_stage_id',
          'projects.status'
        )
        .where('projects.status', 'active')
        .orderBy('projects.updated_at', 'desc');

      const projectHealthScores = [];
      
      for (const project of projects) {
        const healthData = await this.calculateProjectHealth(project.id);
        projectHealthScores.push({
          ...project,
          ...healthData
        });
      }

      return projectHealthScores;
    } catch (error) {
      throw new Error(`Error getting all project health scores: ${error.message}`);
    }
  }

  /**
   * Get projects with poor health for intervention
   * @param {number} threshold - Health score threshold
   * @returns {Promise<Array>} Projects needing attention
   */
  static async getProjectsNeedingAttention(threshold = 50) {
    try {
      const allScores = await this.getAllProjectHealthScores();
      
      return allScores.filter(project => project.health_score < threshold);
    } catch (error) {
      throw new Error(`Error getting projects needing attention: ${error.message}`);
    }
  }

  /**
   * Create health alert
   * @param {number} projectId - Project ID
   * @param {string} alertType - Type of alert
   * @param {Object} alertData - Alert data
   */
  static async createHealthAlert(projectId, alertType, alertData) {
    try {
      await db('project_health_alerts').insert({
        project_id,
        alert_type,
        alert_data: JSON.stringify(alertData),
        created_at: new Date()
      });

      // Create notification for project owner
      const project = await db('projects')
        .select('owner_id')
        .where('id', projectId)
        .first();

      if (project) {
        await db('notifications').insert({
          user_id: project.owner_id,
          project_id: projectId,
          type: 'health_alert',
          title: `Project Health Alert: ${alertType}`,
          message: JSON.stringify(alertData),
          send_immediately: true
        });
      }

      return true;
    } catch (error) {
      throw new Error(`Error creating health alert: ${error.message}`);
    }
  }
}

module.exports = ProjectHealthScoring;
