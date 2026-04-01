const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const OwnershipValidator = require('../auth/OwnershipValidator');
const { body, validationResult } = require('express-validator');
const { updateProjectStatus } = require('../projects/projectStateEngine');

/**
 * Handover Notes API Routes
 * Base: /api/handover
 */

// GET /api/handover - Get all handover notes with optional filters
router.get('/', async (req, res) => {
  try {
    const { project_id, from_role, to_role, checklist_completed } = req.query;
    
    let query = db('handover_notes')
      .select(
        'handover_notes.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.current_stage_id',
        'lifecycle_stages.name as project_stage',
        'from_user.name as from_user_name',
        'from_user.email as from_user_email',
        'to_user.name as to_user_name',
        'to_user.email as to_user_email',
        'approved_by_user.name as approved_by_name',
        'approved_by_user.email as approved_by_email'
      )
      .leftJoin('projects', 'handover_notes.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as from_user', 'handover_notes.from_role', 'from_user.role')
      .leftJoin('users as to_user', 'handover_notes.to_role', 'to_user.role')
      .leftJoin('users as approved_by_user', 'handover_notes.approved_by', 'approved_by_user.id')
      .orderBy('handover_notes.created_at', 'desc');

    // Apply filters
    if (project_id) {
      query = query.where('handover_notes.project_id', project_id);
    }
    if (from_role) {
      query = query.where('handover_notes.from_role', from_role);
    }
    if (to_role) {
      query = query.where('handover_notes.to_role', to_role);
    }
    if (checklist_completed !== undefined) {
      const completed = checklist_completed === 'true';
      query = query.where('handover_notes.checklist_completed', completed);
    }

    const handovers = await query;
    res.json(handovers);
  } catch (error) {
    console.error('Error fetching handover notes:', error);
    res.status(500).json({ error: 'Failed to fetch handover notes' });
  }
});

// GET /api/handover/:id - Get single handover note with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const handover = await db('handover_notes')
      .select(
        'handover_notes.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.current_stage_id',
        'lifecycle_stages.name as project_stage',
        'from_user.name as from_user_name',
        'from_user.email as from_user_email',
        'from_user.role as from_user_role',
        'to_user.name as to_user_name',
        'to_user.email as to_user_email',
        'to_user.role as to_user_role',
        'approved_by_user.name as approved_by_name',
        'approved_by_user.email as approved_by_email',
        'approved_by_user.role as approved_by_role'
      )
      .leftJoin('projects', 'handover_notes.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as from_user', 'handover_notes.from_role', 'from_user.role')
      .leftJoin('users as to_user', 'handover_notes.to_role', 'to_user.role')
      .leftJoin('users as approved_by_user', 'handover_notes.approved_by', 'approved_by_user.id')
      .where('handover_notes.id', id)
      .first();

    if (!handover) {
      return res.status(404).json({ error: 'Handover note not found' });
    }

    // Get related project context
    const projectContext = await db('projects')
      .select(
        'projects.*',
        'lifecycle_stages.name as current_stage_name',
        'owner.name as project_owner_name',
        'owner.email as project_owner_email'
      )
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as owner', 'projects.owner_id', 'owner.id')
      .where('projects.id', handover.project_id)
      .first();

    handover.project_context = projectContext;

    res.json(handover);
  } catch (error) {
    console.error('Error fetching handover note:', error);
    res.status(500).json({ error: 'Failed to fetch handover note' });
  }
});

