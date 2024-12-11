const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const validatePreference = require('../middlewares/preferenceValidation');

// User profile routes
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.delete('/profile', auth, userController.deleteProfile);  // New route

// User preferences route
router.put('/preferences', auth, validatePreference, userController.updatePreferences);

// Subscription management
router.put('/subscription', auth, userController.updateSubscription);

// Watch history
router.get('/watch-history', auth, userController.getWatchHistory);

// Payment information
router.put('/payment-info', auth, userController.updatePaymentInfo);

// Password management
router.put('/change-password', auth, userController.changePassword);

module.exports = router;