const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class ReportingService {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  initialize() {
    this.db = getDB();
  }

  // Ensure db is connected
  ensureDbConnection() {
    if (!this.db) {
      this.initialize();
    }
    return this.db;
  }

  async generateUserEngagementReport(startDate, endDate) {
    try {
      const db = this.ensureDbConnection();
      const report = await db.collection('watchHistory').aggregate([
        {
          $match: {
            watchDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              accountType: { $arrayElemAt: ['$userInfo.accountType', 0] }
            },
            totalWatchTime: { $sum: '$watchDuration' },
            averageWatchProgress: { $avg: '$watchProgress' },
            sessionsCount: { $sum: 1 },
            completedViews: {
              $sum: { $cond: [{ $eq: ['$watchProgress', 100] }, 1, 0] }
            },
            genres: { $addToSet: '$film.genres' }
          }
        },
        {
          $group: {
            _id: '$_id.accountType',
            usersCount: { $sum: 1 },
            averageWatchTime: { $avg: '$totalWatchTime' },
            averageCompletionRate: {
              $avg: { $divide: ['$completedViews', '$sessionsCount'] }
            },
            totalSessions: { $sum: '$sessionsCount' }
          }
        }
      ]).toArray();

      return {
        period: { startDate, endDate },
        metrics: report
      };
    } catch (error) {
      console.error('Error generating user engagement report:', error);
      throw error;
    }
  }

  async generateContentPerformanceReport(period) {
    try {
      const db = this.ensureDbConnection();
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 1);
      }

      const report = await db.collection('films').aggregate([
        {
          $lookup: {
            from: 'watchHistory',
            localField: '_id',
            foreignField: 'film.filmId',
            as: 'views'
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
            title: 1,
            releaseYear: 1,
            viewCount: { $size: '$views' },
            averageRating: { $avg: '$reviews.rating' },
            averageWatchProgress: { $avg: '$views.watchProgress' },
            totalWatchTime: { $sum: '$views.watchDuration' },
            reviews: { $size: '$reviews' }
          }
        },
        { $sort: { viewCount: -1 } }
      ]).toArray();

      return {
        period,
        dateRange: { startDate, endDate },
        topPerformers: report.slice(0, 10),
        totalContent: report.length,
        aggregateMetrics: {
          totalViews: report.reduce((sum, item) => sum + item.viewCount, 0),
          averageRating: report.reduce((sum, item) => sum + (item.averageRating || 0), 0) / report.length,
          averageWatchProgress: report.reduce((sum, item) => sum + (item.averageWatchProgress || 0), 0) / report.length
        }
      };
    } catch (error) {
      console.error('Error generating content performance report:', error);
      throw error;
    }
  }

  async generateRevenueReport(period) {
    try {
      const db = this.ensureDbConnection();
      const report = await db.collection('payments').aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: period === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt'
              }
            },
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            subscriptionTypes: {
              $push: {
                type: '$type',
                amount: '$amount'
              }
            }
          }
        },
        { $sort: { '_id': 1 } },
        {
          $project: {
            period: '$_id',
            totalRevenue: 1,
            transactionCount: 1,
            averageTransactionValue: {
              $divide: ['$totalRevenue', '$transactionCount']
            },
            subscriptionRevenue: {
              $reduce: {
                input: '$subscriptionTypes',
                initialValue: 0,
                in: {
                  $cond: [
                    { $eq: ['$$this.type', 'subscription'] },
                    { $add: ['$$value', '$$this.amount'] },
                    '$$value'
                  ]
                }
              }
            }
          }
        }
      ]).toArray();

      const revenueGrowth = report.map((period, index) => {
        if (index === 0) return { ...period, growthRate: 0 };
        const previousRevenue = report[index - 1].totalRevenue;
        const growthRate = ((period.totalRevenue - previousRevenue) / previousRevenue) * 100;
        return { ...period, growthRate };
      });

      return {
        periodType: period,
        revenueByPeriod: revenueGrowth,
        summary: {
          totalRevenue: report.reduce((sum, period) => sum + period.totalRevenue, 0),
          averageRevenue: report.reduce((sum, period) => sum + period.totalRevenue, 0) / report.length,
          totalTransactions: report.reduce((sum, period) => sum + period.transactionCount, 0),
          subscriptionRevenue: report.reduce((sum, period) => sum + period.subscriptionRevenue, 0)
        }
      };
    } catch (error) {
      console.error('Error generating revenue report:', error);
      throw error;
    }
  }

  async generateSystemHealthReport() {
    try {
      const db = this.ensureDbConnection();
      const now = new Date();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

      const metrics = await db.collection('streamingSessions').aggregate([
        {
          $match: {
            startTime: { $gte: oneDayAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            averageBufferingEvents: { $avg: { $size: '$bufferingEvents' } },
            successfulSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            qualityDistribution: {
              $push: '$quality'
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            averageBufferingEvents: 1,
            successRate: {
              $multiply: [
                { $divide: ['$successfulSessions', '$totalSessions'] },
                100
              ]
            },
            failureRate: {
              $multiply: [
                { $divide: ['$failedSessions', '$totalSessions'] },
                100
              ]
            },
            qualityDistribution: {
              $reduce: {
                input: '$qualityDistribution',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    { $literal: { '$$this': 1 } }
                  ]
                }
              }
            }
          }
        }
      ]).toArray();

      return {
        timestamp: now,
        period: '24h',
        metrics: metrics[0] || {
          totalSessions: 0,
          averageBufferingEvents: 0,
          successRate: 0,
          failureRate: 0,
          qualityDistribution: {}
        }
      };
    } catch (error) {
      console.error('Error generating system health report:', error);
      throw error;
    }
  }
}

// Create and export a single instance
const reportingService = new ReportingService();
reportingService.initialize(); // Initialize when service is created

module.exports = reportingService;