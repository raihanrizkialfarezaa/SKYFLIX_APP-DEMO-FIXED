const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class NotificationService {
  constructor() {
    this.db = getDB();
  }

  // Send subscription expiration notification
  async sendSubscriptionExpirationNotice(userId, daysRemaining) {
    const notification = {
      userId: new ObjectId(userId),
      type: 'subscription_expiration',
      title: 'Subscription Expiring Soon',
      message: `Your subscription will expire in ${daysRemaining} days. Renew now to continue enjoying premium content.`,
      data: { daysRemaining },
      isRead: false,
      createdAt: new Date()
    };

    await this.db.collection('notifications').insertOne(notification);
  }

  // Send payment confirmation notification
  async sendPaymentConfirmation(userId, paymentDetails) {
    const notification = {
      userId: new ObjectId(userId),
      type: 'payment_confirmation',
      title: 'Payment Confirmation',
      message: `Your payment of $${paymentDetails.amount} has been processed successfully.`,
      data: paymentDetails,
      isRead: false,
      createdAt: new Date()
    };

    await this.db.collection('notifications').insertOne(notification);
  }

  // Send payment failure notification
  async sendPaymentFailure(userId, paymentDetails) {
    const notification = {
      userId: new ObjectId(userId),
      type: 'payment_failure',
      title: 'Payment Failed',
      message: 'Your recent payment attempt failed. Please update your payment information.',
      data: paymentDetails,
      isRead: false,
      createdAt: new Date()
    };

    await this.db.collection('notifications').insertOne(notification);
  }

  // Send new content notification
  async sendNewContentNotification(users, contentDetails) {
    const notifications = users.map(userId => ({
      userId: new ObjectId(userId),
      type: 'new_content',
      title: 'New Content Available',
      message: `New content "${contentDetails.title}" is now available to watch!`,
      data: contentDetails,
      isRead: false,
      createdAt: new Date()
    }));

    await this.db.collection('notifications').insertMany(notifications);
  }

  // Send watchlist reminder
  async sendWatchlistReminder(userId, content) {
    const notification = {
      userId: new ObjectId(userId),
      type: 'watchlist_reminder',
      title: 'Watchlist Reminder',
      message: `Don't forget to watch "${content.title}" from your watchlist!`,
      data: content,
      isRead: false,
      createdAt: new Date()
    };

    await this.db.collection('notifications').insertOne(notification);
  }

  // Send subscription activation notification
  async sendSubscriptionActivation(userId, subscriptionDetails) {
    const notification = {
      userId: new ObjectId(userId),
      type: 'subscription_activation',
      title: 'Subscription Activated',
      message: 'Your premium subscription has been activated successfully!',
      data: subscriptionDetails,
      isRead: false,
      createdAt: new Date()
    };

    await this.db.collection('notifications').insertOne(notification);
  }

  // Get user's notification preferences
  async getUserNotificationPreferences(userId) {
    const user = await this.db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { notificationPreferences: 1 } }
    );
    return user?.notificationPreferences || {};
  }

  // Check and send subscription renewal reminders
  async checkAndSendRenewalReminders() {
    const expiringThreshold = new Date();
    expiringThreshold.setDate(expiringThreshold.getDate() + 7); // 7 days from now

    const expiringSubscriptions = await this.db.collection('users').find({
      'subscription.endDate': {
        $gte: new Date(),
        $lte: expiringThreshold
      },
      'subscription.status': 'active'
    }).toArray();

    for (const user of expiringSubscriptions) {
      const daysRemaining = Math.ceil(
        (new Date(user.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      await this.sendSubscriptionExpirationNotice(user._id, daysRemaining);
    }
  }
}

module.exports = new NotificationService();