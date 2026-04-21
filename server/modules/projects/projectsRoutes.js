const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidator');
const LifecycleEngine = require('../lifecycle/LifecycleEngine');
const { body, validationResult } = require('express-validator');
const { updateProjectStatus, checkMeetingCompletion } = require('./projectStateEngine');
const { generateProjectPlan } = require('./wbsGenerator');

// ── Multer for SOW file uploads ─────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads/sow');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const sowStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
    cb(null, `project_${req.params.id}_${Date.now()}${ext}`);
  },
});
const sowUpload = multer({
  storage: sowStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only document files are allowed (PDF, Word, Excel, PowerPoint, TXT)'));
  },
});

/**
 * Projects API Routes
 * Base: /api/projects
 */

// GET /api/projects - Get all projects with optional filters
router.get('/', async (req, res) => {
  try {
    const { stage, status, owner_id } = req.query;
    let query = db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as stage_name',
        'users.name as owner_name',
        'users.email as owner_email',
        'users.role as owner_role',
        'csm_user.name as csm_name',
        'pm_user.name as pm_name',
        'prod_user.name as product_manager_name'
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .join('users', 'projects.owner_id', 'users.id')
      .leftJoin('users as csm_user',  'projects.csm_id',             'csm_user.id')
      .leftJoin('users as pm_user',   'projects.pm_id',              'pm_user.id')
      .leftJoin('users as prod_user', 'projects.product_manager_id', 'prod_user.id')
      .orderBy('projects.updated_at', 'desc');

    // Apply filters
    if (stage) {
      query = query.where('lifecycle_stages.name', 'like', `%${stage}%`);
    }
    if (status) {
      query = query.where('projects.status', status);
    }
    if (owner_id) {
      query = query.where('projects.owner_id', owner_id);
    }

    const projects = await query;
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get single project with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as stage_name',
        'lifecycle_stages.display_order as stage_order',
        'users.name as owner_name',
        'users.email as owner_email',
        'users.role as owner_role',
        'csm_user.name as csm_name',
        'pm_user.name as pm_name',
        'prod_user.name as product_manager_name'
      )
      .join('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .join('users', 'projects.owner_id', 'users.id')
      .leftJoin('users as csm_user',  'projects.csm_id',             'csm_user.id')
      .leftJoin('users as pm_user',   'projects.pm_id',              'pm_user.id')
      .leftJoin('users as prod_user', 'projects.product_manager_id', 'prod_user.id')
      .where('projects.id', id)
      .first();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check for auto meeting completion
    await checkMeetingCompletion(project);

    // Get project statistics
    const stats = await getProjectStats(id);
    project.stats = stats;

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', [
  body('name').notEmpty().withMessage('Project name is required'),
  body('client_name').notEmpty().withMessage('Client name is required'),
  body('owner_id').isInt({ min: 1 }).withMessage('Valid owner ID is required'),
  body('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  body('target_go_live_date').optional().isISO8601().withMessage('Invalid target go-live date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const projectData = req.body;

    // Validate ownership
    OwnershipValidator.validateProjectOwnership(projectData);
    await OwnershipValidator.validateUserExists(projectData.owner_id, db);

    // Set default stage to 'Lead' (stage with display_order = 1)
    const leadStage = await db('lifecycle_stages')
      .where('display_order', 1)
      .first();

    if (!leadStage) {
      return res.status(500).json({ error: 'Lead stage not configured' });
    }

    const {
      name, client_name, description, owner_id,
      project_type, deployment_region, deployment_type, sso_required,
      csm_id, pm_id, product_manager_id, meeting_done, meeting_date, mom_text,
      expected_timeline, integrations_required, integration_details,
      client_spoc_name, client_spoc_email, client_spoc_mobile,
      priority, business_objective, go_live_deadline,
      num_users, current_tools, success_criteria, budget_range,
      start_date, target_go_live_date,
    } = projectData;

    // Generate tentative project plan immediately on intake creation
    const hasIntegrations = !!(integrations_required || integration_details);
    const tentativePlan = generateProjectPlan({
      startDate: null,
      hasIntegrations,
      momText: mom_text || '',
      integrationDetails: integration_details || integrations_required || '',
    });

    const [newId] = await db('projects')
      .insert({
        name, client_name, description, owner_id,
        project_type:          project_type          || 'POC',
        deployment_region:     deployment_region     || null,
        deployment_type:       deployment_type       || null,
        sso_required:          sso_required          ?? false,
        csm_id:                csm_id                || null,
        pm_id:                 pm_id                 || null,
        product_manager_id:    product_manager_id    || null,
        meeting_done:          meeting_done          ?? false,
        meeting_date:          meeting_date          || null,
        mom_text:              mom_text              || null,
        expected_timeline:     expected_timeline     || null,
        integrations_required: integrations_required || null,
        integration_details:   integration_details   || null,
        client_spoc_name:      client_spoc_name      || null,
        client_spoc_email:     client_spoc_email     || null,
        client_spoc_mobile:    client_spoc_mobile    || null,
        priority:              priority              || 'Medium',
        business_objective:    business_objective    || null,
        go_live_deadline:      go_live_deadline      || null,
        num_users:             num_users             || null,
        current_tools:         current_tools         || null,
        success_criteria:      success_criteria      || null,
        budget_range:          budget_range          || null,
        project_plan:          JSON.stringify(tentativePlan),
        start_date:            start_date            || null,
        target_go_live_date:   target_go_live_date   || null,
        current_stage_id: leadStage.id,
        // If Sales has confirmed the meeting is done, go straight to AWAITING_APPROVAL
        status: meeting_done ? 'AWAITING_APPROVAL' : 'INTAKE_CREATED',
        created_at: new Date(),
        updated_at: new Date(),
      });
    const newProject = await db('projects').where('id', newId).first();

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project (no direct status updates)
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Project name cannot be empty'),
  body('client_name').optional().notEmpty().withMessage('Client name cannot be empty'),
  body('owner_id').optional().isInt({ min: 1 }).withMessage('Valid owner ID is required')
  // Removed status validation - status updates must go through state engine
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if project exists
    const existingProject = await db('projects').where('id', id).first();
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate ownership if being updated
    if (updateData.owner_id) {
      OwnershipValidator.validateProjectOwnership(updateData);
      await OwnershipValidator.validateUserExists(updateData.owner_id, db);
    }

    // Remove status from update data - status updates must use state engine
    delete updateData.status;

    await db('projects')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      });
    const updatedProject = await db('projects').where('id', id).first();

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    if (error.message.includes('owner') || error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// POST /api/projects/:id/transition-stage - Transition to next stage
router.post('/:id/transition-stage', [
  body('requested_by').isInt({ min: 1 }).withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { requested_by } = req.body;

    // Validate user exists
    await OwnershipValidator.validateUserExists(requested_by, db);

    // Perform stage transition
    const updatedProject = await LifecycleEngine.transitionToNextStage(id, requested_by);

    res.json({
      message: 'Stage transition successful',
      project: updatedProject
    });
  } catch (error) {
    console.error('Error transitioning stage:', error);
    if (error.message.includes('not found') || error.message.includes('Cannot transition')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to transition stage' });
  }
});

// GET /api/projects/:id/can-transition - Check if project can transition
router.get('/:id/can-transition', async (req, res) => {
  try {
    const { id } = req.params;

    // Get current stage
    const currentStage = await LifecycleEngine.getCurrentStage(id);
    
    // Get next stage
    const nextStage = await db('lifecycle_stages')
      .where('display_order', currentStage.display_order + 1)
      .first();

    if (!nextStage) {
      return res.json({
        canTransition: false,
        message: 'Project is already in the final stage',
        currentStage: currentStage,
        nextStage: null
      });
    }

    // Check transition eligibility
    const transitionCheck = await LifecycleEngine.canTransitionToStage(id, nextStage.id);

    res.json({
      currentStage: currentStage,
      nextStage: nextStage,
      ...transitionCheck
    });
  } catch (error) {
    console.error('Error checking transition eligibility:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to check transition eligibility' });
  }
});

// POST /api/projects/:id/approve - Approve project (CTO only)
router.post('/:id/approve', [
  body('approved_by').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('approval_notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { approved_by, approval_notes } = req.body;

    // Validate user exists and is CTO
    const user = await db('users').where('id', approved_by).first();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.role !== 'Admin' && user.role !== 'CTO') {
      return res.status(403).json({ error: 'Only CTO or Admin can approve projects' });
    }

    // Fetch current project to get intake data for plan generation
    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Regenerate project plan (still tentative — no start date yet)
    const hasIntegrations = !!(project.integrations_required || project.integration_details);
    const plan = generateProjectPlan({
      startDate: project.project_start_date || null,
      hasIntegrations,
      momText: project.mom_text || '',
      integrationDetails: project.integration_details || project.integrations_required || '',
    });

    // Update status to APPROVED + store plan
    await db('projects').where('id', id).update({
      status: 'APPROVED',
      project_plan: JSON.stringify(plan),
      updated_at: new Date(),
    });

    const updatedProject = await db('projects').where('id', id).first();

    // Log approval
    try {
      await db('activity_log').insert({
        project_id: id,
        action: 'project_approved',
        details: JSON.stringify({ approved_by, approval_notes, timestamp: new Date() }),
        created_at: new Date(),
      });
    } catch (_) { /* activity_log may not exist in all envs */ }

    res.json({
      message: 'Project approved. Team has been notified. Project plan generated.',
      project: updatedProject,
      plan_summary: {
        total_tasks: plan.length,
        total_working_days: hasIntegrations ? 45 : 30,
        tentative: !project.project_start_date,
        has_integrations: hasIntegrations,
      },
    });
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).json({ error: 'Failed to approve project' });
  }
});

