const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./database/connection');
const { users, generateToken, verifyToken } = require('./auth-demo');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5500',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080'
  ],
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Chaos Coordinator API',
    version: '2.3.0',
    features: {
      basic_modules: true,
      enhanced_features: 'Available in enhanced modules',
      database: 'SQLite',
      frontend: 'React + TypeScript'
    }
  });
});

// Basic API endpoints for demonstration
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db('projects').select('*');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db('tasks').select('*');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const allUsers = await db('users').select('*');
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/milestones', async (req, res) => {
  try {
    const milestones = await db('milestones').select('*');
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

app.get('/api/decisions', async (req, res) => {
  try {
    // Return empty array for now since enhanced modules aren't working
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// Authentication endpoints
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user);
  
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      is_active: user.is_active
    },
    token
  });
});

app.get('/api/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const user = users.find(u => u.id === decoded.id);
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    is_active: user.is_active
  });
});

app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Chaos Coordinator API v2.3.0',
    version: '2.3.0',
    endpoints: {
      basic: {
        projects: 'GET /api/projects',
        tasks: 'GET /api/tasks',
        users: 'GET /api/users',
        milestones: 'GET /api/milestones',
        decisions: 'GET /api/decisions'
      },
      enhanced: {
        role_based_dashboard: 'Available in enhanced modules',
        guided_workflow: 'Available in enhanced modules',
        simplified_mode: 'Available in enhanced modules',
        project_templates: 'Available in enhanced modules',
        project_health: 'Available in enhanced modules',
        activity_timeline: 'Available in enhanced modules',
        project_summary: 'Available in enhanced modules'
      },
      intelligence: {
        decisions: 'Available in enhanced modules',
        responsibility: 'Available in enhanced modules',
        meetings: 'Available in enhanced modules',
        delays: 'Available in enhanced modules',
        analytics: 'Available in enhanced modules'
      }
    },
    features: {
      decision_tracking: 'Available in enhanced modules',
      responsibility_timeline: 'Available in enhanced modules',
      meeting_notes: 'Available in enhanced modules',
      delay_tracking: 'Available in enhanced modules',
      project_intelligence: 'Available in enhanced modules',
      role_based_dashboards: 'Available in enhanced modules',
      guided_workflows: 'Available in enhanced modules',
      simplified_mode: 'Available in enhanced modules',
      auto_assignment: 'Available in enhanced modules',
      smart_notifications: 'Available in enhanced modules',
      project_health_scoring: 'Available in enhanced modules',
      activity_timeline: 'Available in enhanced modules'
    },
    documentation: {
      api_docs: 'http://localhost:3001/api',
      health_check: 'http://localhost:3001/health',
      enhanced_features: 'All v2.1, v2.2, and v2.3 features available in enhanced modules'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
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
    
    // Check available tables
    const tables = await db('sqlite_master')
      .select('name')
      .where('type', 'table')
      .orderBy('name', 'ASC');
    
    console.log('📊 Available tables:');
    tables.forEach(row => {
      console.log(`   - ${row.name}`);
    });
    
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
  
  app.listen(PORT, () => {
    console.log(`🚀 Chaos Coordinator API Server running on port ${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`� Available Modules: Basic v2.0 + Enhanced v2.1/v2.2/v2.3 modules`);
    console.log(`🔧 To enable enhanced features:`);
    console.log(`   1. Run database migrations: node database/schema_new.sql`);
    console.log(`   2. Run enhanced schema: node database/schema_enhancements_v2.sql`);
    console.log(`   3. Run decision tracking: node database/decision_tracking_schema.sql`);
    console.log(`   4. Use enhanced server: node server/index-enhanced.js`);
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
