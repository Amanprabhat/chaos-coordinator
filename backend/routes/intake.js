const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/sow');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF and Word documents are allowed'), false);
    }
    cb(null, true);
  }
});

// POST /intake/create-project
router.post('/create-project', upload.single('sow_file'), [
  body('client_name').notEmpty().withMessage('Client name is required'),
  body('region').notEmpty().withMessage('Region is required'),
  body('licenses').isInt({ min: 0 }).withMessage('Licenses must be a positive integer'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  body('project_type').notEmpty().withMessage('Project type is required'),
  body('client_industry').optional().isString(),
  body('client_size').optional().isIn(['startup', 'small', 'medium', 'large']),
  body('client_contact_name').optional().isString(),
  body('client_contact_email').optional().isEmail(),
  body('deal_value').optional().isString(),
  body('deal_timeline').optional().isString(),
  body('stakeholders').optional().isString(),
  body('requirements').optional().isString(),
  body('core_deliverables').optional().isString(),
  body('technical_requirements').optional().isString(),
  body('business_requirements').optional().isString(),
  body('constraints').optional().isString(),
  body('dependencies').optional().isString(),
  body('additional_notes').optional().isString()
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'SOW document is required'
      });
    }

    // Validate date logic
    const startDate = new Date(req.body.start_date);
    const endDate = new Date(req.body.end_date);
    if (endDate <= startDate) {
      return res.status(400).json({
        error: 'End date must be after start date'
      });
    }

    // Get user info from auth middleware
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user is authorized (sales or admin)
    if (userRole !== 'sales' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Unauthorized: Only sales and admin users can create projects'
      });
    }

    // Start transaction
    const trx = await db.transaction();

    try {
      // 1. Create or find client
      let client;
      const existingClient = await trx('clients')
        .where('name', req.body.client_name)
        .first();

      if (existingClient) {
        client = existingClient;
      } else {
        [client] = await trx('clients').insert({
          name: req.body.client_name,
          industry: req.body.client_industry || null,
          size: req.body.client_size || null,
          region: req.body.region,
          status: 'active',
          health_score: 80
        }).returning('*');
      }

      // 2. Create SOW document record
      const [sowDocument] = await trx('sow_documents').insert({
        filename: req.file.originalname,
        file_path: req.file.path,
        file_size: req.file.size,
        file_type: req.file.mimetype,
        uploaded_by: userId,
        status: 'uploaded'
      }).returning('*');

      // 3. Create project record (initial status)
      const [project] = await trx('projects').insert({
        name: `${req.body.client_name} - ${req.body.project_type}`,
        client_id: client.id,
        sow_document_id: sowDocument.id,
        project_type: req.body.project_type,
        region: req.body.region,
        licenses: parseInt(req.body.licenses),
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        status: 'planning',
        priority: 'medium',
        sales_rep_id: userId,
        ai_generated: false,
        user_reviewed: false
      }).returning('*');

      // 4. Store additional intake data as metadata
      const intakeData = {
        client_contact_name: req.body.client_contact_name,
        client_contact_email: req.body.client_contact_email,
        deal_value: req.body.deal_value,
        deal_timeline: req.body.deal_timeline,
        stakeholders: req.body.stakeholders,
        requirements: req.body.requirements,
        core_deliverables: req.body.core_deliverables,
        technical_requirements: req.body.technical_requirements,
        business_requirements: req.body.business_requirements,
        constraints: req.body.constraints,
        dependencies: req.body.dependencies,
        additional_notes: req.body.additional_notes
      };

      // 5. Log activity
      await trx('activity_log').insert({
        entity_type: 'project',
        entity_id: project.id,
        user_id: userId,
        user_name: req.user.name,
        action_type: 'created',
        content: `Project created via sales intake for ${client.name}`,
        metadata: { intake_data: intakeData, sow_uploaded: true }
      });

      // 6. Update SOW document status to processing
      await trx('sow_documents')
        .where('id', sowDocument.id)
        .update({ status: 'processing' });

      // Commit transaction
      await trx.commit();

      // 7. Trigger SOW processing asynchronously
      // In production, this would be a background job
      processSOWDocument(sowDocument.id, project.id).catch(console.error);

      res.status(201).json({
        message: 'Project intake submitted successfully',
        project: {
          id: project.id,
          name: project.name,
          client_name: client.name,
          project_type: project.project_type,
          status: project.status,
          sow_document: {
            id: sowDocument.id,
            filename: sowDocument.filename,
            status: sowDocument.status
          }
        },
        next_steps: [
          'SOW document is being processed by AI',
          'Project plan will be generated based on template and SOW',
          'You will be able to review and confirm the plan'
        ]
      });

    } catch (error) {
      await trx.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Sales intake error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /intake/status/:projectId
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this project
    const project = await db('projects')
      .select('*')
      .where('id', projectId)
      .where(function() {
        this.where('sales_rep_id', userId)
            .orWhere('pm_id', userId)
            .orWhere('status', 'active'); // Allow access to active projects for all roles
      })
      .first();

    if (!project) {
      return res.status(404).json({
        error: 'Project not found or access denied'
      });
    }

    // Get SOW document status
    const sowDocument = await db('sow_documents')
      .select('*')
      .where('id', project.sow_document_id)
      .first();

    // Get AI extraction if available
    const aiExtraction = await db('ai_extractions')
      .select('*')
      .where('sow_document_id', project.sow_document_id)
      .first();

    // Get generated tasks count
    const tasksCount = await db('tasks')
      .where('project_id', projectId)
      .count('* as count')
      .first();

    res.json({
      project_id: projectId,
      project_name: project.name,
      status: project.status,
      sow_document: {
        status: sowDocument?.status || 'not_uploaded',
        filename: sowDocument?.filename
      },
      ai_extraction: aiExtraction ? {
        status: 'completed',
        confidence_score: aiExtraction.confidence_score,
        extracted_scope: aiExtraction.extracted_scope,
        extracted_deliverables: aiExtraction.extracted_deliverables,
        extracted_risks: aiExtraction.extracted_risks
      } : {
        status: sowDocument?.status === 'processing' ? 'processing' : 'pending'
      },
      project_plan: {
        tasks_generated: parseInt(tasksCount?.count || 0),
        user_reviewed: project.user_reviewed,
        ai_generated: project.ai_generated
      },
      next_action: getNextAction(project, sowDocument, aiExtraction, tasksCount?.count || 0)
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Helper function to determine next action
function getNextAction(project, sowDocument, aiExtraction, tasksCount) {
  if (!sowDocument || sowDocument.status === 'uploaded') {
    return 'Processing SOW document...';
  }
  
  if (sowDocument.status === 'processing') {
    return 'AI is analyzing the SOW document...';
  }
  
  if (!aiExtraction) {
    return 'Waiting for AI processing to complete...';
  }
  
  if (tasksCount === 0) {
    return 'Generating project plan from template and SOW...';
  }
  
  if (!project.user_reviewed) {
    return 'Project plan ready for review';
  }
  
  return 'Project confirmed and ready for execution';
}

// Async function to process SOW document (would be a background job in production)
async function processSOWDocument(sowDocumentId, projectId) {
  try {
    // This would integrate with AI service for SOW parsing
    // For now, we'll simulate the process
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing time

    // Update SOW status
    await db('sow_documents')
      .where('id', sowDocumentId)
      .update({ status: 'processed' });

    // Create AI extraction record (mock data for now)
    const [aiExtraction] = await db('ai_extractions').insert({
      sow_document_id: sowDocumentId,
      confidence_score: 85,
      extracted_scope: 'Software implementation with user training',
      extracted_deliverables: [
        'Software deployment',
        'User training sessions',
        'Technical documentation',
        'Go-live support'
      ],
      extracted_risks: [
        'Timeline constraints',
        'Resource availability',
        'Technical complexity'
      ],
      extracted_dependencies: [
        'Client infrastructure readiness',
        'Third-party system access'
      ],
      extracted_timeline: '90 days',
      raw_response: { mock: 'ai_response' },
      processing_time_ms: 2500,
      processed_at: new Date()
    }).returning('*');

    // Update project with AI extraction reference
    await db('projects')
      .where('id', projectId)
      .update({ ai_extraction_id: aiExtraction.id });

    // Trigger project plan generation
    await generateProjectPlan(projectId, aiExtraction.id);

  } catch (error) {
    console.error('SOW processing error:', error);
    
    // Update status to failed
    await db('sow_documents')
      .where('id', sowDocumentId)
      .update({ status: 'failed' });
  }
}

// Mock project plan generation (would be more sophisticated in production)
async function generateProjectPlan(projectId, aiExtractionId) {
  try {
    // Get project details
    const project = await db('projects').where('id', projectId).first();
    const aiExtraction = await db('ai_extractions').where('id', aiExtractionId).first();

    // Get template based on project type
    const template = await db('templates')
      .where('project_type', project.project_type)
      .where('is_active', true)
      .first();

    if (!template) {
      throw new Error(`No template found for project type: ${project.project_type}`);
    }

    // Get template tasks
    const templateTasks = await db('template_tasks')
      .where('template_id', template.id)
      .orderBy('sequence_order');

    // Calculate project timeline
    const totalDays = Math.ceil((new Date(project.end_date) - new Date(project.start_date)) / (1000 * 60 * 60 * 24));
    const bufferDays = Math.floor(totalDays * (template.buffer_percentage / 100));
    const workingDays = totalDays - bufferDays;

    // Generate tasks based on template
    const tasks = [];
    let currentDate = new Date(project.start_date);

    for (const templateTask of templateTasks) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + templateTask.duration_days);

      const [task] = await db('tasks').insert({
        project_id: projectId,
        template_task_id: templateTask.id,
        name: templateTask.name,
        description: templateTask.description,
        phase: templateTask.phase,
        sequence_order: templateTask.sequence_order,
        duration_days: templateTask.duration_days,
        owner_role: templateTask.owner_role,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        is_parallel: templateTask.is_parallel,
        dependencies: templateTask.dependencies,
        status: 'todo'
      }).returning('*');

      tasks.push(task);

      // Move to next task date
      if (!templateTask.is_parallel) {
        currentDate = new Date(endDate);
      }
    }

    // Update project status
    await db('projects')
      .where('id', projectId)
      .update({
        ai_generated: true,
        user_reviewed: false
      });

    // Log activity
    await db('activity_log').insert({
      entity_type: 'project',
      entity_id: projectId,
      action_type: 'created',
      content: `Generated ${tasks.length} tasks from template and SOW analysis`,
      metadata: { 
        template_used: template.name,
        ai_confidence: aiExtraction.confidence_score,
        tasks_generated: tasks.length
      }
    });

  } catch (error) {
    console.error('Project plan generation error:', error);
    throw error;
  }
}

module.exports = router;
