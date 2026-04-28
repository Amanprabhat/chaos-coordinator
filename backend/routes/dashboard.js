const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(AuthMiddleware.authenticate);

router.get('/', DashboardController.getDashboard);
router.get('/metrics', DashboardController.getMetrics);

module.exports = router;
