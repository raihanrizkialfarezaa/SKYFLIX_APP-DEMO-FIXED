const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');

router.post('/verify-subscription', [auth, adminAuth], adminController.verifySubscriptionPayment);
router.get('/pending-verifications', [auth, adminAuth], adminController.getPendingVerifications);
router.get('/subscription-analytics', [auth, adminAuth], adminController.getSubscriptionAnalytics);

module.exports = router;