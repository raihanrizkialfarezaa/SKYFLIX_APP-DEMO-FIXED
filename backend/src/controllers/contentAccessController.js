const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const contentAccessController = {

  // Create new content access rule
  async createContentAccess(req, res) {
    try {
      const db = getDB();
      const { filmId, contentType } = req.body;

      // Validation checks
      if (!filmId || !contentType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          required: ['filmId', 'contentType']
        });
      }

      if (!['free', 'premium'].includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content type. Must be either "free" or "premium"'
        });
      }

      // Check if film exists
      const film = await db.collection('films').findOne({ 
        _id: new ObjectId(filmId) 
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: 'Film not found'
        });
      }

      // Check if content access rule already exists
      const existingRule = await db.collection('contentAccess').findOne({
        filmId: new ObjectId(filmId)
      });

      if (existingRule) {
        return res.status(400).json({
          success: false,
          message: 'Content access rule already exists for this film',
          existingType: existingRule.contentType
        });
      }

      // Create content access rule
      const contentAccess = {
        filmId: new ObjectId(filmId),
        filmTitle: film.title,
        contentType,
        createdAt: new Date(),
        createdBy: new ObjectId(req.user._id),
        lastModifiedAt: new Date(),
        lastModifiedBy: new ObjectId(req.user._id)
      };

      const result = await db.collection('contentAccess').insertOne(contentAccess);

      // Update film's content type
      await db.collection('films').updateOne(
        { _id: new ObjectId(filmId) },
        {
          $set: {
            contentType: contentType,
            lastModifiedAt: new Date(),
            lastModifiedBy: new ObjectId(req.user._id)
          }
        }
      );

      res.status(201).json({
        success: true,
        message: 'Content access rule created successfully',
        data: {
          _id: result.insertedId,
          filmTitle: film.title,
          contentType,
          createdAt: contentAccess.createdAt
        }
      });

    } catch (error) {
      console.error('Error creating content access:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating content access rule',
        error: error.message
      });
    }
  },

  // Get all content access rules
  async getAllContentAccess(req, res) {
    try {
      const db = getDB();
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const contentAccessRules = await db.collection('contentAccess')
        .aggregate([
          {
            $lookup: {
              from: 'films',
              localField: 'filmId',
              foreignField: '_id',
              as: 'filmDetails'
            }
          },
          { $unwind: '$filmDetails' },
          {
            $project: {
              filmId: 1,
              filmTitle: 1,
              contentType: 1,
              createdAt: 1,
              lastModifiedAt: 1,
              filmDetails: {
                title: 1,
                releaseYear: 1,
                ageRating: 1
              }
            }
          },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ]).toArray();

      const total = await db.collection('contentAccess').countDocuments();

      res.json({
        success: true,
        data: contentAccessRules,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      });
    } catch (error) {
      console.error('Error getting content access rules:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving content access rules',
        error: error.message
      });
    }
  },

  // Update content access rule
  async updateContentAccess(req, res) {
    try {
      const db = getDB();
      const { id } = req.params;
      const { contentType } = req.body;

      if (!contentType || !['free', 'premium'].includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content type. Must be either "free" or "premium"'
        });
      }

      // Get the content access rule first
      const contentAccess = await db.collection('contentAccess').findOne(
        { _id: new ObjectId(id) }
      );

      if (!contentAccess) {
        return res.status(404).json({
          success: false,
          message: 'Content access rule not found'
        });
      }

      // Update content access rule
      await db.collection('contentAccess').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            contentType,
            lastModifiedAt: new Date(),
            lastModifiedBy: new ObjectId(req.user._id)
          }
        }
      );

      // Update film's content type
      await db.collection('films').updateOne(
        { _id: contentAccess.filmId },
        {
          $set: {
            contentType: contentType,
            lastModifiedAt: new Date(),
            lastModifiedBy: new ObjectId(req.user._id)
          }
        }
      );

      res.json({
        success: true,
        message: 'Content access rule updated successfully',
        data: {
          filmId: contentAccess.filmId,
          filmTitle: contentAccess.filmTitle,
          contentType,
          lastModifiedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error updating content access:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating content access rule',
        error: error.message
      });
    }
  },

  // Delete content access rule
  async deleteContentAccess(req, res) {
    try {
      const db = getDB();
      const { id } = req.params;

      const result = await db.collection('contentAccess').deleteOne({
        _id: new ObjectId(id)
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Content access rule not found'
        });
      }

      res.json({
        success: true,
        message: 'Content access rule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting content access:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting content access rule',
        error: error.message
      });
    }
  },

  // Get films without content access rules
  async getFilmsWithoutAccess(req, res) {
    try {
      const db = getDB();
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      // Get all films that don't have content access rules
      const films = await db.collection('films')
        .aggregate([
          {
            $lookup: {
              from: 'contentAccess',
              localField: '_id',
              foreignField: 'filmId',
              as: 'accessRule'
            }
          },
          {
            $match: {
              accessRule: { $size: 0 }
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              releaseYear: 1,
              ageRating: 1,
              createdAt: 1
            }
          },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ]).toArray();

      const total = await db.collection('films')
        .aggregate([
          {
            $lookup: {
              from: 'contentAccess',
              localField: '_id',
              foreignField: 'filmId',
              as: 'accessRule'
            }
          },
          {
            $match: {
              accessRule: { $size: 0 }
            }
          }
        ]).toArray();

      res.json({
        success: true,
        data: films,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total.length / limit),
          totalItems: total.length
        }
      });
    } catch (error) {
      console.error('Error getting films without access rules:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving films without access rules',
        error: error.message
      });
    }
  },

  // Check content access permission
  async checkAccess(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { title } = req.params;
      const decodedTitle = decodeURIComponent(title);

      // Get film details
      const film = await db.collection('films').findOne(
        { title: { $regex: new RegExp(`^${decodedTitle}$`, 'i') } }
      );

      if (!film) {
        return res.status(404).json({ message: 'Film not found' });
      }

      // Get content access rule
      const contentAccess = await db.collection('contentAccess').findOne({
        filmId: film._id
      });

      if (!contentAccess) {
        return res.status(404).json({ 
          message: 'Content access rule not found for this film',
          filmId: film._id,
          title: film.title
        });
      }

      // Get user subscription status
      const user = await db.collection('users').findOne(
        { _id: userId },
        { projection: { subscription: 1, accountType: 1 } }
      );

      // Determine if user has access based on content type and user type
      const hasAccess = contentAccess.contentType === 'free' || user.accountType === 'premium';

      res.json({
        hasAccess,
        film: {
          id: film._id,
          title: film.title,
          description: film.description,
          contentType: contentAccess.contentType
        },
        userType: user.accountType,
        requiresSubscription: contentAccess.contentType === 'premium'
      });

    } catch (error) {
      console.error('Error checking content access:', error);
      res.status(500).json({ 
        message: error.message,
        error: 'Error checking content access'
      });
    }
  },

  // Get user viewing history with content access info
  async getViewingHistory(req, res) {
    try {
      const db = getDB();
      const userId = new ObjectId(req.user._id);
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const history = await db.collection('contentAccess')
        .aggregate([
          { $match: { userId } },
          {
            $lookup: {
              from: 'films',
              localField: 'filmId',
              foreignField: '_id',
              as: 'filmDetails'
            }
          },
          { $unwind: '$filmDetails' },
          {
            $project: {
              filmTitle: '$filmDetails.title',
              accessDate: 1,
              accessGranted: 1,
              userType: 1
            }
          },
          { $sort: { accessDate: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ]).toArray();

      const total = await db.collection('contentAccess').countDocuments({ userId });

      res.json({
        history,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get content access analytics
  async getAccessAnalytics(req, res) {
    try {
      const db = getDB();
      const { startDate, endDate } = req.query;

      const query = {};
      if (startDate && endDate) {
        query.accessDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const analytics = await db.collection('contentAccess')
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                userType: '$userType',
                accessGranted: '$accessGranted'
              },
              count: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: '$_id.userType',
              accessStats: {
                $push: {
                  granted: '$_id.accessGranted',
                  count: '$count'
                }
              },
              totalAttempts: { $sum: '$count' }
            }
          }
        ]).toArray();

      res.json({
        analytics,
        period: {
          start: startDate,
          end: endDate
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = contentAccessController;