// POST /api/projects/:id/reject - Reject project (send back to handover)
router.post('/:id/reject', [
  body('rejected_by').isInt({ min: 1 }).withMessage('Valid user ID is required'),
  body('rejection_reason').isString().withMessage('Rejection reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rejected_by, rejection_reason } = req.body;

    // Validate user exists and is CTO
    const user = await db('users').where('id', rejected_by).first();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.role !== 'Admin' && user.role !== 'CTO') {
      return res.status(403).json({ error: 'Only CTO or Admin can reject projects' });
    }

    // Update back to HANDOVER_PENDING
    const updatedProject = await updateProjectStatus(id, 'HANDOVER_PENDING', rejected_by);

    // Log rejection
    await db('activity_log').insert({
      project_id: id,
      action: 'project_rejected',
      details: JSON.stringify({
        rejected_by: rejected_by,
        rejection_reason: rejection_reason,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.json({
      message: 'Project rejected and sent back to handover',
      project: updatedProject
    });
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ error: 'Failed to reject project' });
  }
});

// POST /api/projects/:id/set-start-date - PM/CSM sets project start date → recalculates plan
router.post('/:id/set-start-date', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date } = req.body;

    if (!start_date) return res.status(400).json({ error: 'start_date is required (ISO date)' });

    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const hasIntegrations = !!(project.integrations_required || project.integration_details);
    const plan = generateProjectPlan({
      startDate: start_date,
      hasIntegrations,
      momText: project.mom_text || '',
      integrationDetails: project.integration_details || project.integrations_required || '',
    });

    await db('projects').where('id', id).update({
      project_start_date: start_date,
      project_plan: JSON.stringify(plan),
      updated_at: new Date(),
    });

    const updated = await db('projects').where('id', id).first();
    res.json({
      message: 'Start date set. Project plan recalculated with actual dates.',
      project: updated,
      plan,
    });
  } catch (error) {
    console.error('Error setting start date:', error);
    res.status(500).json({ error: 'Failed to set start date' });
  }
});