// POST /api/handover - Submit new handover notes
router.post('/', [
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('from_role').isIn(['Sales', 'CSM', 'PM', 'Client']).withMessage('Invalid from role'),
  body('to_role').isIn(['Sales', 'CSM', 'PM', 'Client']).withMessage('Invalid to role'),
  body('notes').optional().isString(),
  body('submitted_by').isInt({ min: 1 }).withMessage('Valid submitted by user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const handoverData = req.body;

    // Validate roles are different
    if (handoverData.from_role === handoverData.to_role) {
      return res.status(400).json({ error: 'From role and to role must be different' });
    }

    // Validate user exists
    await OwnershipValidator.validateUserExists(handoverData.submitted_by, db);

    // Validate project exists
    const project = await db('projects').where('id', handoverData.project_id).first();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    // Check if handover already exists for this project and role transition
    const existingHandover = await db('handover_notes')
      .where({
        project_id: handoverData.project_id,
        from_role: handoverData.from_role,
        to_role: handoverData.to_role
      })
      .where('created_at', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .first();

    if (existingHandover && existingHandover.checklist_completed) {
      return res.status(400).json({ 
        error: 'Handover checklist already completed for this role transition',
        existing_handover: existingHandover
      });
    }

    const [newHandover] = await db('handover_notes')
      .insert({
        ...handoverData,
        checklist_completed: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Log handover submission
    await db('activity_log').insert({
      project_id: handoverData.project_id,
      action: 'handover_submitted',
      details: JSON.stringify({
        handover_id: newHandover.id,
        from_role: handoverData.from_role,
        to_role: handoverData.to_role,
        submitted_by: handoverData.submitted_by,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.status(201).json(newHandover);
  } catch (error) {
    console.error('Error creating handover note:', error);
    if (error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create handover note' });
  }
});

// PUT /api/handover/:id - Update handover notes
router.put('/:id', [
  body('notes').optional().isString(),
  body('checklist_completed').optional().isBoolean().withMessage('Checklist completed must be boolean'),
  body('approved_by').optional().isInt({ min: 1 }).withMessage('Valid approved by user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if handover exists
    const existingHandover = await db('handover_notes').where('id', id).first();
    if (!existingHandover) {
      return res.status(404).json({ error: 'Handover note not found' });
    }

    // Validate approved_by user if provided
    if (updateData.approved_by) {
      await OwnershipValidator.validateUserExists(updateData.approved_by, db);
    }

    // If marking checklist as completed, validate that all required fields are present
    if (updateData.checklist_completed === true && !existingHandover.notes && !updateData.notes) {
      return res.status(400).json({ error: 'Notes are required when completing handover checklist' });
    }

    const [updatedHandover] = await db('handover_notes')
      .where('id', id)
      .update({
        ...updateData,
        updated_at: new Date()
      })
      .returning('*');

    // Log handover update
    await db('activity_log').insert({
      project_id: existingHandover.project_id,
      action: 'handover_updated',
      details: JSON.stringify({
        handover_id: id,
        updated_fields: Object.keys(updateData),
        updated_by: updateData.approved_by || 'system',
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    // If checklist was completed, check if all required documents exist for AWAITING_APPROVAL
    if (updateData.checklist_completed === true && !existingHandover.checklist_completed) {
      await checkAndTransitionToAwaitingApproval(existingHandover.project_id);
    }

    res.json(updatedHandover);
  } catch (error) {
    console.error('Error updating handover note:', error);
    if (error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update handover note' });
  }
});

// POST /api/handover/:id/approve - Approve handover notes
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

    // Validate user exists
    await OwnershipValidator.validateUserExists(approved_by, db);

    // Check if handover exists
    const existingHandover = await db('handover_notes').where('id', id).first();
    if (!existingHandover) {
      return res.status(404).json({ error: 'Handover note not found' });
    }

    if (existingHandover.approved_by) {
      return res.status(400).json({ error: 'Handover already approved' });
    }

    if (!existingHandover.checklist_completed) {
      return res.status(400).json({ error: 'Cannot approve handover until checklist is completed' });
    }

    const [updatedHandover] = await db('handover_notes')
      .where('id', id)
      .update({
        approved_by: approved_by,
        notes: approval_notes ? `${existingHandover.notes || ''}\n\nApproval Notes:\n${approval_notes}` : existingHandover.notes,
        updated_at: new Date()
      })
      .returning('*');

    // Log handover approval
    await db('activity_log').insert({
      project_id: existingHandover.project_id,
      action: 'handover_approved',
      details: JSON.stringify({
        handover_id: id,
        from_role: existingHandover.from_role,
        to_role: existingHandover.to_role,
        approved_by: approved_by,
        approval_notes: approval_notes,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    res.json({
      message: 'Handover approved successfully',
      handover: updatedHandover
    });
  } catch (error) {
    console.error('Error approving handover note:', error);
    if (error.message.includes('User')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to approve handover note' });
  }
});

// GET /api/handover/project/:projectId - Get all handover notes for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const handovers = await db('handover_notes')
      .select(
        'handover_notes.*',
        'from_user.name as from_user_name',
        'from_user.email as from_user_email',
        'to_user.name as to_user_name',
        'to_user.email as to_user_email',
        'approved_by_user.name as approved_by_name',
        'approved_by_user.email as approved_by_email'
      )
      .leftJoin('users as from_user', 'handover_notes.from_role', 'from_user.role')
      .leftJoin('users as to_user', 'handover_notes.to_role', 'to_user.role')
      .leftJoin('users as approved_by_user', 'handover_notes.approved_by', 'approved_by_user.id')
      .where('handover_notes.project_id', projectId)
      .orderBy('handover_notes.created_at', 'desc');

    res.json(handovers);
  } catch (error) {
    console.error('Error fetching project handover notes:', error);
    res.status(500).json({ error: 'Failed to fetch project handover notes' });
  }
});

// GET /api/handover/pending - Get pending handovers (checklist not completed or not approved)
router.get('/pending', async (req, res) => {
  try {
    const pendingHandovers = await db('handover_notes')
      .select(
        'handover_notes.*',
        'projects.name as project_name',
        'projects.client_name',
        'projects.current_stage_id',
        'lifecycle_stages.name as project_stage',
        'from_user.name as from_user_name',
        'from_user.email as from_user_email',
        'to_user.name as to_user_name',
        'to_user.email as to_user_email'
      )
      .leftJoin('projects', 'handover_notes.project_id', 'projects.id')
      .leftJoin('lifecycle_stages', 'projects.current_stage_id', 'lifecycle_stages.id')
      .leftJoin('users as from_user', 'handover_notes.from_role', 'from_user.role')
      .leftJoin('users as to_user', 'handover_notes.to_role', 'to_user.role')
      .where('handover_notes.checklist_completed', false)
      .orWhere('handover_notes.approved_by', null)
      .orderBy('handover_notes.created_at', 'asc');

    // Categorize pending handovers
    const categorized = {
      needs_checklist: pendingHandovers.filter(h => !h.checklist_completed),
      needs_approval: pendingHandovers.filter(h => h.checklist_completed && !h.approved_by)
    };

    res.json({
      message: 'Pending handovers',
      total_count: pendingHandovers.length,
      needs_checklist_count: categorized.needs_checklist.length,
      needs_approval_count: categorized.needs_approval.length,
      categorized,
      all_handovers: pendingHandovers
    });
  } catch (error) {
    console.error('Error fetching pending handovers:', error);
    res.status(500).json({ error: 'Failed to fetch pending handovers' });
  }
});

// GET /api/handover/checklist/:projectId/:fromRole/:toRole - Get or create handover checklist
router.get('/checklist/:projectId/:fromRole/:toRole', async (req, res) => {
  try {
    const { projectId, fromRole, toRole } = req.params;

    // Validate roles
    const validRoles = ['Sales', 'CSM', 'PM', 'Client'];
    if (!validRoles.includes(fromRole) || !validRoles.includes(toRole)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    if (fromRole === toRole) {
      return res.status(400).json({ error: 'From role and to role must be different' });
    }

    // Check if handover checklist exists
    let handover = await db('handover_notes')
      .where({
        project_id: projectId,
        from_role: fromRole,
        to_role: toRole
      })
      .orderBy('created_at', 'desc')
      .first();

    // If no handover exists, create a template
    if (!handover) {
      const project = await db('projects')
        .select('name', 'client_name')
        .where('id', projectId)
        .first();

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const [newHandover] = await db('handover_notes')
        .insert({
          project_id: projectId,
          from_role: fromRole,
          to_role: toRole,
          checklist_completed: false,
          notes: `Handover checklist for ${project.name} (${project.client_name})\n\nFrom: ${fromRole}\nTo: ${toRole}\n\nChecklist Items:\n- [ ] Review project documentation\n- [ ] Confirm requirements understanding\n- [ ] Discuss timeline and milestones\n- [ ] Identify potential risks\n- [ ] Agree on communication plan\n- [ ] Transfer relevant files and access\n- [ ] Schedule follow-up meeting`,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      handover = newHandover;
    }

    res.json(handover);
  } catch (error) {
    console.error('Error getting handover checklist:', error);
    res.status(500).json({ error: 'Failed to get handover checklist' });
  }
});

// POST /api/handover/documents - Upload documents and check for approval transition
router.post('/documents', [
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID is required'),
  body('document_type').isIn(['MOM', 'SOW', 'CONTRACT', 'OTHER']).withMessage('Invalid document type'),
  body('document_name').isString().notEmpty().withMessage('Document name is required'),
  body('file_path').isString().notEmpty().withMessage('File path is required'),
  body('uploaded_by').isInt({ min: 1 }).withMessage('Valid uploader user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const documentData = req.body;

    // Validate project exists
    const project = await db('projects').where('id', documentData.project_id).first();
    if (!project) {
      return res.status(400).json({ error: 'Project not found' });
    }

    // Validate uploader exists
    const uploader = await db('users').where('id', documentData.uploaded_by).first();
    if (!uploader) {
      return res.status(400).json({ error: 'Uploader user not found' });
    }

    const [newDocument] = await db('documents')
      .insert({
        ...documentData,
        uploaded_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Check if all required documents exist for AWAITING_APPROVAL
    await checkAndTransitionToAwaitingApproval(documentData.project_id);

    // Log document upload
    await db('activity_log').insert({
      project_id: documentData.project_id,
      action: 'document_uploaded',
      details: JSON.stringify({
        document_id: newDocument.id,
        document_type: documentData.document_type,
        document_name: documentData.document_name,
        uploaded_by: documentData.uploaded_by,
        timestamp: new Date()
      }),
      created_at: new Date()
    });

    console.log(`[HANDOVER] Uploaded ${documentData.document_type} document for project ${documentData.project_id}`);

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * Check if all required documents exist and transition to AWAITING_APPROVAL
 * @param {number} projectId - Project ID
 */
async function checkAndTransitionToAwaitingApproval(projectId) {
  try {
    // Get project current status
    const project = await db('projects').where('id', projectId).first();
    if (!project || project.status !== 'HANDOVER_PENDING') {
      return;
    }

    // Check if MOM is uploaded
    const momDocument = await db('documents')
      .where('project_id', projectId)
      .where('document_type', 'MOM')
      .first();

    if (!momDocument) {
      console.log(`[HANDOVER] MOM not yet uploaded for project ${projectId}`);
      return;
    }

    // Check if handover checklist is completed
    const handoverCompleted = await db('handover_notes')
      .where('project_id', projectId)
      .where('checklist_completed', true)
      .first();

    if (!handoverCompleted) {
      console.log(`[HANDOVER] Handover checklist not yet completed for project ${projectId}`);
      return;
    }

    // All requirements met - transition to AWAITING_APPROVAL
    await updateProjectStatus(projectId, 'AWAITING_APPROVAL');
    console.log(`[HANDOVER] Project ${projectId} transitioned to AWAITING_APPROVAL`);

  } catch (error) {
    console.error(`[HANDOVER] Error checking approval requirements for project ${projectId}:`, error);
  }
}

module.exports = router;
