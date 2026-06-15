const express = require('express');
const router = express.Router();
const notifController = require('../controllers/notification');
const authMiddleware = require('../middlewares/auth');

// All notification routes require auth
router.use(authMiddleware);

// @route   GET api/notifications
// @desc    Get user notifications
router.get('/', notifController.getNotifications);

// @route   PUT api/notifications/:id/read
// @desc    Mark a notification as read
router.put('/:id/read', notifController.markAsRead);

// @route   PUT api/notifications/read-all
// @desc    Mark all user notifications as read
router.put('/read-all', notifController.markAllAsRead);

module.exports = router;
