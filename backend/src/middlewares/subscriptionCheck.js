const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

async function subscriptionCheck(req, res, next) {
  try {
    const db = getDB();
    const userId = new ObjectId(req.user._id);

    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { subscription: 1, accountType: 1 } }
    );

    if (!user) {
      return res.status(403).json({
        message: 'User not found',
        requiresSubscription: true
      });
    }

    // Subscriber Status check
    if (user.accountType !== 'premium' || 
        user.subscription?.status !== 'verified') {
      return res.status(403).json({
        message: 'Premium subscription required',
        currentStatus: user.subscription?.status || 'none',
        accountType: user.accountType,
        requiresSubscription: true
      });
    }

    // check if expired
    const now = new Date();
    const endDate = new Date(user.subscription.endDate);
    const gracePeriodEnd = new Date(endDate.getTime() + (7 * 24 * 60 * 60 * 1000));

    if (now > gracePeriodEnd) {
      // update user to free if expired
      await db.collection('users').updateOne(
        { _id: userId },
        { 
          $set: { 
            accountType: 'free',
            'subscription.status': 'expired'
          }
        }
      );

      return res.status(403).json({
        message: 'Subscription has expired',
        subscriptionExpired: true,
        gracePeriodExpired: true
      });
    }

    if (now > endDate && now <= gracePeriodEnd) {
      req.inGracePeriod = true;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = subscriptionCheck;