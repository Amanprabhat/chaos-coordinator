const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const mockProjects = [
  {
    id: 1,
    name: 'Website Redesign Project',
    client_name: 'Tech Corp',
    status: 'INTAKE_CREATED',
    stage: 'planning',
    pm_id: 1,
    sales_owner_id: 1,
    csm_id: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: 'Mobile App Development',
    client_name: 'StartupXYZ',
    status: 'MEETING_SCHEDULED',
    stage: 'design',
    pm_id: 2,
    sales_owner_id: 1,
    csm_id: 2,
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-01-12T14:00:00Z'
  },
  {
    id: 3,
    name: 'Database Migration',
    client_name: 'Enterprise Inc',
    status: 'HANDOVER_PENDING',
    stage: 'development',
    pm_id: 3,
    sales_owner_id: 2,
    csm_id: 1,
    created_at: '2024-01-05T11:00:00Z',
    updated_at: '2024-01-14T16:00:00Z'
  }
];

// Routes
app.get('/api/projects', (req, res) => {
  console.log('GET /api/projects - returning mock projects');
  res.json(mockProjects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = mockProjects.find(p => p.id === parseInt(req.params.id));
  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mock server running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET /api/projects - Get all projects`);
  console.log(`   GET /api/projects/:id - Get specific project`);
  console.log(`   GET /health - Health check`);
});
