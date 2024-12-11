const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

const paymentController = {
  // Process subscription payment
  async processPayment(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { paymentMethod, planType, cardInfo } = req.body;

      // Get subscription pricing
      const pricing = {
        monthly: 9.99,
        yearly: 99.99,
      };

      const amount = pricing[planType];

      // Create payment record
      const payment = {
        userId,
        type: 'subscription',
        planType,
        amount,
        paymentMethod,
        cardInfo: {
          cardType: cardInfo.cardType,
          lastFourDigits: cardInfo.cardNumber.slice(-4),
          expirationDate: new Date(cardInfo.expirationDate),
        },
        status: 'pending',
        createdAt: new Date(),
        transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      };

      const result = await db.collection('payments').insertOne(payment);

      // Update user's payment info
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            paymentInfo: {
              cardType: cardInfo.cardType,
              cardNumber: cardInfo.cardNumber,
              expirationDate: new Date(cardInfo.expirationDate),
            },
            'subscription.lastPaymentId': result.insertedId,
          },
        }
      );

      res.json({
        message: 'Payment processing initiated',
        paymentId: result.insertedId,
        transactionId: payment.transactionId,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Upload payment proof
  async uploadPaymentProof(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { paymentId } = req.params;
      const { notes } = req.body;

      // Validate payment exists and belongs to user
      const payment = await db.collection('payments').findOne({
        _id: new ObjectId(paymentId),
        userId: userId
      });

      if (!payment) {
        // Delete uploaded file if exists
        if (req.file) {
          await fs.unlink(req.file.path);
        }
        return res.status(404).json({
          success: false,
          message: 'Payment not found or unauthorized'
        });
      }

      if (payment.status === 'verified') {
        // Delete uploaded file if exists
        if (req.file) {
          await fs.unlink(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Payment already verified'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Payment proof file is required'
        });
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'skyflix/payment_proofs',
        resource_type: 'image'
      });

      // Delete local file after upload
      await fs.unlink(req.file.path);

      // Update payment record
      const updateResult = await db.collection('payments').updateOne(
        { _id: new ObjectId(paymentId) },
        {
          $set: {
            paymentProof: {
              url: result.secure_url,
              publicId: result.public_id,
              uploadedAt: new Date(),
              notes: notes || '',
            },
            status: 'pending_verification',
            lastUpdated: new Date()
          }
        }
      );

      // Update user subscription status to pending verification
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            'subscription.status': 'pending_verification',
            'subscription.lastPaymentProof': {
              url: result.secure_url,
              uploadedAt: new Date()
            }
          }
        }
      );

      res.json({
        success: true,
        message: 'Payment proof uploaded successfully',
        data: {
          paymentId,
          proofUrl: result.secure_url,
          status: 'pending_verification',
          uploadedAt: new Date()
        }
      });
    } catch (error) {
      // Delete uploaded file if exists in case of error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      console.error('Error uploading payment proof:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading payment proof',
        error: error.message
      });
    }
  },

  async getPaymentProof(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { paymentId } = req.params;

      const payment = await db.collection('payments').findOne({
        _id: new ObjectId(paymentId),
        userId: userId
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found or unauthorized'
        });
      }

      if (!payment.paymentProof) {
        return res.status(404).json({
          success: false,
          message: 'No payment proof found for this payment'
        });
      }

      res.json({
        success: true,
        data: {
          paymentId,
          proof: payment.paymentProof,
          status: payment.status
        }
      });
    } catch (error) {
      console.error('Error getting payment proof:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving payment proof',
        error: error.message
      });
    }
  },

  // Get payment history
  async getPaymentHistory(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const payments = await db.collection('payments').find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray();

      const total = await db.collection('payments').countDocuments({ userId });

      res.json({
        payments,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Handle auto-renewal payments
  async handleAutoRenewal(req, res) {
    try {
      const db = getDB();
      const { userId } = req.params;
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

      if (!user || !user.subscription || !user.subscription.autoRenew) {
        return res.status(400).json({ message: 'Auto-renewal not enabled' });
      }

      const amount = user.subscription.planType === 'yearly' ? 99.99 : 9.99;

      // Create automatic payment record
      const payment = {
        userId: new ObjectId(userId),
        type: 'subscription_renewal',
        planType: user.subscription.planType,
        amount,
        paymentMethod: user.paymentInfo.cardType,
        cardInfo: {
          cardType: user.paymentInfo.cardType,
          lastFourDigits: user.paymentInfo.cardNumber.slice(-4),
          expirationDate: user.paymentInfo.expirationDate,
        },
        status: 'processing',
        createdAt: new Date(),
        transactionId: `RENEW${Date.now()}${Math.floor(Math.random() * 1000)}`,
      };

      const result = await db.collection('payments').insertOne(payment);

      res.json({
        message: 'Auto-renewal payment initiated',
        paymentId: result.insertedId,
        transactionId: payment.transactionId,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = paymentController;
