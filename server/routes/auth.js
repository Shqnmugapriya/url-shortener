const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const authMiddleware = require('../middlewares/auth');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', authController.register);

// @route   POST api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authController.login);

// @route   GET api/auth/me
// @desc    Get current user details
// @access  Private
router.get('/me', authMiddleware, authController.getMe);

// @route   POST api/auth/forgot-password
// @desc    Request password reset link
// @access  Public
router.post('/forgot-password', authController.forgotPassword);

// @route   POST api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', authController.resetPassword);

// @route   PUT api/auth/profile
// @desc    Update user profile settings
// @access  Private
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
