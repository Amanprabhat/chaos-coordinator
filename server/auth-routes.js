const express = require('express');
const db = require('./database/connection');

// Mock users for demo
const users = [
  {
    id: 1,
    name: 'John Sales',
    email: 'sales@demo.com',
    password: 'password123',
    role: 'SALES'
  },
  {
    id: 2,
    name: 'Sarah CSM',
    email: 'csm@demo.com',
    password: 'password123',
    role: 'CSM'
  },
  {
    id: 3,
    name: 'Mike PM',
    email: 'pm@demo.com',
    password: 'password123',
    role: 'PM'
  },
  {
    id: 4,
    name: 'Admin User',
    email: 'admin@demo.com',
    password: 'password123',
    role: 'ADMIN'
  },
  {
    id: 5,
    name: 'Client User',
    email: 'client@demo.com',
    password: 'password123',
    role: 'CLIENT'
  }
];

// Auth routes function
const setupAuthRoutes = (app) => {
  // Auth endpoints
  app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', email);

    // Find user by email
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // Check password
    if (user.password !== password) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    // Generate mock token (in production, use JWT)
    const token = `mock-token-${user.id}-${Date.now()}`;
    
    console.log('✅ Login successful:', user.name, 'Role:', user.role);

    // Return user data and token
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get current user info (protected route)
app.get('/api/auth/me', async (req, res) => {
  try {
    // In production, verify JWT token here
    // For demo, we'll mock token validation
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    // Mock token validation (in production, verify JWT)
    const userId = parseInt(token.split('-')[1]);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }

    console.log('✅ Auth check successful:', user.name);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Auth check error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

};

module.exports = { setupAuthRoutes, users };
