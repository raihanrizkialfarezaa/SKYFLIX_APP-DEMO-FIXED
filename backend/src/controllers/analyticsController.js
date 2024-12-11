const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const analyticsController = {
  // Get user engagement metrics
  async getUserEngagement(req, res) {
    try {
      const db = getDB();
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.watchDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const engagement = await db.collection('watchHistory')
        .aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: {
                userId: '$userId',
                date: { $dateToString: { format: '%Y-%m-%d', date: '$watchDate' } }
              },
              watchTime: { $sum: '$watchDuration' },
              sessionsCount: { $sum: 1 },
              completedViews: {
                $sum: { $cond: [{ $eq: ['$watchProgress', 100] }, 1, 0] }
              }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id.userId',
              foreignField: '_id',
              as: 'userInfo'
            }
          },
          {
            $project: {
              _id: '$_id.userId',
              date: '$_id.date',
              username: { $arrayElemAt: ['$userInfo.username', 0] },
              averageWatchTime: '$watchTime',
              totalSessions: '$sessionsCount',
              totalCompletedViews: '$completedViews',
              uniqueUsers: 1
            }
          },
          { $sort: { date: 1 } }
        ]).toArray();

      res.json(engagement);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get content performance metrics
  async getContentPerformance(req, res) {
    try {
      const db = getDB();
      const { period = '30days' } = req.query;

      const startDate = new Date();
      if (period === '30days') startDate.setDate(startDate.getDate() - 30);
      if (period === '90days') startDate.setDate(startDate.getDate() - 90);
      if (period === '1year') startDate.setFullYear(startDate.getFullYear() - 1);

      const performance = await db.collection('watchHistory')
        .aggregate([
          {
            $match: {
              watchDate: { $gte: startDate }
            }
          },
          {
            $lookup: {
              from: 'films',
              localField: 'film.filmId',
              foreignField: '_id',
              as: 'filmDetails'
            }
          },
          { $unwind: '$filmDetails' },
          {
            $group: {
              _id: '$film.filmId',
              title: { $first: '$filmDetails.title' },
              totalViews: { $sum: 1 },
              averageWatchDuration: { $avg: '$watchDuration' },
              completionRate: {
                $avg: {
                  $cond: [
                    { $eq: ['$watchProgress', 100] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'filmId',
              as: 'reviews'
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              totalViews: 1,
              averageWatchDuration: 1,
              completionRate: { $multiply: ['$completionRate', 100] },
              averageRating: { $avg: '$reviews.rating' }
            }
          },
          { $sort: { totalViews: -1 } }
        ]).toArray();

      res.json(performance);
    } catch (error) {
      console.error('Error in getContentPerformance:', error);
      res.status(500).json({ message: error.message });
    }
  },

  // Get subscription metrics
  async getSubscriptionMetrics(req, res) {
    try {
      const db = getDB();
      const { period = 'monthly' } = req.query;

      // Get subscription metrics
      const metrics = await db.collection('users')
        .aggregate([
          {
            $group: {
              _id: '$_id',  // Group by userId
              status: { $first: '$subscription.status' },
              username: { $first: '$username' },
              email: { $first: '$email' },
              subscriptionStartDate: { $first: '$subscription.startDate' }
            }
          }
        ]).toArray();

      const formattedMetrics = metrics.map(m => ({
        _id: m._id,
        status: m.status || 'inactive',
        username: m.username,
        email: m.email,
        userCount: 1
      }));

      // Calculate retention rates
      const retentionRates = await db.collection('users')
        .aggregate([
          {
            $match: {
              'subscription.status': 'active'
            }
          },
          {
            $group: {
              _id: {
                userId: '$_id',
                period: {
                  $dateToString: {
                    format: period === 'monthly' ? '%Y-%m' : '%Y',
                    date: '$subscription.startDate'
                  }
                }
              },
              username: { $first: '$username' },
              email: { $first: '$email' },
              isActive: {
                $sum: {
                  $cond: [
                    { $eq: ['$subscription.status', 'active'] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              _id: '$_id.userId',
              period: '$_id.period',
              username: 1,
              email: 1,
              retentionRate: {
                $multiply: [
                  { $divide: ['$isActive', 1] },
                  100
                ]
              }
            }
          },
          { $sort: { period: 1 } }
        ]).toArray();

      // Aggregate metrics by status for summary
      const statusSummary = formattedMetrics.reduce((acc, curr) => {
        const status = curr.status;
        if (!acc[status]) {
          acc[status] = 0;
        }
        acc[status]++;
        return acc;
      }, {});

      res.json({
        subscriptionMetrics: formattedMetrics,
        retentionRates,
        summary: {
          totalUsers: formattedMetrics.length,
          byStatus: statusSummary
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = analyticsController;