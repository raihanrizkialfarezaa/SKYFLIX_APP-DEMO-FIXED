const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const adminController = {
  // Verify subscription payment
  async verifySubscriptionPayment(req, res) {
    try {
      const db = getDB();
      const { userId, status, adminNotes } = req.body;

      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const updateData = {
        'subscription.status': status,
        'subscription.adminVerification': {
          date: new Date(),
          status,
          notes: adminNotes
        }
      };

      // Automatically update accountType based on subscription verification
      if (status === 'active') {
        updateData['accountType'] = 'premium';
      } else if (status === 'rejected' || status === 'cancelled') {
        updateData['accountType'] = 'free';
      }

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );

      // If approved, create subscription history record
      if (status === 'active') {
        const subscriptionHistoryDoc = {
          userId: new ObjectId(userId),
          planType: user.subscription?.planType || 'monthly',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          amount: user.subscription?.lastPayment?.amount || 0,
          verificationDate: new Date(),
          status: 'active',
          paymentMethod: user.subscription?.paymentMethod || 'unknown',
          verifiedBy: new ObjectId(req.user?._id) || null,
          verificationNotes: adminNotes || '',
          metadata: {
            userEmail: user.email,
            userName: user.username,
            createdAt: new Date()
          }
        };

        await db.collection('subscriptionHistory').insertOne(subscriptionHistoryDoc);
      }

      res.json({
        message: `Subscription ${status}`,
        userId,
        status,
        accountType: updateData.accountType
      });
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ 
        message: 'Error verifying subscription',
        error: error.message,
        details: error.errInfo 
      });
    }
  },

  
  async getPendingVerifications(req, res) {
    try {
      const db = getDB();
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const pendingSubscriptions = await db.collection('users')
        .find({
          'subscription.status': 'pending'
        })
        .project({
          username: 1,
          email: 1,
          subscription: 1
        })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total = await db.collection('users').countDocuments({
        'subscription.status': 'pending'
      });

      res.json({
        pendingSubscriptions,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSubscriptionAnalytics(req, res) {
    try {
      const db = getDB();
      const { startDate, endDate } = req.query;

      const query = {};
      if (startDate && endDate) {
        query.verificationDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const analytics = await db.collection('subscriptionHistory')
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: '$planType',
              totalSubscriptions: { $sum: 1 },
              totalRevenue: { $sum: '$amount' }
            }
          }
        ]).toArray();

      const summary = {
        totalSubscriptions: analytics.reduce((acc, curr) => acc + curr.totalSubscriptions, 0),
        totalRevenue: analytics.reduce((acc, curr) => acc + curr.totalRevenue, 0),
        byPlanType: analytics
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = adminController;