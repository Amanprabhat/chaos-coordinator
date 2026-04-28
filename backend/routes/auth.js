const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').isIn(['sales', 'product', 'csm', 'pm', 'admin']).withMessage('Valid role required'),
  body('department').optional().trim().isLength({ max: 50 }).withMessage('Department must be less than 50 characters')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.get('/me', AuthMiddleware.authenticate, AuthController.getCurrentUser);
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout);

module.exports = router;
