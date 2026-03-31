const Deal = require('../database/models/Deal');
const Project = require('../database/models/Project');
const User = require('../database/models/User');
const { validationResult } = require('express-validator');

class HandoffController {
  static async initiateHandoff(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deal_id, handoff_notes, pm_id } = req.body;

      const deal = await Deal.findById(deal_id);
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (req.user.role !== 'sales' || deal.sales_rep_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (deal.status !== 'closed_won') {
        return res.status(400).json({ error: 'Deal must be closed won before handoff' });
      }

      const pm = await User.findById(pm_id);
      if (!pm || pm.role !== 'pm') {
        return res.status(400).json({ error: 'Valid project manager required' });
      }

      await Deal.updateHandoffStatus(deal_id, 'pending', handoff_notes);

      const project = await Project.create({
        name: `${deal.client_id} - ${new Date().getFullYear()}`,
        client_id: deal.client_id,
        deal_id: deal.id,
        pm_id: pm_id,
        stage: 'kickoff',
        status: 'planning',
        priority: 'medium'
      });

      await this.logActivity({
        entity_type: 'deal',
        entity_id: deal_id,
        user_id: req.user.id,
        content: `Handoff initiated for deal to PM ${pm.name}`,
        action_type: 'updated'
      });

      await this.notifyPM(pm, deal, handoff_notes);

      res.status(201).json({
        message: 'Handoff initiated successfully',
        project,
        handoff_status: 'pending'
      });
    } catch (error) {
      console.error('Initiate handoff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async acceptHandoff(req, res) {
    try {
      const { deal_id } = req.params;
      const { notes } = req.body;

      const deal = await Deal.findById(deal_id);
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (req.user.role !== 'pm') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const project = await Project.findAll({ deal_id });
      if (project.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project[0].pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await Deal.completeHandoff(deal_id);
      await Project.updateStage(project[0].id, 'planning');

      await this.logActivity({
        entity_type: 'deal',
        entity_id: deal_id,
        user_id: req.user.id,
        content: `Handoff accepted by PM ${req.user.name}`,
        action_type: 'updated'
      });

      await this.notifySalesRep(deal, 'accepted');

      res.json({
        message: 'Handoff accepted successfully',
        project: project[0]
      });
    } catch (error) {
      console.error('Accept handoff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async rejectHandoff(req, res) {
    try {
      const { deal_id } = req.params;
      const { rejection_reason } = req.body;

      if (!rejection_reason || rejection_reason.trim().length === 0) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const deal = await Deal.findById(deal_id);
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (req.user.role !== 'pm') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const project = await Project.findAll({ deal_id });
      if (project.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project[0].pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await Deal.updateHandoffStatus(deal_id, 'rejected', rejection_reason);

      await this.logActivity({
        entity_type: 'deal',
        entity_id: deal_id,
        user_id: req.user.id,
        content: `Handoff rejected: ${rejection_reason}`,
        action_type: 'updated'
      });

      await this.notifySalesRep(deal, 'rejected', rejection_reason);

      res.json({
        message: 'Handoff rejected successfully',
        rejection_reason
      });
    } catch (error) {
      console.error('Reject handoff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getPendingHandoffs(req, res) {
    try {
      let handoffs;

      if (req.user.role === 'pm') {
        handoffs = await Deal.getClosedDeals();
        handoffs = handoffs.filter(deal => deal.pm_id === req.user.id);
      } else if (req.user.role === 'sales') {
        handoffs = await Deal.getDealsBySalesRep(req.user.id);
        handoffs = handoffs.filter(deal => deal.handoff_status === 'pending');
      } else if (req.user.role === 'admin') {
        handoffs = await Deal.getClosedDeals();
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ handoffs });
    } catch (error) {
      console.error('Get pending handoffs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getHandoffHistory(req, res) {
    try {
      const { deal_id } = req.params;

      const deal = await Deal.getDealDetails(deal_id);
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      if (req.user.role !== 'admin' && 
          deal.sales_rep_id !== req.user.id && 
          deal.pm_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const ActivityLog = require('../database/models/ActivityLog');
      const activities = await ActivityLog.findAll({
        entity_type: 'deal',
        entity_id: deal_id
      });

      res.json({ activities });
    } catch (error) {
      console.error('Get handoff history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async notifyPM(pm, deal, notes) {
    const NotificationService = require('../services/notificationService');
    await NotificationService.sendHandoffNotification(pm, deal, notes, 'pm');
  }

  static async notifySalesRep(deal, status, reason = null) {
    const salesRep = await User.findById(deal.sales_rep_id);
    const NotificationService = require('../services/notificationService');
    await NotificationService.sendHandoffNotification(salesRep, deal, reason, 'sales', status);
  }

  static async logActivity(activityData) {
    const ActivityLog = require('../database/models/ActivityLog');
    await ActivityLog.create(activityData);
  }
}

module.exports = HandoffController;
