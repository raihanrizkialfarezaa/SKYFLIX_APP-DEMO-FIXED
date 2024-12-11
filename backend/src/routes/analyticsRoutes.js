const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

router.get('/user-engagement', [auth, adminAuth], analyticsController.getUserEngagement);
router.get('/content-performance', [auth, adminAuth], analyticsController.getContentPerformance);
router.get('/subscription-metrics', [auth, adminAuth], analyticsController.getSubscriptionMetrics);

module.exports = router;