// helper: advance a date string by N working days (Mon-Fri only)
function addWorkingDaysServer(startDateStr, days) {
  if (!days || days <= 0) return startDateStr;
  // Normalize: strip time component so SQLite "2025-01-15 00:00:00" parses correctly
  const clean = (startDateStr || '').split('T')[0].split(' ')[0];
  const date = new Date(clean + 'T00:00:00');
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const d = date.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return date.toISOString().split('T')[0];
}

// PUT /api/projects/:id/start-date — set or update start date with mandatory reason + audit log
router.put('/:id/start-date', async (req, res) => {
  try {
    const { id } = req.params;
    let { start_date, reason, changed_by_name, is_initial, total_days } = req.body;
    if (!start_date) return res.status(400).json({ error: 'start_date is required' });
    // Normalize date to YYYY-MM-DD regardless of what client or SQLite sends
    start_date = start_date.split('T')[0].split(' ')[0];
    if (!is_initial && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({ error: 'A clear reason is required (min 5 characters)' });
    }

    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const oldDate = project.project_start_date || null;
    const hasIntegrations = !!(project.integrations_required || project.integration_details);
    let newPlan;

    // If no existing plan, or first-time set → generate fresh from template
    if (!project.project_plan || !oldDate) {
      newPlan = generateProjectPlan({
        startDate: start_date,
        hasIntegrations,
        momText: project.mom_text || '',
        integrationDetails: project.integration_details || project.integrations_required || '',
        customTotalDays: total_days ? parseInt(total_days) : undefined,
      });
    } else {
      let tasks = [];
      try { tasks = JSON.parse(project.project_plan); } catch { tasks = []; }
      const currentTotalDays = tasks[0]?.total_working_days || (hasIntegrations ? 45 : 30);
      const targetTotalDays = (total_days && parseInt(total_days) >= 10) ? parseInt(total_days) : currentTotalDays;
      newPlan = tasks.map(t => {
        let dayStart = t.day_start;
        let dayEnd   = t.day_end;
        if (targetTotalDays !== currentTotalDays) {
          dayStart = Math.max(1, Math.round(t.day_start * targetTotalDays / currentTotalDays));
          dayEnd   = Math.max(dayStart, Math.round(t.day_end * targetTotalDays / currentTotalDays));
        }
        return {
          ...t,
          day_start: dayStart,
          day_end: dayEnd,
          duration_days: dayEnd - dayStart + 1,
          total_working_days: targetTotalDays,
          planned_start: addWorkingDaysServer(start_date, dayStart - 1),
          planned_end:   addWorkingDaysServer(start_date, dayEnd - 1),
          tentative: false,
        };
      });
    }

    await db('projects').where('id', id).update({
      project_start_date: start_date,
      project_plan: JSON.stringify(newPlan),
      updated_at: new Date(),
    });

    // Audit log
    await db('activity_log').insert({
      project_id: id,
      action: 'start_date_changed',
      details: JSON.stringify({
        old_date: oldDate,
        new_date: start_date,
        reason: reason ? reason.trim() : 'Initial project start date',
        changed_by: changed_by_name || 'Unknown',
        is_initial: !oldDate,
        total_days: total_days ? parseInt(total_days) : undefined,
      }),
      created_at: new Date(),
    });

    const updated = await db('projects').where('id', id).first();
    res.json({ success: true, project: updated, plan: newPlan });
  } catch (error) {
    console.error('Error updating start date:', error);
    res.status(500).json({ error: 'Failed to update start date' });
  }
});

