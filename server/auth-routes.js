const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Demo users for development — roles match the DB CHECK constraint:
 * ('Sales', 'CSM', 'PM', 'Client', 'Admin')
 * Passwords are bcrypt hashes of 'password123'.
 */
const DEMO_USERS = [
  { id: 1, name: 'John Sales',  email: 'sales@demo.com',  role: 'Sales' },
  { id: 2, name: 'Sarah CSM',   email: 'csm@demo.com',    role: 'CSM'   },
  { id: 3, name: 'Mike PM',     email: 'pm@demo.com',     role: 'PM'    },
  { id: 4, name: 'Admin User',  email: 'admin@demo.com',  role: 'Admin' },
  { id: 5, name: 'Client User', email: 'client@demo.com', role: 'Client'},
];

const setupAuthRoutes = (app) => {
  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Try real DB user first (case-insensitive email match)
      let user = await db('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
      let passwordValid = false;

      if (user) {
        if (user.password_hash) {
          passwordValid = await bcrypt.compare(password, user.password_hash);
        }
      } else {
        // Fall back to demo users (dev only)
        const demoUser = DEMO_USERS.find(u => u.email === email);
        if (demoUser && password === 'password123') {
          user = demoUser;
          passwordValid = true;
        }
      }

      if (!user || !passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      console.log(`✅ Login successful: ${user.name} (${user.role})`);

      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || null },
        token,
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);

      // Try DB first, fall back to demo users
      let user = await db('users').where({ id: decoded.userId }).first();
      if (!user) {
        user = DEMO_USERS.find(u => u.id === decoded.userId);
      }

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });
};

module.exports = { setupAuthRoutes };
