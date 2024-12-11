const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class ActivityTrackerService {
  constructor() {
    // without initialize
  }

  // Helper method to get db connection
  getDatabase() {
    return getDB();
  }

  async trackUserActivity(userId, activity) {
    try {
      const db = this.getDatabase();
      const activityLog = {
        userId: new ObjectId(userId),
        ...activity,
        timestamp: new Date()
      };

      await db.collection('userActivities').insertOne(activityLog);

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { lastActivityAt: new Date() } }
      );

      return activityLog;
    } catch (error) {
      console.error('Error tracking user activity:', error);
      throw error;
    }
  }

  async trackStreamingSession(userId, filmId, sessionData) {
    try {
      const db = this.getDatabase();
      const session = {
        userId: new ObjectId(userId),
        filmId: new ObjectId(filmId),
        startTime: new Date(),
        endTime: null,
        quality: sessionData.quality,
        device: sessionData.device,
        network: sessionData.network,
        bufferingEvents: [],
        qualityChanges: [],
        status: 'active'
      };

      const result = await db.collection('streamingSessions').insertOne(session);
      return result.insertedId;
    } catch (error) {
      console.error('Error tracking streaming session:', error);
      throw error;
    }
  }

  async updateStreamingSession(sessionId, updateData) {
    try {
      const db = this.getDatabase();
      await db.collection('streamingSessions').updateOne(
        { _id: new ObjectId(sessionId) },
        { $set: updateData }
      );
    } catch (error) {
      console.error('Error updating streaming session:', error);
      throw error;
    }
  }

  async logBufferingEvent(sessionId, event) {
    try {
      const db = this.getDatabase();
      await db.collection('streamingSessions').updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $push: {
            bufferingEvents: {
              timestamp: new Date(),
              duration: event.duration,
              reason: event.reason
            }
          }
        }
      );
    } catch (error) {
      console.error('Error logging buffering event:', error);
      throw error;
    }
  }

  async logQualityChange(sessionId, quality) {
    try {
      const db = this.getDatabase();
      await db.collection('streamingSessions').updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $push: {
            qualityChanges: {
              timestamp: new Date(),
              newQuality: quality,
              reason: 'user_change'
            }
          }
        }
      );
    } catch (error) {
      console.error('Error logging quality change:', error);
      throw error;
    }
  }

  async getUserViewingStats(userId) {
    try {
      const db = this.getDatabase();
      const stats = await db.collection('streamingSessions').aggregate([
        {
          $match: { 
            userId: new ObjectId(userId),
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalWatchTime: {
              $sum: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60
                ]
              }
            },
            averageSessionDuration: {
              $avg: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60
                ]
              }
            },
            totalSessions: { $sum: 1 },
            bufferingEvents: { $sum: { $size: '$bufferingEvents' } },
            qualityChanges: { $sum: { $size: '$qualityChanges' } }
          }
        }
      ]).toArray();

      return stats[0] || {
        totalWatchTime: 0,
        averageSessionDuration: 0,
        totalSessions: 0,
        bufferingEvents: 0,
        qualityChanges: 0
      };
    } catch (error) {
      console.error('Error getting user viewing stats:', error);
      throw error;
    }
  }

  async getSystemPerformanceMetrics(startDate, endDate) {
    try {
      const db = this.getDatabase();
      const metrics = await db.collection('streamingSessions').aggregate([
        {
          $match: {
            startTime: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            averageBufferingEvents: { $avg: { $size: '$bufferingEvents' } },
            totalQualityChanges: { $sum: { $size: '$qualityChanges' } },
            qualityDistribution: {
              $push: '$quality'
            },
            deviceDistribution: {
              $push: '$device.type'
            }
          }
        }
      ]).toArray();

      return metrics[0] || {
        totalSessions: 0,
        averageBufferingEvents: 0,
        totalQualityChanges: 0,
        qualityDistribution: {},
        deviceDistribution: {}
      };
    } catch (error) {
      console.error('Error getting system performance metrics:', error);
      throw error;
    }
  }
}

// Create singleton instance
module.exports = new ActivityTrackerService();