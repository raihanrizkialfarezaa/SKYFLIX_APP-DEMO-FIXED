const ActivityTrackerService = require('../services/activityTrackerService');
const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const activityController = {
  // Start streaming session
  async startStreamingSession(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { filmId, quality, device, network } = req.body;

      // Validate required fields
      if (!filmId || !quality || !device || !network) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          required: ['filmId', 'quality', 'device', 'network']
        });
      }

      // Validate filmId format
      if (!ObjectId.isValid(filmId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid filmId format',
          received: filmId
        });
      }

      // Get film and content access details
      const film = await db.collection('films').findOne({ 
        _id: new ObjectId(filmId) 
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: 'Film not found'
        });
      }

      // Get content access rule
      const contentAccess = await db.collection('contentAccess').findOne({
        filmId: film._id
      });

      if (!contentAccess) {
        return res.status(404).json({
          success: false,
          message: 'Content access rule not found for this film'
        });
      }

      // Get user details including subscription status
      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { accountType: 1, subscription: 1 } }
      );

      // Check if user has access to content
      const hasAccess = contentAccess.contentType === 'free' || user.accountType === 'premium';

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Premium subscription required to access this content',
          contentType: contentAccess.contentType,
          userType: user.accountType,
          requiresSubscription: true
        });
      }

      // Validate quality
      const validQualities = ['SD', 'HD', '4K'];
      if (!validQualities.includes(quality)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid quality value',
          validValues: validQualities,
          received: quality
        });
      }

      // Validate device type
      const validDevices = ['mobile', 'tablet', 'desktop', 'smart_tv'];
      if (!validDevices.includes(device)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid device type',
          validValues: validDevices,
          received: device
        });
      }

      // Validate network type
      const validNetworks = ['wifi', '4g', '5g', 'ethernet'];
      if (!validNetworks.includes(network)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid network type',
          validValues: validNetworks,
          received: network
        });
      }

      // If all validations pass, start streaming session
      const sessionId = await ActivityTrackerService.trackStreamingSession(
        userId,
        film._id,
        {
          quality,
          device,
          network,
          startTime: new Date(),
          contentType: contentAccess.contentType
        }
      );

      res.json({
        success: true,
        message: 'Streaming session started successfully',
        data: {
          sessionId,
          userId: userId.toString(),
          filmId: film._id.toString(),
          title: film.title,
          startTime: new Date(),
          contentType: contentAccess.contentType,
          streaming: {
            quality,
            device,
            network
          }
        }
      });
    } catch (error) {
      console.error('Error starting streaming session:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error starting streaming session',
        error: error.message 
      });
    }
  },

  // End streaming session
  async endStreamingSession(req, res) {
    try {
      const { sessionId } = req.params;

      await ActivityTrackerService.updateStreamingSession(sessionId, {
        endTime: new Date(),
        status: 'completed'
      });

      res.json({ message: 'Streaming session ended' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Log buffering event
  async logBuffering(req, res) {
    try {
      const { sessionId } = req.params;
      const { duration, reason } = req.body;

      await ActivityTrackerService.logBufferingEvent(sessionId, {
        duration,
        reason
      });

      res.json({ message: 'Buffering event logged' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Log quality change
  async logQualityChange(req, res) {
    try {
      const { sessionId } = req.params;
      const { quality } = req.body;

      await ActivityTrackerService.logQualityChange(sessionId, quality);

      res.json({ message: 'Quality change logged' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user viewing stats
  async getUserViewingStats(req, res) {
    try {
      const userId = req.user._id;
      const stats = await ActivityTrackerService.getUserViewingStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get system performance metrics
  async getSystemMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const metrics = await ActivityTrackerService.getSystemPerformanceMetrics(
        startDate,
        endDate
      );
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = activityController;