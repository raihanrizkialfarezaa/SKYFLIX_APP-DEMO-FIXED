const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const auth = require('../middlewares/auth');

router.get('/status', auth, subscriptionController.checkStatus);
router.post('/start', auth, subscriptionController.startSubscription);
router.post('/verify-payment', auth, subscriptionController.verifyPayment);
router.post('/renewal', auth, subscriptionController.handleRenewal);
router.post('/cancel', auth, subscriptionController.cancelSubscription);

module.exports = router;