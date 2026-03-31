const jwt = require('jsonwebtoken');
const User = require('../database/models/User');

class AuthMiddleware {
  static async authenticate(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.is_active) {
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
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      next();
    };
  }

  static authorizeOwnerOrAdmin(resourceField = 'user_id') {
    return async (req, res, next) => {
      try {
        if (req.user.role === 'admin') {
          return next();
        }

        const resourceId = req.params.id || req.params.projectId || req.params.taskId;
        const resource = await this.getResourceById(req, resourceId);
        
        if (!resource || resource[resourceField] !== req.user.id) {
          return res.status(403).json({ error: 'Access denied. You can only access your own resources.' });
        }

        next();
      } catch (error) {
        res.status(500).json({ error: 'Authorization check failed.' });
      }
    };
  }

  static async getResourceById(req, id) {
    const resourceType = req.route.path.split('/')[1];
    
    switch (resourceType) {
      case 'projects':
        const Project = require('../database/models/Project');
        return await Project.findById(id);
      case 'tasks':
        const Task = require('../database/models/Task');
        return await Task.findById(id);
      case 'deals':
        const Deal = require('../database/models/Deal');
        return await Deal.findById(id);
      default:
        return null;
    }
  }
}

module.exports = AuthMiddleware;
