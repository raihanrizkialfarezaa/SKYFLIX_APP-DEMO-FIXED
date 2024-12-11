const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middlewares/auth');

// User routes
router.get('/', auth, notificationController.getUserNotifications);
router.put('/:notificationId/read', auth, notificationController.markAsRead);
router.put('/read-all', auth, notificationController.markAllAsRead);
router.delete('/:notificationId', auth, notificationController.deleteNotification);
router.put('/preferences', auth, notificationController.updatePreferences);

// Admin routes
router.post('/create', [auth, require('../middlewares/adminAuth')], notificationController.createNotification);

module.exports = router;