const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

// Streaming session routes
router.post('/streaming/start', auth, activityController.startStreamingSession);
router.put('/streaming/:sessionId/end', auth, activityController.endStreamingSession);
router.post('/streaming/:sessionId/buffering', auth, activityController.logBuffering);
router.post('/streaming/:sessionId/quality', auth, activityController.logQualityChange);

// Stats routes
router.get('/stats/viewing', auth, activityController.getUserViewingStats);
router.get('/stats/system', [auth, adminAuth], activityController.getSystemMetrics);

module.exports = router;