const express = require('express');
const router = express.Router();
const urlController = require('../controllers/url');
const authMiddleware = require('../middlewares/auth');

// All URL management routes require authentication
router.use(authMiddleware);

// @route   POST api/urls
// @desc    Create a short URL
router.post('/', urlController.createUrl);

// @route   GET api/urls
// @desc    Get all URLs for user (or all if admin)
router.get('/', urlController.getUrls);

// @route   PUT api/urls/:id
// @desc    Edit a URL
router.put('/:id', urlController.editUrl);

// @route   DELETE api/urls/:id
// @desc    Delete a URL
router.delete('/:id', urlController.deleteUrl);

// @route   POST api/urls/bulk
// @desc    Bulk create short URLs
router.post('/bulk', urlController.bulkShorten);

module.exports = router;
