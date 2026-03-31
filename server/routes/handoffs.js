const express = require('express');
const { body } = require('express-validator');
const HandoffController = require('../controllers/handoffController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

const initiateHandoffValidation = [
  body('deal_id').isUUID().withMessage('Valid deal ID required'),
  body('pm_id').isUUID().withMessage('Valid PM ID required'),
  body('handoff_notes').optional().trim().isLength({ max: 1000 }).withMessage('Handoff notes must be less than 1000 characters')
];

const rejectHandoffValidation = [
  body('rejection_reason').trim().isLength({ min: 10, max: 500 }).withMessage('Rejection reason must be between 10 and 500 characters')
];

router.use(AuthMiddleware.authenticate);

router.post('/initiate', AuthMiddleware.authorize(['sales']), initiateHandoffValidation, HandoffController.initiateHandoff);
router.get('/pending', HandoffController.getPendingHandoffs);
router.post('/:deal_id/accept', AuthMiddleware.authorize(['pm']), HandoffController.acceptHandoff);
router.post('/:deal_id/reject', AuthMiddleware.authorize(['pm']), rejectHandoffValidation, HandoffController.rejectHandoff);
router.get('/:deal_id/history', HandoffController.getHandoffHistory);

module.exports = router;
