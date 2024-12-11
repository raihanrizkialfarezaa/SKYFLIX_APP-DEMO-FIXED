const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const subscriptionController = {
  // Check subscription status
  async checkStatus(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);

      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { subscription: 1 } }
      );

      if (!user || !user.subscription) {
        return res.json({
          status: 'inactive',
          hasActiveSubscription: false,
          inGracePeriod: false
        });
      }

      const now = new Date();
      const endDate = new Date(user.subscription.endDate);
      const gracePeriodEnd = new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days grace period

      const status = {
        status: user.subscription.status,
        hasActiveSubscription: now < endDate,
        inGracePeriod: now >= endDate && now <= gracePeriodEnd,
        endDate: endDate,
        gracePeriodEnd: gracePeriodEnd
      };

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Start new subscription
  async startSubscription(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { planType, paymentMethod } = req.body;

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (planType === 'yearly' ? 12 : 1));

      const subscription = {
        status: 'pending',
        planType,
        startDate,
        endDate,
        paymentMethod,
        lastPayment: {
          date: new Date(),
          amount: planType === 'yearly' ? 99.99 : 9.99,
          status: 'pending'
        }
      };

      await db.collection('users').updateOne(
        { _id: userId },
        { 
          $set: { 
            subscription,
            'accountType': 'premium'
          }
        }
      );

      res.json({
        message: 'Subscription initiated successfully',
        subscription
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Verify payment and activate subscription
  async verifyPayment(req, res) {
    try {
      const db = getDB();
      const { userId, paymentProof } = req.body;

      const subscription = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { subscription: 1 } }
      );

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      // Simulate payment verification process
      const isPaymentValid = true; // In real implementation, verify payment proof

      if (!isPaymentValid) {
        return res.status(400).json({ message: 'Invalid payment proof' });
      }

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            'subscription.status': 'active',
            'subscription.lastPayment.status': 'completed',
            'subscription.paymentProof': paymentProof
          }
        }
      );

      res.json({ message: 'Payment verified and subscription activated' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Handle subscription renewal
  async handleRenewal(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { autoRenew } = req.body;

      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { subscription: 1 } }
      );

      if (!user || !user.subscription) {
        return res.status(404).json({ message: 'No active subscription found' });
      }

      const currentEndDate = new Date(user.subscription.endDate);
      const newEndDate = new Date(currentEndDate.setMonth(
        currentEndDate.getMonth() + (user.subscription.planType === 'yearly' ? 12 : 1)
      ));

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            'subscription.autoRenew': autoRenew,
            'subscription.nextRenewalDate': newEndDate
          }
        }
      );

      res.json({
        message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
        nextRenewalDate: newEndDate
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            'subscription.status': 'cancelled',
            'subscription.autoRenew': false,
            'accountType': 'free', // Reset to free when subscription is cancelled
            'subscription.cancelledAt': new Date()
          }
        }
      );

      res.json({ 
        message: 'Subscription cancelled successfully',
        accountType: 'free'
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = subscriptionController;