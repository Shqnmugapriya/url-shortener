const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsDetails');
const authMiddleware = require('../middlewares/auth');

// All analytics routes require auth
router.use(authMiddleware);

// @route   GET api/analytics
// @desc    Get aggregated overview analytics for current user
router.get('/', analyticsController.getUserOverviewAnalytics);

// @route   GET api/analytics/global
// @desc    Get global statistics (Admin only)
router.get('/global', analyticsController.getGlobalAnalytics);

// @route   GET api/analytics/:urlId
// @desc    Get detailed stats for a specific URL (Owner or Admin)
router.get('/:urlId', analyticsController.getUrlAnalytics);

module.exports = router;