// GET /api/projects/:id/start-date-logs — fetch start date change history
router.get('/:id/start-date-logs', async (req, res) => {
  try {
    const logs = await db('activity_log')
      .where({ project_id: req.params.id, action: 'start_date_changed' })
      .orderBy('created_at', 'desc')
      .limit(20);
    res.json(logs.map(l => ({
      ...l,
      details: (() => { try { return JSON.parse(l.details); } catch { return {}; } })(),
    })));
  } catch (err) {
    console.error('Error fetching start date logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// POST /api/projects/:id/generate-plan — generate a tentative plan for projects that lack one
router.post('/:id/generate-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const hasIntegrations = !!(project.integrations_required || project.integration_details);
    const plan = generateProjectPlan({
      startDate: project.project_start_date || null,
      hasIntegrations,
      momText: project.mom_text || '',
      integrationDetails: project.integration_details || project.integrations_required || '',
    });

    await db('projects').where('id', id).update({
      project_plan: JSON.stringify(plan),
      updated_at: new Date(),
    });

    res.json({ message: 'Project plan generated', plan });
  } catch (err) {
    console.error('Error generating plan:', err);
    res.status(500).json({ error: 'Failed to generate project plan' });
  }
});

// PUT /api/projects/:id/plan — save updated WBS plan (CSM/PM only on the frontend)
router.put('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_plan } = req.body;
    if (!project_plan || !Array.isArray(project_plan)) {
      return res.status(400).json({ error: 'project_plan array required' });
    }
    await db('projects').where('id', id).update({
      project_plan: JSON.stringify(project_plan),
      updated_at: new Date(),
    });
    res.json({ success: true, plan: project_plan });
  } catch (err) {
    console.error('Error updating plan:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// GET /api/projects/:id/risks — fetch risks
router.get('/:id/risks', async (req, res) => {
  try {
    const risks = await db('risks').where('project_id', req.params.id).orderBy('created_at', 'desc');
    res.json(risks);
  } catch (err) {
    console.error('Error fetching risks:', err);
    res.status(500).json({ error: 'Failed to fetch risks' });
  }
});

// POST /api/projects/:id/risks — create risk
router.post('/:id/risks', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, severity = 'medium', status = 'open' } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const [riskId] = await db('risks').insert({
      project_id: id, title, description, severity, status,
      created_at: new Date(), updated_at: new Date(),
    });
    const risk = await db('risks').where('id', riskId).first();
    res.json(risk);
  } catch (err) {
    console.error('Error creating risk:', err);
    res.status(500).json({ error: 'Failed to create risk' });
  }
});

// PUT /api/projects/:id/risks/:riskId — update risk
router.put('/:id/risks/:riskId', async (req, res) => {
  try {
    const { riskId } = req.params;
    const { title, description, severity, status } = req.body;
    const updates = { updated_at: new Date() };
    if (title !== undefined)       updates.title = title;
    if (description !== undefined) updates.description = description;
    if (severity !== undefined)    updates.severity = severity;
    if (status !== undefined)      updates.status = status;
    await db('risks').where('id', riskId).update(updates);
    const risk = await db('risks').where('id', riskId).first();
    res.json(risk);
  } catch (err) {
    console.error('Error updating risk:', err);
    res.status(500).json({ error: 'Failed to update risk' });
  }
});

// DELETE /api/projects/:id/risks/:riskId — delete risk
router.delete('/:id/risks/:riskId', async (req, res) => {
  try {
    await db('risks').where('id', req.params.riskId).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting risk:', err);
    res.status(500).json({ error: 'Failed to delete risk' });
  }
});

// GET /api/projects/:id/milestones — convenience alias (ordered by due_date)
router.get('/:id/milestones', async (req, res) => {
  try {
    const milestones = await db('milestones')
      .where('project_id', req.params.id)
      .orderBy('due_date', 'asc');
    res.json(milestones);
  } catch (err) {
    console.error('Error fetching project milestones:', err);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// POST /api/projects/:id/upload-sow — upload SOW document
router.post('/:id/upload-sow', sowUpload.single('sow_file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Delete old file if exists
    if (project.sow_file_path) {
      const oldPath = path.join(__dirname, '../../', project.sow_file_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const relativePath = `uploads/sow/${req.file.filename}`;
    // If resubmit=true (CSM uploading missing SOW), put project back to AWAITING_APPROVAL
    const resubmit = req.body?.resubmit === 'true' || req.query?.resubmit === 'true';
    const updateData = {
      sow_file_path: relativePath,
      sow_file_name: req.file.originalname,
      sow_file_size: `${(req.file.size / 1024).toFixed(0)} KB`,
      updated_at: new Date(),
    };
    if (resubmit) {
      updateData.status = 'AWAITING_APPROVAL';
    }

    await db('projects').where('id', id).update(updateData);

    const updated = await db('projects').where('id', id).first();
    res.json({
      message: resubmit
        ? 'SOW uploaded. Project resubmitted to admin for approval.'
        : 'SOW uploaded successfully',
      project: updated,
      resubmitted: resubmit,
    });
  } catch (err) {
    console.error('Error uploading SOW:', err);
    if (err.message.includes('Only document')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Failed to upload SOW' });
  }
});

// GET /api/projects/:id/download-sow — download/view SOW document
router.get('/:id/download-sow', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await db('projects').where('id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.sow_file_path) return res.status(404).json({ error: 'No SOW uploaded for this project' });

    const filePath = path.join(__dirname, '../../', project.sow_file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'SOW file not found on server' });

    res.download(filePath, project.sow_file_name || 'sow_document');
  } catch (err) {
    console.error('Error downloading SOW:', err);
    res.status(500).json({ error: 'Failed to download SOW' });
  }
});

// DELETE /api/projects/:id - Delete project (soft delete by setting status to cancelled)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const count = await db('projects')
      .where('id', id)
      .update({
        status: 'cancelled',
        updated_at: new Date()
      });

    if (!count) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const deletedProject = await db('projects').where('id', id).first();

    res.json({ message: 'Project cancelled successfully', project: deletedProject });
  } catch (error) {
    console.error('Error cancelling project:', error);
    res.status(500).json({ error: 'Failed to cancel project' });
  }
});

// Helper function to get project statistics
async function getProjectStats(projectId) {
  try {
    const [
      taskStats,
      milestoneStats,
      riskStats,
      changeStats
    ] = await Promise.all([
      db('tasks')
        .where('project_id', projectId)
        .select('status')
        .then(tasks => {
          const stats = { total: tasks.length, byStatus: {} };
          tasks.forEach(task => {
            stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
          });
          return stats;
        }),
      db('milestones')
        .where('project_id', projectId)
        .select('status')
        .then(milestones => {
          const stats = { total: milestones.length, byStatus: {} };
          milestones.forEach(milestone => {
            stats.byStatus[milestone.status] = (stats.byStatus[milestone.status] || 0) + 1;
          });
          return stats;
        }),
      db('risks')
        .where('project_id', projectId)
        .select('severity', 'status')
        .then(risks => {
          const stats = { total: risks.length, bySeverity: {}, byStatus: {} };
          risks.forEach(risk => {
            stats.bySeverity[risk.severity] = (stats.bySeverity[risk.severity] || 0) + 1;
            stats.byStatus[risk.status] = (stats.byStatus[risk.status] || 0) + 1;
          });
          return stats;
        }),
      db('changes')
        .where('project_id', projectId)
        .select('status')
        .then(changes => {
          const stats = { total: changes.length, byStatus: {} };
          changes.forEach(change => {
            stats.byStatus[change.status] = (stats.byStatus[change.status] || 0) + 1;
          });
          return stats;
        })
    ]);

    return {
      tasks: taskStats,
      milestones: milestoneStats,
      risks: riskStats,
      changes: changeStats
    };
  } catch (error) {
    console.error('Error fetching project stats:', error);
    return {
      tasks: { total: 0, byStatus: {} },
      milestones: { total: 0, byStatus: {} },
      risks: { total: 0, byStatus: {}, bySeverity: {} },
      changes: { total: 0, byStatus: {} }
    };
  }
}

module.exports = router;
