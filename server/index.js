const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./database/connection');
const { setupAuthRoutes } = require('./auth-routes');

// Import modular routes
const dashboardRoutes      = require('./modules/dashboard/dashboardRoutes');
const projectsRoutes       = require('./modules/projects/projectsRoutes');
const tasksRoutes          = require('./modules/tasks/tasksRoutes');
const milestonesRoutes     = require('./modules/milestones/milestonesRoutes');
const handoverRoutes       = require('./modules/handover/handoverRoutes');
const notificationsRoutes  = require('./modules/notifications/notificationsRoutes');
const { startNudgeCron }   = require('./modules/notifications/nudgeJob');
const path                 = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (SOW documents etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Chaos Coordinator API',
    version: '2.0.0'
  });
});

// Auth routes (must come before other API routes)
setupAuthRoutes(app);

// Users endpoint — fetch team members by role for intake form
app.get('/api/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = db('users').select('id', 'name', 'email', 'role', 'department').where('is_active', true);
    if (role) {
      query = query.where('role', role);
    }
    const users = await query.orderBy('name');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/notifications', notificationsRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Chaos Coordinator API v2.0.0',
    version: '2.0.0',
    endpoints: {
      dashboard: {
        overview: 'GET /api/dashboard/overview',
        issues: 'GET /api/dashboard/issues',
        my_work: 'GET /api/dashboard/my-work?user_id=:id',
        activity: 'GET /api/dashboard/activity?limit=:limit',
        performance: 'GET /api/dashboard/performance?period=:days'
      },
      projects: {
        list: 'GET /api/projects',
        details: 'GET /api/projects/:id',
        create: 'POST /api/projects',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id',
        transition_stage: 'POST /api/projects/:id/transition-stage',
        check_transition: 'GET /api/projects/:id/can-transition'
      },
      tasks: {
        list: 'GET /api/tasks',
        details: 'GET /api/tasks/:id',
        create: 'POST /api/tasks',
        update: 'PUT /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id',
        batch_create: 'POST /api/tasks/batch',
        orphaned: 'GET /api/tasks/orphaned',
        overdue: 'GET /api/tasks/overdue',
        assign: 'POST /api/tasks/:id/assign'
      },
      milestones: {
        list: 'GET /api/milestones',
        details: 'GET /api/milestones/:id',
        create: 'POST /api/milestones',
        update: 'PUT /api/milestones/:id',
        delete: 'DELETE /api/milestones/:id',
        project_milestones: 'GET /api/milestones/project/:projectId',
        blocked: 'GET /api/milestones/blocked',
        overdue: 'GET /api/milestones/overdue',
        complete: 'POST /api/milestones/:id/complete'
      },
      handover: {
        list: 'GET /api/handover',
        details: 'GET /api/handover/:id',
        create: 'POST /api/handover',
        update: 'PUT /api/handover/:id',
        approve: 'POST /api/handover/:id/approve',
        project_handovers: 'GET /api/handover/project/:projectId',
        pending: 'GET /api/handover/pending',
        checklist: 'GET /api/handover/checklist/:projectId/:fromRole/:toRole'
      }
    },
    features: {
      ownership_validation: 'Mandatory owner_id for all tasks, milestones, projects, and risks',
      lifecycle_engine: 'Automated stage transitions with validation rules',
      dashboard_analytics: 'Real-time metrics and issue tracking',
      handover_management: 'Structured handover process with approval workflow'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details || []
    });
  }
  
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    });
  }
  
  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Reference Error',
      message: 'Referenced resource does not exist'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Database connection test
async function testDatabaseConnection() {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await db.destroy();
  process.exit(0);
});

// Start server
async function startServer() {
  await testDatabaseConnection();
  startNudgeCron();
  
  app.listen(PORT, () => {
    console.log(`🚀 Chaos Coordinator API Server running on port ${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;
