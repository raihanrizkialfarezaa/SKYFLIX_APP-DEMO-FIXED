const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const notificationController = {
  // Create notification
  async createNotification(req, res) {
    try {
      const db = getDB();
      const { userId, type, title, message, data } = req.body;

      // Validate required fields
      if (!userId || !type || !title || !message) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
          required: ["userId", "type", "title", "message"]
        });
      }

      // Validate userId format
      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId format"
        });
      }

      // Fixed validation: validate notification type based on existing schema
      const validTypes = [
        'subscription_expiration',
        'system_message',
        'payment_confirmation',
        'payment_failure',
        'content_update'
      ];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification type",
          validTypes
        });
      }

      // Create notification document that matches schema
      const notification = {
        userId: new ObjectId(userId),
        type: type,
        title: String(title),
        message: String(message),
        data: data || {},
        isRead: false,
        createdAt: new Date()
      };

      // Add schema validation error handling
      let result;
      try {
        result = await db.collection('notifications').insertOne(notification);
      } catch (dbError) {
        console.error('Database insertion error:', dbError);
        if (dbError.code === 121) {
          // Schema validation error
          return res.status(400).json({
            success: false,
            message: "Document validation failed",
            details: dbError.errInfo
          });
        }
        throw dbError;
      }

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        notification: {
          _id: result.insertedId,
          ...notification,
          userId: userId // Return string format of userId
        }
      });

    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ 
        success: false,
        message: "Error creating notification",
        error: error.message
      });
    }
  },

  // Get user notifications
  async getUserNotifications(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { page = 1, limit = 10, unreadOnly = false } = req.query;

      const query = { userId };
      if (unreadOnly === 'true') {
        query.isRead = false;
      }

      const skip = (page - 1) * limit;

      const notifications = await db.collection('notifications')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total = await db.collection('notifications').countDocuments(query);
      const unreadCount = await db.collection('notifications').countDocuments({
        userId,
        isRead: false
      });

      res.json({
        notifications,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        unreadCount
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { notificationId } = req.params;

      await db.collection('notifications').updateOne(
        {
          _id: new ObjectId(notificationId),
          userId
        },
        {
          $set: { isRead: true }
        }
      );

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);

      await db.collection('notifications').updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      );

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { notificationId } = req.params;

      await db.collection('notifications').deleteOne({
        _id: new ObjectId(notificationId),
        userId
      });

      res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update notification preferences
  async updatePreferences(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { preferences } = req.body;

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            notificationPreferences: preferences
          }
        }
      );

      res.json({
        message: 'Notification preferences updated successfully',
        preferences
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = notificationController;