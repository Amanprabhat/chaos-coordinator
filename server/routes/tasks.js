const express = require('express');
const { body } = require('express-validator');
const TaskController = require('../controllers/taskController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

const createTaskValidation = [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Task title must be between 2 and 200 characters'),
  body('project_id').isUUID().withMessage('Valid project ID required'),
  body('assignee_id').optional().isUUID().withMessage('Valid assignee ID required'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('estimated_hours').optional().isInt({ min: 1 }).withMessage('Estimated hours must be a positive integer'),
  body('due_date').optional().isISO8601().withMessage('Valid due date required'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
];

const updateTaskValidation = [
  body('title').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Task title must be between 2 and 200 characters'),
  body('assignee_id').optional().isUUID().withMessage('Valid assignee ID required'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('estimated_hours').optional().isInt({ min: 1 }).withMessage('Estimated hours must be a positive integer'),
  body('actual_hours').optional().isInt({ min: 0 }).withMessage('Actual hours must be a non-negative integer'),
  body('due_date').optional().isISO8601().withMessage('Valid due date required'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
];

router.use(AuthMiddleware.authenticate);

router.post('/', createTaskValidation, TaskController.createTask);
router.get('/', TaskController.getTasks);
router.get('/overdue', AuthMiddleware.authorize(['admin', 'pm']), TaskController.getOverdueTasks);
router.get('/blocked', AuthMiddleware.authorize(['admin', 'pm']), TaskController.getBlockedTasks);
router.get('/:id', TaskController.getTask);
router.put('/:id', updateTaskValidation, TaskController.updateTask);
router.patch('/:id/status', TaskController.updateTaskStatus);
router.patch('/:id/complete', TaskController.completeTask);

module.exports = router;
