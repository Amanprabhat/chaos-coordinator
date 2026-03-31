// Simple authentication middleware for basic server
const users = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@chaoscoordinator.com',
    password: 'password123',
    role: 'PM', // Admin role mapped to PM for now
    department: 'Management',
    is_active: true
  },
  {
    id: 2,
    name: 'Sarah Sales',
    email: 'sarah@chaoscoordinator.com',
    password: 'password123',
    role: 'Sales',
    department: 'Sales',
    is_active: true
  },
  {
    id: 3,
    name: 'Mike PM',
    email: 'mike@chaoscoordinator.com',
    password: 'password123',
    role: 'PM',
    department: 'Project Management',
    is_active: true
  },
  {
    id: 4,
    name: 'Lisa CSM',
    email: 'lisa@chaoscoordinator.com',
    password: 'password123',
    role: 'CSM',
    department: 'Customer Success',
    is_active: true
  },
  {
    id: 5,
    name: 'Tom Product',
    email: 'tom@chaoscoordinator.com',
    password: 'password123',
    role: 'PM', // Product role mapped to PM for now
    department: 'Product',
    is_active: true
  },
  {
    id: 6,
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'password123',
    role: 'Sales',
    department: 'Demo',
    is_active: true
  }
];

// Generate JWT token (simple version for demo)
const generateToken = (user) => {
  return Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64');
};

// Verify token
const verifyToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const data = JSON.parse(decoded);
    if (data.exp < Date.now()) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

module.exports = {
  users,
  generateToken,
  verifyToken
};
