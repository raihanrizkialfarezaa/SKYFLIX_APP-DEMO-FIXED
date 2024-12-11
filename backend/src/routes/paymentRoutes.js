const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middlewares/auth');
const imageUpload = require('../middlewares/imageUpload');

router.post('/process', auth, paymentController.processPayment);
// upload paymentProof
router.post('/:paymentId/proof', 
    auth, 
    imageUpload.single('paymentProof'), // 'paymentProof' is a fieldname for file
    paymentController.uploadPaymentProof
);
router.get('/history', auth, paymentController.getPaymentHistory);
router.post('/auto-renewal/:userId', auth, paymentController.handleAutoRenewal);

module.exports = router;