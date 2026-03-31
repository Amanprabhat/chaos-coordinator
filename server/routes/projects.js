const express = require('express');
const { body } = require('express-validator');
const ProjectController = require('../controllers/projectController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

const createProjectValidation = [
  body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Project name must be between 2 and 200 characters'),
  body('client_id').isUUID().withMessage('Valid client ID required'),
  body('deal_id').optional().isUUID().withMessage('Valid deal ID required'),
  body('pm_id').isUUID().withMessage('Valid PM ID required'),
  body('budget').optional().isDecimal().withMessage('Budget must be a valid number'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
];

const updateProjectValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Project name must be between 2 and 200 characters'),
  body('budget').optional().isDecimal().withMessage('Budget must be a valid number'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
];

router.use(AuthMiddleware.authenticate);

router.post('/', createProjectValidation, ProjectController.createProject);
router.get('/', ProjectController.getProjects);
router.get('/delayed', AuthMiddleware.authorize(['admin', 'pm']), ProjectController.getDelayedProjects);
router.get('/:id', ProjectController.getProject);
router.put('/:id', updateProjectValidation, ProjectController.updateProject);
router.patch('/:id/stage', ProjectController.updateProjectStage);

module.exports = router;
