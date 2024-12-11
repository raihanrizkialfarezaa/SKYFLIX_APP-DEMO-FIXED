const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const userController = {
  
  async getProfile(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;

      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateProfile(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { fullName, dateOfBirth, country } = req.body;

      const updateData = {
        fullName,
        dateOfBirth: new Date(dateOfBirth),
        country,
      };

      const result = await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: updateData });

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Profile updated successfully', updated: updateData });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updatePreferences(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { genreName, actorName, preferenceScore } = req.body;

      // Validate input
      if (!genreName || !actorName || !preferenceScore) {
        return res.status(400).json({
          message: 'Genre name, actor name, and preference score are required',
        });
      }

      // Validate preferenceScore is between 0 and 1
      if (preferenceScore < 0 || preferenceScore > 1) {
        return res.status(400).json({
          message: 'Preference score must be between 0 and 1',
        });
      }

      // Find genre by name
      const genre = await db.collection('genres').findOne({ genreName: genreName });

      if (!genre) {
        return res.status(404).json({ message: 'Genre not found' });
      }

      // Parse actor name into first name and last name
      const [firstName, lastName] = actorName.trim().split(' ');

      if (!firstName || !lastName) {
        return res.status(400).json({
          message: 'Actor name must be in "First Last" format',
        });
      }

      // Find actor by full name
      const actor = await db.collection('actors').findOne({
        firstName: firstName,
        lastName: lastName,
      });

      if (!actor) {
        return res.status(404).json({ message: 'Actor not found' });
      }

      const preference = {
        genreId: genre._id,
        genreName: genre.genreName,
        actorId: actor._id,
        actorName: `${actor.firstName} ${actor.lastName}`,
        preferenceScore: parseFloat(preferenceScore),
      };

      // Check if preference already exists and update it, or add new one
      const result = await db.collection('users').updateOne(
        {
          _id: new ObjectId(userId),
          'preferences.genreId': genre._id,
          'preferences.actorId': actor._id,
        },
        {
          $set: {
            'preferences.$.preferenceScore': preference.preferenceScore,
            'preferences.$.updatedAt': new Date(),
          },
        }
      );

      // If no existing preference was updated, add new one
      if (result.matchedCount === 0) {
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $push: {
              preferences: {
                ...preference,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          }
        );
      }

      res.json({
        message: 'Preferences updated successfully',
        preference,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
        error: 'Error updating preferences',
      });
    }
  },

  async updateSubscription(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { status, startDate, endDate } = req.body;

      const subscription = {
        status,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };

      await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { subscription } });

      res.json({ message: 'Subscription updated successfully', subscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getWatchHistory(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const history = await db
        .collection('watchHistory')
        .aggregate([
          { $match: { userId: new ObjectId(userId) } },
          {
            $lookup: {
              from: 'films',
              localField: 'film.filmId',
              foreignField: '_id',
              as: 'filmDetails',
            },
          },
          { $sort: { watchDate: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) },
        ])
        .toArray();

      const total = await db.collection('watchHistory').countDocuments({
        userId: new ObjectId(userId),
      });

      res.json({
        history,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updatePaymentInfo(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { cardType, cardNumber, expirationDate } = req.body;

      const paymentInfo = {
        cardType,
        cardNumber,
        expirationDate: new Date(expirationDate),
      };

      await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { paymentInfo } });

      res.json({
        message: 'Payment information updated successfully',
        paymentInfo: {
          cardType,
          cardNumber: `****${cardNumber.slice(-4)}`,
          expirationDate,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async changePassword(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { currentPassword, newPassword } = req.body;

      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { password: hashedPassword } });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // New method: Delete profile
  async deleteProfile(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { password } = req.body;

      // Verify password before deletion
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      // Start a session for transaction
      const session = db.client.startSession();

      try {
        await session.withTransaction(async () => {
          // Delete user's data from all related collections
          await db.collection('users').deleteOne({ _id: new ObjectId(userId) }, { session });

          await db.collection('watchHistory').deleteMany({ userId: new ObjectId(userId) }, { session });

          await db.collection('watchlist').deleteMany({ userId: new ObjectId(userId) }, { session });

          await db.collection('reviews').deleteMany({ userId: new ObjectId(userId) }, { session });
        });

        res.json({
          message: 'Profile and all associated data deleted successfully',
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      res.status(500).json({
        message: 'An error occurred while deleting the profile',
        error: error.message,
      });
    }
  },
};

module.exports = userController;
