const { CronJob } = require('cron');
const { getDB } = require('../config/database');
const NotificationService = require('./notificationService');
const { ObjectId } = require('mongodb');

class SchedulerService {
  constructor() {
    this.db = getDB();
    this.initializeJobs();
  }

  initializeJobs() {
    // Check subscription expirations daily at midnight
    new CronJob('0 0 * * *', this.checkSubscriptionExpirations.bind(this), null, true);

    // Process auto-renewals daily at 1 AM
    new CronJob('0 1 * * *', this.processAutoRenewals.bind(this), null, true);

    // Send watchlist reminders every Monday at 10 AM
    new CronJob('0 10 * * 1', this.sendWatchlistReminders.bind(this), null, true);

    // Clean up expired temporary data weekly
    new CronJob('0 0 * * 0', this.cleanupExpiredData.bind(this), null, true);
  }

  async checkSubscriptionExpirations() {
    try {
      const expiringUsers = await this.db.collection('users').find({
        'subscription.endDate': {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
        },
        'subscription.status': 'active'
      }).toArray();

      for (const user of expiringUsers) {
        const daysRemaining = Math.ceil(
          (new Date(user.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
        );
        await NotificationService.sendSubscriptionExpirationNotice(user._id, daysRemaining);
      }
    } catch (error) {
      console.error('Error checking subscription expirations:', error);
    }
  }

  async processAutoRenewals() {
    try {
      const usersToRenew = await this.db.collection('users').find({
        'subscription.endDate': {
          $gte: new Date(),
          $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
        },
        'subscription.autoRenew': true,
        'subscription.status': 'active'
      }).toArray();

      for (const user of usersToRenew) {
        try {
          // Process payment using stored payment method
          const paymentResult = await this.processRenewalPayment(user);

          if (paymentResult.success) {
            // Update subscription dates
            const newEndDate = new Date(user.subscription.endDate);
            newEndDate.setMonth(newEndDate.getMonth() + 
              (user.subscription.planType === 'yearly' ? 12 : 1));

            await this.db.collection('users').updateOne(
              { _id: user._id },
              {
                $set: {
                  'subscription.endDate': newEndDate,
                  'subscription.lastRenewalDate': new Date()
                }
              }
            );

            await NotificationService.sendPaymentConfirmation(user._id, paymentResult);
          } else {
            await NotificationService.sendPaymentFailure(user._id, paymentResult);
          }
        } catch (error) {
          console.error(`Error processing renewal for user ${user._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing auto renewals:', error);
    }
  }

  async sendWatchlistReminders() {
    try {
      const watchlists = await this.db.collection('watchlist').find({
        'films.reminders.enabled': true,
        'films.reminders.frequency': 'weekly'
      }).toArray();

      for (const watchlist of watchlists) {
        const user = await this.db.collection('users').findOne(
          { _id: watchlist.userId },
          { projection: { notificationPreferences: 1 } }
        );

        if (user?.notificationPreferences?.watchlistReminders) {
          for (const film of watchlist.films) {
            if (film.reminders.enabled) {
              await NotificationService.sendWatchlistReminder(watchlist.userId, {
                filmId: film.filmId,
                title: film.title
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending watchlist reminders:', error);
    }
  }

  async cleanupExpiredData() {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Clean up old notifications
      await this.db.collection('notifications').deleteMany({
        createdAt: { $lt: oneMonthAgo },
        isRead: true
      });

      // Clean up expired temporary tokens
      await this.db.collection('tempTokens').deleteMany({
        expiresAt: { $lt: new Date() }
      });

      // Clean up old analytics data
      await this.db.collection('analytics').deleteMany({
        date: { $lt: oneMonthAgo }
      });
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
    }
  }

  async processRenewalPayment(user) {
    // Implement actual payment processing logic here
    try {
      const amount = user.subscription.planType === 'yearly' ? 99.99 : 9.99;
      
      const paymentRecord = {
        userId: user._id,
        type: 'subscription_renewal',
        amount,
        paymentMethod: user.paymentInfo.cardType,
        cardInfo: {
          lastFourDigits: user.paymentInfo.cardNumber.slice(-4),
          expirationDate: user.paymentInfo.expirationDate
        },
        status: 'processing',
        createdAt: new Date(),
        transactionId: `RENEW${Date.now()}${Math.floor(Math.random() * 1000)}`
      };

      await this.db.collection('payments').insertOne(paymentRecord);

      // Simulate payment processing
      const isSuccessful = true; // In real implementation, process actual payment

      if (isSuccessful) {
        await this.db.collection('payments').updateOne(
          { _id: paymentRecord._id },
          { $set: { status: 'completed' } }
        );

        return {
          success: true,
          amount,
          transactionId: paymentRecord.transactionId
        };
      }

      await this.db.collection('payments').updateOne(
        { _id: paymentRecord._id },
        { $set: { status: 'failed' } }
      );

      return {
        success: false,
        error: 'Payment processing failed'
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SchedulerService();