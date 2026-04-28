const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

class AuthMiddleware {
  static async authenticate(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await db('users').where({ id: decoded.userId }).first();

      if (!user || user.is_active === false) {
        return res.status(401).json({ error: 'Invalid token or user inactive.' });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token.' });
    }
  }

  static authorize(allowedRoles) {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      next();
    };
  }
}

module.exports = AuthMiddleware;
