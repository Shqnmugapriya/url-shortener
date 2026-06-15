const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report');
const authMiddleware = require('../middlewares/auth');

// All report routes require authentication
router.use(authMiddleware);

// @route   GET api/reports/csv/:urlId
// @desc    Export click logs to CSV
router.get('/csv/:urlId', reportController.exportCSV);

// @route   GET api/reports/excel/:urlId
// @desc    Export click logs to Excel
router.get('/excel/:urlId', reportController.exportExcel);

// @route   GET api/reports/pdf/:urlId
// @desc    Export analytics summary and log to PDF
router.get('/pdf/:urlId', reportController.exportPDF);

module.exports = router;
