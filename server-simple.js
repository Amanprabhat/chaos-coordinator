const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// Knowmax-inspired assets
app.get('/api/assets/knowmax-logo', (req, res) => {
  const svgLogo = `
    <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="knowmaxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <circle cx="20" cy="20" r="8" fill="url(#knowmaxGradient)" opacity="0.8"/>
      <circle cx="40" cy="15" r="5" fill="url(#knowmaxGradient)" opacity="0.6"/>
      <circle cx="60" cy="25" r="6" fill="url(#knowmaxGradient)" opacity="0.7"/>
      <circle cx="80" cy="18" r="4" fill="url(#knowmaxGradient)" opacity="0.5"/>
      <circle cx="100" cy="22" r="7" fill="url(#knowmaxGradient)" opacity="0.8"/>
      
      <line x1="20" y1="20" x2="40" y2="15" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="40" y1="15" x2="60" y2="25" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="60" y1="25" x2="80" y2="18" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      <line x1="80" y1="18" x2="100" y2="22" stroke="url(#knowmaxGradient)" stroke-width="1" opacity="0.3"/>
      
      <text x="50" y="35" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            text-anchor="middle" fill="url(#knowmaxGradient)" filter="url(#glow)">
        Knowmax
      </text>
    </svg>
    `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svgLogo.trim());
});

app.get('/api/assets/pattern/:type', (req, res) => {
  const { type } = req.params;
  let svgPattern = '';
  
  switch(type) {
    case 'dots':
      svgPattern = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="2" fill="#4F46E5" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotPattern)"/>
        </svg>
      `;
      break;
    case 'lines':
      svgPattern = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="linePattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="30" y2="30" stroke="#7C3AED" stroke-width="1" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#linePattern)"/>
        </svg>
      `;
      break;
    default:
      svgPattern = '<svg></svg>';
  }
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svgPattern.trim());
});

// Simple in-memory database for testing
const users = [
  {
    id: '1',
    name: 'John Admin',
    email: 'admin@chaoscoordinator.com',
    password: '$2a$12$6XU8BlxYiU7NyMgjVAOh8uH9iPRNiBuhdAYVKVZDCyouCQW6RVxeS', // password123
    role: 'admin'
  },
  {
    id: '2', 
    name: 'Sarah Sales',
    email: 'sarah@chaoscoordinator.com',
    password: '$2a$12$6XU8BlxYiU7NyMgjVAOh8uH9iPRNiBuhdAYVKVZDCyouCQW6RVxeS', // password123
    role: 'sales'
  },
  {
    id: '3',
    name: 'Mike PM', 
    email: 'mike@chaoscoordinator.com',
    password: '$2a$12$6XU8BlxYiU7NyMgjVAOh8uH9iPRNiBuhdAYVKVZDCyouCQW6RVxeS', // password123
    role: 'pm'
  }
];

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Simple dashboard data
app.get('/api/dashboard', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Simple dashboard data based on role
    const dashboardData = {
      overview: {
        total_projects: 3,
        total_tasks: 12,
        overdue_tasks: 2,
        total_deals: 5,
        total_users: 5
      },
      recent_activity: [
        {
          id: '1',
          content: 'Project "Acme Corp Implementation" created',
          user_name: user.name,
          created_at: new Date().toISOString()
        }
      ]
    };
    
    res.json(dashboardData);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Chaos Coordinator API is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🔐 Login credentials:');
  console.log('Admin: admin@chaoscoordinator.com / password123');
  console.log('Sales: sarah@chaoscoordinator.com / password123');
  console.log('PM: mike@chaoscoordinator.com / password123');
});
