const express = require('express');
const router = express.Router();
const reportingController = require('../controllers/reportingController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// All reporting routes require admin authentication
router.use(auth);
router.use(adminAuth);

router.get('/user-engagement', reportingController.getUserEngagementReport);
router.get('/content-performance', reportingController.getContentPerformanceReport);
router.get('/revenue', reportingController.getRevenueReport);
router.get('/system-health', reportingController.getSystemHealthReport);

module.exports = router;